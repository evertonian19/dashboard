// 진입점: 모듈을 불러오고 셸을 시작합니다.
import { api, jsonBody, toLogin } from './core/api.js';
import { setSubTabs } from './core/chrome.js';
import { confirmDelete } from './core/dialogs.js';
import { $, esc, toast } from './core/dom.js';
import { extBadge, fmtDateTime, fmtTime, numFmt } from './core/format.js';
import { hooks } from './core/hooks.js';
import { icon } from './core/icons.js';
import { KIND_LABEL, KIND_MENU, MENUS } from './core/registry.js';
import { config, every, runCleanups } from './core/state.js';
import { mountBoard, renderBoard } from './views/board.js';
import { dgTitle, mountDiagrams, renderDiagrams } from './views/diagrams.js';
import { mountDocuments, renderDocuments } from './views/documents.js';
import { mountHome, renderHome } from './views/home.js';
import { mountSettings, renderSettings } from './views/settings.js';
import { mountTodos, renderTodos } from './views/todos.js';

hooks.show = show;
hooks.applyMenuNames = applyMenuNames;

// 각 메뉴에 화면(render)과 데이터 연결(mount)을 붙입니다.
const VIEWS = {
  menu1: { render: renderHome, mount: mountHome },
  menu2: { render: renderDiagrams, mount: mountDiagrams },
  menu3: { render: renderBoard, mount: mountBoard },
  menu4: { render: renderDocuments, mount: mountDocuments },
  menu5: { render: renderSettings, mount: mountSettings },
  menu6: { render: renderMail, mount: mountMail },
  menu7: { render: renderTodos, mount: mountTodos },
};
MENUS.forEach((m) => Object.assign(m, VIEWS[m.id]));

/* ------------------------------------------------------------------
   새 메일 감시 — 어느 메뉴에 있든 메뉴바 배지와 브라우저 알림으로 알려 줍니다.
------------------------------------------------------------------- */
let knownMail = null;   // 이미 본 안 읽은 메일 (첫 확인 때는 알리지 않음)
function noteMail(data) {
  const unread = data.accounts.reduce((sum, a) => sum + (a.unread || 0), 0);
  const badge = $('#mailBadge');
  if (badge) { badge.textContent = unread > 99 ? '99+' : unread; badge.hidden = !unread; }
  const fresh = [];
  const seen = new Set();
  data.accounts.forEach((a) => a.messages.forEach((m) => {
    if (!m.unread || !m.uid) return;
    const key = `${a.id}:${m.uid}`;
    seen.add(key);
    if (knownMail && !knownMail.has(key)) fresh.push(m);
  }));
  // 계정을 아직 한 번도 확인하지 못한 상태는 기준으로 삼지 않습니다.
  if (data.accounts.every((a) => a.checked_at)) knownMail = knownMail ? new Set([...knownMail, ...seen]) : seen;
  if (!fresh.length) return;
  const title = fresh.length === 1 ? `새 메일: ${fresh[0].from}` : `새 메일 ${fresh.length}통`;
  toast(`${title} — ${fresh[0].subject}`);
  if ('Notification' in window && Notification.permission === 'granted') {
    const n = new Notification(title, { body: fresh[0].subject, tag: 'dashboard-mail' });
    n.onclick = () => { window.focus(); location.hash = '#menu6'; n.close(); };
  }
}
async function watchMail() {
  try { noteMail(await api('/mail')); } catch (e) { /* 다음 주기에 다시 */ }
}

/* ------------------------------------------------------------------
   Menu 6: 메일 — 네이버 · Gmail 받은편지함의 새 메일 확인 (읽기 전용)
------------------------------------------------------------------- */
const MAIL_POLL_MS = 15000;   // 화면 갱신 주기 (서버는 1분마다 메일 서버를 확인)

function renderMail(menu) {
  return `
    <header class="page-head">
      <div>
        <p class="eyebrow">${esc(menu.label)}</p>
        <h1 class="page-title">메일</h1>
        <p class="page-desc">네이버와 Gmail 받은편지함의 새 메일을 한곳에서 확인해요.</p>
      </div>
      <div class="row-actions">
        <button class="btn btn-ghost" type="button" id="mailNotify" hidden>${icon('bell')} 새 메일 알림 켜기</button>
        <button class="btn btn-soft" type="button" id="mailRefresh">${icon('refresh')} 지금 확인</button>
      </div>
    </header>
    <div id="mailAccounts"><p class="empty-inline">불러오는 중…</p></div>
    <form class="card" id="mailForm" style="margin-top:16px" autocomplete="off">
      <div class="card-head"><h2 class="card-title">계정 추가</h2></div>
      <div class="mail-form">
        <select class="field" id="mailProvider" aria-label="메일 종류">
          <option value="naver">네이버</option>
          <option value="gmail">Gmail</option>
        </select>
        <input class="field" id="mailEmail" type="email" placeholder="메일 주소" aria-label="메일 주소" autocomplete="off" required>
        <input class="field" id="mailPass" type="password" placeholder="앱 비밀번호" aria-label="앱 비밀번호" autocomplete="new-password" required>
        <button class="btn btn-blue" type="submit" id="mailSave">연결</button>
      </div>
      <p class="card-note" id="mailHelp"></p>
    </form>`;
}

const MAIL_HELP = {
  naver: '네이버 메일 → 환경설정 → POP3/IMAP 설정에서 "IMAP/SMTP 사용함"으로 바꿔야 해요. 2단계 인증을 쓰고 있으면 네이버ID → 보안설정 → 2단계 인증 관리에서 만든 "애플리케이션 비밀번호"를 입력하세요.',
  gmail: 'Google 계정에서 2단계 인증을 켠 뒤 myaccount.google.com/apppasswords 에서 만든 16자리 "앱 비밀번호"를 입력하세요. 평소 로그인 비밀번호로는 연결되지 않아요.',
};

function mountMail() {
  const box = $('#mailAccounts');
  let data = null;
  let openKey = null;       // 본문을 펼쳐 둔 메일 (계정:UID)
  const bodies = {};        // 이미 받아 온 본문

  const notifyBtn = $('#mailNotify');
  notifyBtn.hidden = !('Notification' in window) || Notification.permission === 'granted';
  notifyBtn.addEventListener('click', async () => {
    const result = await Notification.requestPermission();
    notifyBtn.hidden = result === 'granted';
    toast(result === 'granted' ? '새 메일이 오면 알림을 띄울게요' : '브라우저에서 알림이 차단돼 있어요. 주소창의 사이트 설정에서 허용해 주세요.', result !== 'granted');
  });

  const draw = () => {
    if (!box.isConnected || !data) return;
    if (!data.accounts.length) {
      box.innerHTML = `<section class="card"><div class="empty"><div class="empty-art">${icon('mail')}</div><h2>연결된 메일 계정이 없어요</h2><p>아래에서 계정을 추가하면 새 메일이 여기에 표시됩니다.</p></div></section>`;
      return;
    }
    box.innerHTML = data.accounts.map((a) => {
      const prov = data.providers[a.provider] || { label: a.provider, web: '#' };
      const rows = a.messages.length ? a.messages.map((m) => {
        const key = `${a.id}:${m.uid}`, open = key === openKey;
        return `
        <li class="mail-item">
          <button class="row mail-row${m.unread ? ' unread' : ''}" type="button" data-mail="${key}" aria-expanded="${open}" ${m.uid ? '' : 'disabled'}>
            <span class="dot" aria-hidden="true"></span>
            <span class="row-main">
              <span class="row-title" title="${esc(m.subject)}">${m.unread ? '<span class="sr">안 읽음: </span>' : ''}${esc(m.subject)}</span>
              <span class="row-sub" title="${esc(m.from_addr)}">${esc(m.from)}${m.date ? ` · ${fmtDateTime(m.date)}` : ''}</span>
            </span>
          </button>
          ${open ? `<pre class="mail-body">${esc(bodies[key] ?? '불러오는 중…')}</pre>` : ''}
        </li>`; }).join('') : `<li class="empty-inline">${a.checked_at ? '받은편지함이 비어 있어요.' : '확인하는 중…'}</li>`;
      return `
        <section class="card mail-card">
          <div class="card-head">
            <div class="mail-head">
              <span class="ext-badge mail-${esc(a.provider)}">${esc(prov.label.slice(0, 1))}</span>
              <div>
                <h2 class="card-title">${esc(a.email)}</h2>
                <p class="row-sub">${esc(prov.label)}${a.checked_at ? ` · ${fmtTime(a.checked_at)} 확인` : ''}</p>
              </div>
            </div>
            <div class="row-actions">
              <span class="chip ${a.unread ? 'add' : ''}">안 읽음 ${numFmt.format(a.unread)}</span>
              <a class="btn btn-soft btn-sm" href="${esc(prov.web)}" target="_blank" rel="noopener noreferrer">메일함 열기</a>
              <button class="btn btn-ghost btn-sm" type="button" data-del="${a.id}" aria-label="${esc(a.email)} 연결 해제">${icon('trash')}<span>해제</span></button>
            </div>
          </div>
          ${a.error ? `<p class="mail-error">${esc(a.error)}</p>` : ''}
          <ul class="rows">${rows}</ul>
        </section>`;
    }).join('');
  };

  const load = async () => {
    if (document.hidden) return;
    try { data = await api('/mail'); draw(); noteMail(data); }
    catch (e) { if (!data && box.isConnected) box.innerHTML = `<p class="empty-inline">${esc(e.message)}</p>`; }
  };
  load();
  every(MAIL_POLL_MS, load);

  const refresh = $('#mailRefresh');
  refresh.addEventListener('click', async () => {
    refresh.disabled = true;
    try { data = await api('/mail/refresh', { method: 'POST' }); draw(); noteMail(data); toast('메일을 확인했어요'); }
    catch (e) { toast(e.message, true); }
    refresh.disabled = false;
  });

  box.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-mail]');
    if (row) {
      const key = row.dataset.mail;
      openKey = openKey === key ? null : key;
      draw();
      if (openKey && bodies[key] === undefined) {
        const [acc, uid] = key.split(':');
        try { bodies[key] = (await api(`/mail/${acc}/message?uid=${uid}`)).text || '(본문이 없어요)'; }
        catch (err) { toast(err.message, true); if (openKey === key) openKey = null; }
        draw();
      }
      return;
    }
    const btn = e.target.closest('[data-del]');
    if (!btn) return;
    const acc = data.accounts.find((a) => a.id === btn.dataset.del);
    if (!acc) return;
    if (!(await confirmDelete(acc.email, '계정 연결', '해제'))) return;
    try { await api(`/mail/${acc.id}`, { method: 'DELETE' }); toast('계정 연결을 해제했어요'); await load(); }
    catch (err) { toast(err.message, true); }
  });

  const provider = $('#mailProvider');
  const help = () => { $('#mailHelp').textContent = MAIL_HELP[provider.value]; };
  provider.addEventListener('change', help);
  help();

  $('#mailForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const save = $('#mailSave');
    save.disabled = true; save.textContent = '연결 중…';
    try {
      data = await api('/mail/accounts', jsonBody({ provider: provider.value, email: $('#mailEmail').value.trim(), password: $('#mailPass').value }));
      $('#mailEmail').value = ''; $('#mailPass').value = '';
      draw();
      toast('메일 계정을 연결했어요');
    } catch (err) { toast(err.message, true); }
    save.disabled = false; save.textContent = '연결';
  });
}

/* ------------------------------------------------------------------
   내용이 아직 없는 메뉴
------------------------------------------------------------------- */
function renderEmpty(menu) {
  return `
    <header class="page-head">
      <div>
        <p class="eyebrow">${esc(menu.label)}</p>
        <h1 class="page-title">${esc(menu.label)}</h1>
        <p class="page-desc">이 메뉴의 설명이 들어갈 자리입니다.</p>
      </div>
    </header>
    <section class="card">
      <div class="empty">
        <div class="empty-art">${icon(menu.icon)}</div>
        <h2>아직 내용이 없어요</h2>
        <p>기능을 추가하면 이 화면에 표시됩니다.</p>
      </div>
    </section>`;
}

/* ------------------------------------------------------------------
   화면 전환
------------------------------------------------------------------- */
const app = $('#app');
const nav = $('#nav');
const main = $('#main');
const scrim = $('#scrim');
const menuBtn = $('#menuBtn');
const collapseBtn = $('#collapseBtn');

function drawNav() {
  const current = MENUS.find((m) => m.id === location.hash.slice(1).split('?')[0]) || MENUS[0];
  const badge = $('#mailBadge');
  const item = (m) => `
    <a class="nav-item" href="#${m.id}" data-id="${m.id}" title="${esc(m.label)}" ${m === current ? 'aria-current="page"' : ''}>
      ${icon(m.icon)}<span class="nav-text">${esc(m.label)}</span>${m.id === 'menu6' ? `<span class="nav-badge" id="mailBadge" ${badge && !badge.hidden ? '' : 'hidden'}>${badge ? badge.textContent : ''}</span>` : ''}
    </a>`;
  nav.innerHTML = MENUS.filter((m) => !m.foot).map(item).join('');
  $('#footNav').innerHTML = MENUS.filter((m) => m.foot).map(item).join('');
  // 상단 주 메뉴 바 (설정 메뉴까지 전부)
  $('#topNav').innerHTML = MENUS.map((m) => `
    <a class="topnav-item" href="#${m.id}" data-id="${m.id}" ${m === current ? 'aria-current="page"' : ''}>${icon(m.icon)}<span>${esc(m.label)}</span></a>`).join('');
}
// 설정에서 바꾼 메뉴 이름을 적용
function applyMenuNames() {
  MENUS.forEach((m) => { m.label = (config.menus || {})[m.id] || m.base; });
  drawNav();
}
drawNav();

function route() {
  const [id, query = ''] = location.hash.slice(1).split('?');
  return { menu: MENUS.find((m) => m.id === id) || MENUS[0], params: new URLSearchParams(query) };
}

function show() {
  const { menu, params } = route();
  runCleanups();
  document.querySelectorAll('#sidebar .nav-item, #topNav .topnav-item').forEach((a) => {
    if (a.dataset.id === menu.id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  main.classList.toggle('wide', Boolean(menu.wide));
  ctxTitle.textContent = menu.label;
  setSubTabs(null);
  main.innerHTML = `<div class="view">${(menu.render || renderEmpty)(menu)}</div>`;
  document.title = `${menu.label} · My Site`;
  setDrawer(false);
  if (menu.mount) menu.mount(menu, params);
}

const ctxTitle = $('#ctxTitle');
$('#backBtn').addEventListener('click', () => history.back());
$('#fwdBtn').addEventListener('click', () => history.forward());
const sbClock = $('#sbClock');
const tickStatus = () => { sbClock.textContent = new Date().toLocaleString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' }); };
tickStatus();
setInterval(tickStatus, 30000);

// 좁은 화면: 메뉴바를 서랍처럼 열고 닫기
function setDrawer(open) {
  app.classList.toggle('nav-open', open);
  scrim.hidden = !open;
  menuBtn.setAttribute('aria-expanded', String(open));
}
menuBtn.addEventListener('click', () => setDrawer(!app.classList.contains('nav-open')));
scrim.addEventListener('click', () => setDrawer(false));

// 넓은 화면: 메뉴바를 아이콘만 남기고 접기 (선택은 브라우저에 기억)
function setCollapsed(on) {
  app.classList.toggle('collapsed', on);
  collapseBtn.setAttribute('aria-pressed', String(on));
  collapseBtn.querySelector('.nav-text').textContent = on ? '이름 표시' : '이름 숨기기';
  try { localStorage.setItem('sidebar-collapsed', on ? '1' : '0'); } catch (e) { /* 저장 불가 환경은 무시 */ }
}
collapseBtn.addEventListener('click', () => setCollapsed(!app.classList.contains('collapsed')));
// FM27 북마크 바처럼 기본은 아이콘만, 이름 표시는 사용자가 켜면 기억
let startCollapsed = true;
try { if (localStorage.getItem('sidebar-collapsed') === '0') startCollapsed = false; } catch (e) { /* 무시 */ }
setCollapsed(startCollapsed);

/* ------------------------------------------------------------------
   주간 / 야간 모드
------------------------------------------------------------------- */
$('#themeBtn').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) { /* 무시 */ }
});

/* ------------------------------------------------------------------
   검색: 메뉴 이름 + 등록된 파일 이름
------------------------------------------------------------------- */
const searchInput = $('#searchInput');
const searchPanel = $('#searchPanel');
let searchSeq = 0, searchTimer;

function closeSearch() { searchPanel.hidden = true; }

async function runSearch() {
  const term = searchInput.value.trim();
  const seq = ++searchSeq;
  if (!term) return closeSearch();

  const menus = MENUS.filter((m) => m.label.toLowerCase().includes(term.toLowerCase()));
  let files = [], posts = [], error = '';
  try { ({ files, posts = [] } = await api(`/search?q=${encodeURIComponent(term)}`)); } catch (e) { error = e.message; }
  if (seq !== searchSeq) return; // 더 최근 검색이 있음

  const menuLabel = (id) => MENUS.find((m) => m.id === id)?.label || '';
  let html = '';
  if (menus.length) {
    html += '<p class="search-group">메뉴</p>' + menus.map((m) => `
      <a class="search-item" href="#${m.id}"><span class="mini-icon">${icon(m.icon)}</span><span><b>${esc(m.label)}</b><small>메뉴로 이동</small></span></a>`).join('');
  }
  if (files.length) {
    html += '<p class="search-group">파일</p>' + files.map((f) => `
      <a class="search-item" href="#${KIND_MENU[f.kind]}?file=${f.id}">${extBadge(f.ext)}<span><b>${esc(f.kind === 'diagram' ? dgTitle(f) : f.name)}</b><small>${esc(menuLabel(KIND_MENU[f.kind]))} · ${esc(KIND_LABEL[f.kind])} · ${fmtDateTime(f.created_at)}</small></span></a>`).join('');
  }
  if (posts.length) {
    html += '<p class="search-group">게시글</p>' + posts.map((p) => `
      <a class="search-item" href="#menu3?post=${p.id}"><span class="mini-icon">${icon('note')}</span><span><b>${esc(p.title)}</b><small>${esc(menuLabel('menu3'))} · 게시글 · ${fmtDateTime(p.created_at)}</small></span></a>`).join('');
  }
  searchPanel.innerHTML = html || `<p class="search-empty">${esc(error || `"${term}"에 맞는 결과가 없어요`)}</p>`;
  searchPanel.hidden = false;
}

searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 180); });
searchInput.addEventListener('focus', () => { if (searchInput.value.trim()) runSearch(); });
searchInput.addEventListener('keydown', (e) => {
  const items = [...searchPanel.querySelectorAll('.search-item')];
  const idx = items.findIndex((el) => el.classList.contains('active'));
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!items.length) return;
    e.preventDefault();
    const next = (idx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items.forEach((el, i) => el.classList.toggle('active', i === next));
    items[next].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    const pick = items[idx] || items[0];
    if (pick && !searchPanel.hidden) { e.preventDefault(); pick.click(); }
  }
});
searchPanel.addEventListener('click', (e) => {
  if (e.target.closest('.search-item')) { closeSearch(); searchInput.value = ''; searchInput.blur(); }
});
document.addEventListener('click', (e) => { if (!e.target.closest('#searchWrap')) closeSearch(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeSearch(); setDrawer(false); }
  if (e.key === '/' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) { e.preventDefault(); searchInput.focus(); }
});

/* ------------------------------------------------------------------
   시작
------------------------------------------------------------------- */
/* ------------------------------------------------------------------
   로그아웃 · 자동 로그아웃
------------------------------------------------------------------- */
$('#logoutBtn').addEventListener('click', async () => {
  try { await api('/logout', { method: 'POST' }); } catch (e) { /* 그래도 로그인 화면으로 */ }
  toLogin();
});
api('/session').then((s) => {
  if (!s.authenticated) return toLogin();
  // 로그인 6시간 뒤 만료 시각에 맞춰 화면을 닫습니다.
  setTimeout(toLogin, Math.min(Math.max(0, s.expires * 1000 - Date.now()) + 1000, 2 ** 31 - 1));
}).catch(() => {});

window.addEventListener('hashchange', show);
api('/config').then((c) => { Object.assign(config, c); applyMenuNames(); }).catch(() => {}).finally(show);
watchMail();
setInterval(watchMail, 30000);

// 진입점: 모듈을 불러오고 셸을 시작합니다.
import { api, toLogin } from './core/api.js';
import { setSubTabs } from './core/chrome.js';
import { $, esc } from './core/dom.js';
import { extBadge, fmtDateTime } from './core/format.js';
import { hooks } from './core/hooks.js';
import { icon } from './core/icons.js';
import { KIND_LABEL, KIND_MENU, MENUS } from './core/registry.js';
import { config, runCleanups } from './core/state.js';
import { mountBoard, renderBoard } from './views/board.js';
import { dgTitle, mountDiagrams, renderDiagrams } from './views/diagrams.js';
import { mountDocuments, renderDocuments } from './views/documents.js';
import { renderEmpty } from './views/empty.js';
import { mountHome, renderHome } from './views/home.js';
import { mountMail, renderMail, watchMail } from './views/mail.js';
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

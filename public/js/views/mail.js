// Menu 6: 메일과 새 메일 감시
import { api, jsonBody } from '../core/api.js';
import { confirmDelete } from '../core/dialogs.js';
import { $, esc, toast } from '../core/dom.js';
import { fmtDateTime, fmtTime, numFmt } from '../core/format.js';
import { icon } from '../core/icons.js';
import { every } from '../core/state.js';

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

export { mountMail, renderMail, watchMail };

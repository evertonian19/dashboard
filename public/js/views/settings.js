// Menu 5: 설정
import { api, jsonBody } from '../core/api.js';
import { confirmDelete } from '../core/dialogs.js';
import { $, esc, fill, toast } from '../core/dom.js';
import { extBadge, fmtBytes, fmtDateTime } from '../core/format.js';
import { hooks } from '../core/hooks.js';
import { icon } from '../core/icons.js';
import { KIND_LABEL, MENUS } from '../core/registry.js';
import { config } from '../core/state.js';

/* ------------------------------------------------------------------
   Menu 5: 설정 — 메뉴 이름 · 날씨 지역 · 휴지통 · 로그인 기록
------------------------------------------------------------------- */
function renderSettings(menu) {
  return `
    <header class="page-head">
      <div>
        <p class="eyebrow">${esc(menu.label)}</p>
        <h1 class="page-title">설정</h1>
      </div>
    </header>
    <form class="card" id="menuForm">
      <div class="card-head"><h2 class="card-title">메뉴 이름</h2><button class="btn btn-blue btn-sm" type="submit">저장</button></div>
      <div class="menu-names">${MENUS.map((m) => `
        <label><span>${icon(m.icon)} ${esc(m.base)}</span><input class="field" type="text" name="${m.id}" maxlength="20" value="${esc(m.label)}" placeholder="${esc(m.base)}"></label>`).join('')}</div>
      <p class="card-note">비워 두면 원래 이름으로 돌아갑니다.</p>
    </form>
    <form class="card" id="cityForm" style="margin-top:16px">
      <div class="card-head"><h2 class="card-title">날씨 지역</h2><span class="muted" id="cityNow"></span></div>
      <div class="inline-form" style="margin-top:0">
        <input class="field" id="cityName" type="text" maxlength="40" placeholder="도시 이름 (예: 대구)" aria-label="도시 이름" autocomplete="off" required>
        <button class="btn btn-soft" type="submit">변경</button>
      </div>
    </form>
    <section class="card" style="margin-top:16px">
      <div class="card-head"><h2 class="card-title">휴지통</h2><button class="btn btn-ghost btn-sm" type="button" id="trashEmpty" hidden>휴지통 비우기</button></div>
      <ul class="rows" id="trash"><li class="empty-inline">불러오는 중…</li></ul>
      <p class="card-note">삭제한 파일과 게시글은 ${config.trash_days || 30}일 동안 보관된 뒤 자동으로 완전히 삭제됩니다.</p>
    </section>
    <section class="card" style="margin-top:16px">
      <div class="card-head"><h2 class="card-title">로그인 기록</h2><span class="muted">최근 30건</span></div>
      <ul class="rows" id="logins"><li class="empty-inline">불러오는 중…</li></ul>
    </section>`;
}

function mountSettings() {
  $('#menuForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const labels = {};
    new FormData(e.target).forEach((v, k) => { if (String(v).trim()) labels[k] = String(v).trim(); });
    try {
      config.menus = (await api('/settings/menus', jsonBody({ labels }))).menus;
      hooks.applyMenuNames();
      hooks.show();
      toast('메뉴 이름을 저장했어요');
    } catch (err) { toast(err.message, true); }
  });

  api('/weather').then((w) => { if ($('#cityNow')) $('#cityNow').textContent = `현재: ${w.city}`; }).catch(() => {});
  $('#cityForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const w = await api('/settings/weather', jsonBody({ city: $('#cityName').value }));
      $('#cityNow').textContent = `현재: ${w.city}`;
      $('#cityName').value = '';
      toast(`날씨 지역을 ${w.city}(으)로 바꿨어요`);
    } catch (err) { toast(err.message, true); }
  });

  let items = [];
  const loadTrash = async () => {
    try {
      items = (await api('/trash')).items;
      if (!$('#trash')) return;
      $('#trashEmpty').hidden = !items.length;
      $('#trash').innerHTML = items.length ? items.map((t, i) => `
        <li class="row">
          ${t.type === 'file' ? extBadge(t.name.includes('.') ? t.name.split('.').pop() : '') : `<span class="mini-icon">${icon('note')}</span>`}
          <div class="row-main">
            <p class="row-title" title="${esc(t.name)}">${esc(t.name)}</p>
            <p class="row-sub">${esc(KIND_LABEL[t.kind] || '첨부')}${t.type === 'file' ? ` · ${fmtBytes(t.size)}` : ''} · ${fmtDateTime(t.deleted_at)} 삭제</p>
          </div>
          <div class="row-actions">
            <button class="btn btn-soft btn-sm" type="button" data-restore="${i}">${icon('restore')}<span>복구</span></button>
            <button class="btn btn-ghost btn-sm" type="button" data-purge="${i}">${icon('trash')}<span>완전 삭제</span></button>
          </div>
        </li>`).join('') : '<li class="empty-inline">휴지통이 비어 있어요.</li>';
    } catch (e) { fill('#trash', `<li class="empty-inline">${esc(e.message)}</li>`); }
  };
  $('#trash').addEventListener('click', async (e) => {
    const restore = e.target.closest('[data-restore]'), purge = e.target.closest('[data-purge]');
    const item = items[(restore || purge)?.dataset[restore ? 'restore' : 'purge']];
    if (!item) return;
    try {
      if (restore) { await api('/trash/restore', jsonBody({ type: item.type, id: item.id })); toast(`${item.name} 복구했어요`); }
      else if (await confirmDelete(item.name, '영구 삭제')) { await api(`/trash/${item.type}/${item.id}`, { method: 'DELETE' }); toast('완전히 삭제했어요'); }
      else return;
      loadTrash();
    } catch (err) { toast(err.message, true); }
  });
  $('#trashEmpty').addEventListener('click', async () => {
    if (!(await confirmDelete('', '휴지통 비우기', '비우기'))) return;
    try { await api('/trash', { method: 'DELETE' }); toast('휴지통을 비웠어요'); loadTrash(); }
    catch (err) { toast(err.message, true); }
  });
  loadTrash();

  api('/logins').then(({ logins }) => fill('#logins', logins.length ? logins.map((l) => `
    <li class="row">
      <span class="chip ${l.ok ? 'add' : 'del'}">${l.ok ? '성공' : '실패'}</span>
      <div class="row-main">
        <p class="row-title">${esc(l.username || '(빈 아이디)')}</p>
        <p class="row-sub">${fmtDateTime(l.at)} · ${esc(l.ip)}</p>
      </div>
    </li>`).join('') : '<li class="empty-inline">기록이 없어요.</li>'))
    .catch((e) => fill('#logins', `<li class="empty-inline">${esc(e.message)}</li>`));
}

export { mountSettings, renderSettings };

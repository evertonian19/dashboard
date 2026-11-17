// Menu 1: 메인 대시보드
import { api, jsonBody } from '../core/api.js';
import { confirmDelete } from '../core/dialogs.js';
import { $, errLine, esc, fill, toast } from '../core/dom.js';
import { fmtBytes, fmtDateTime, numFmt } from '../core/format.js';
import { hooks } from '../core/hooks.js';
import { icon } from '../core/icons.js';
import { KIND_LABEL, menuName } from '../core/registry.js';
import { config, every, lifecycle } from '../core/state.js';
import { todoRow, wireTodos } from './todos.js';
import { USAGE_POLL_MS, loadUsage, tickUsage } from './usage.js';

/* ------------------------------------------------------------------
   Menu 1: 메인 대시보드
------------------------------------------------------------------- */
function renderHome(menu) {
  return `
    <header class="page-head">
      <div>
        <p class="eyebrow">${esc(menu.label)}</p>
        <h1 class="page-title" id="greeting">안녕하세요</h1>
      </div>
      <div class="clock" aria-live="off">
        <p class="clock-time" id="clockTime">--:--</p>
        <p class="clock-date" id="clockDate"></p>
        <button class="btn btn-ghost btn-sm" type="button" id="homeEdit">${icon('gear')} 화면 편집</button>
      </div>
    </header>

    <section class="hero" id="usage" data-card="usage" aria-label="Claude 사용량">
      <div><p class="hero-kicker">Claude 사용량</p><h2 class="hero-title">불러오는 중…</h2></div>
    </section>

    <section class="grid" id="homeGrid">
      <a class="card" href="#menu2" data-card="diagram">
        <div class="card-icon">${icon('grid')}</div>
        <p class="card-label">다이어그램</p>
        <p class="card-value" id="statDiagram">—</p>
        <p class="card-note">${esc(menuName('menu2'))}에서 관리</p>
      </a>
      <a class="card" href="#menu4" data-card="document">
        <div class="card-icon">${icon('folder')}</div>
        <p class="card-label">문서</p>
        <p class="card-value" id="statDocument">—</p>
        <p class="card-note">${esc(menuName('menu4'))}에서 관리</p>
      </a>
      <article class="card" data-card="size">
        <div class="card-icon">${icon('disk')}</div>
        <p class="card-label">저장 용량</p>
        <p class="card-value" id="statSize">—</p>
        <p class="card-note">등록된 파일 합계</p>
      </article>

      <article class="card span-2" data-card="todos">
        <div class="card-head"><h2 class="card-title">오늘 할 일</h2><a class="btn btn-ghost btn-sm" href="#menu7">전체 보기</a></div>
        <ul class="rows" id="homeTodos"><li class="empty-inline">불러오는 중…</li></ul>
        <form class="inline-form" id="homeTodoForm">
          <input class="field" id="homeTodoTitle" type="text" maxlength="200" placeholder="오늘 할 일 추가" aria-label="오늘 할 일 추가" autocomplete="off">
          <button class="btn btn-soft" type="submit">추가</button>
        </form>
      </article>
      <article class="card" id="weatherCard" data-card="weather">
        <div class="card-head"><h2 class="card-title">날씨</h2><span class="muted" id="weatherCity"></span></div>
        <div id="weather"><p class="empty-inline">불러오는 중…</p></div>
      </article>

      <article class="card span-2" data-card="links">
        <div class="card-head"><h2 class="card-title">즐겨찾기</h2></div>
        <div class="link-tiles" id="links"></div>
        <p class="muted link-hint" id="linkHint" hidden>타일을 끌어서 순서를 바꿀 수 있어요</p>
        <form class="inline-form" id="linkForm">
          <input class="field" id="linkTitle" type="text" maxlength="40" placeholder="이름" aria-label="즐겨찾기 이름" autocomplete="off">
          <input class="field" id="linkUrl" type="text" placeholder="주소 (예: naver.com)" aria-label="즐겨찾기 주소" autocomplete="off" required>
          <button class="btn btn-soft" type="submit">추가</button>
        </form>
      </article>
      <article class="card" data-card="system">
        <div class="card-head"><h2 class="card-title">서버 상태</h2><span class="muted" id="sysUp"></span></div>
        <div id="system"><p class="empty-inline">불러오는 중…</p></div>
      </article>

      <article class="card span-2" data-card="memos">
        <div class="card-head"><h2 class="card-title">메모</h2></div>
        <form class="inline-form" id="memoForm">
          <textarea class="field" id="memoText" rows="2" maxlength="5000" placeholder="메모를 적으세요 (Ctrl+Enter로 추가)" aria-label="새 메모"></textarea>
          <button class="btn btn-soft" type="submit">추가</button>
        </form>
        <div class="memos" id="memos"></div>
      </article>
      <article class="card" data-card="oci">
        <div class="card-head"><h2 class="card-title">Oracle VM</h2><span id="ociChip"></span></div>
        <div id="oci"><p class="empty-inline">불러오는 중…</p></div>
      </article>

      <article class="card span-2" data-card="activity">
        <div class="card-head"><h2 class="card-title">최근 활동</h2><button class="btn btn-ghost btn-sm" type="button" id="activityClear" hidden>모두 지우기</button></div>
        <ul class="rows" id="activity"><li class="empty-inline">불러오는 중…</li></ul>
      </article>

      <article class="card" data-card="tokens">
        <div class="card-head"><h2 class="card-title">최근 7일 토큰</h2></div>
        <div class="bars" id="bars"></div>
        <p class="card-note" id="barsNote"></p>
      </article>
    </section>`;
}

// 메인 화면 카드: [id, 이름]. Claude 사용량은 항상 맨 위이고 숨기기만 됩니다.
const HOME_CARDS = [['usage', 'Claude 사용량'], ['diagram', '다이어그램 수'], ['document', '문서 수'], ['size', '저장 용량'],
  ['todos', '오늘 할 일'], ['weather', '날씨'], ['links', '즐겨찾기'], ['system', '서버 상태'], ['memos', '메모'],
  ['oci', 'Oracle VM'], ['activity', '최근 활동'], ['tokens', '최근 7일 토큰']];
const homeLayout = () => {
  const saved = config.home || {};
  const ids = HOME_CARDS.map(([id]) => id);
  const order = [...(saved.order || []).filter((id) => ids.includes(id)), ...ids.filter((id) => !(saved.order || []).includes(id))];
  return { order, hidden: new Set(saved.hidden || []) };
};
const cardOn = (id) => !homeLayout().hidden.has(id);

function applyHomeLayout() {
  const grid = $('#homeGrid');
  if (!grid) return;
  const { order, hidden } = homeLayout();
  order.forEach((id) => {
    const el = document.querySelector(`[data-card="${id}"]`);
    if (!el) return;
    el.hidden = hidden.has(id);
    if (id !== 'usage') grid.appendChild(el);   // 저장된 순서대로 다시 배치
  });
  grid.hidden = order.every((id) => id === 'usage' || hidden.has(id));
}

function openHomeEditor() {
  const dlg = $('#homeDialog');
  const list = $('#homeCardList');
  const name = Object.fromEntries(HOME_CARDS);
  let { order, hidden } = homeLayout();
  const draw = (focusId, dir) => {
    const movable = order.filter((id) => id !== 'usage');
    list.innerHTML = ['usage', ...movable].map((id) => {
      const i = movable.indexOf(id);
      return `
      <li class="row">
        <input type="checkbox" class="check" id="hc-${id}" data-show="${id}" ${hidden.has(id) ? '' : 'checked'}>
        <label class="row-main" for="hc-${id}"><span class="row-title">${name[id]}</span>${id === 'usage' ? '<span class="row-sub">항상 맨 위</span>' : ''}</label>
        ${id === 'usage' ? '' : `
        <button class="icon-btn icon-btn-sm" type="button" data-move="${id}" data-dir="-1" aria-label="${name[id]} 위로" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
        <button class="icon-btn icon-btn-sm" type="button" data-move="${id}" data-dir="1" aria-label="${name[id]} 아래로" ${i === movable.length - 1 ? 'disabled' : ''}>${icon('down')}</button>`}
      </li>`; }).join('');
    // 옮긴 뒤에도 같은 카드의 버튼에 포커스를 유지 (끝에 닿아 비활성화되면 반대쪽 버튼으로)
    if (focusId) (list.querySelector(`[data-move="${focusId}"][data-dir="${dir}"]:not([disabled])`) || list.querySelector(`[data-move="${focusId}"]:not([disabled])`))?.focus();
  };
  draw();
  list.onchange = (e) => {
    const box = e.target.closest('[data-show]');
    if (box) { if (box.checked) hidden.delete(box.dataset.show); else hidden.add(box.dataset.show); }
  };
  list.onclick = (e) => {
    const btn = e.target.closest('[data-move]');
    if (!btn) return;
    const movable = order.filter((id) => id !== 'usage');
    const i = movable.indexOf(btn.dataset.move), j = i + Number(btn.dataset.dir);
    if (j < 0 || j >= movable.length) return;
    [movable[i], movable[j]] = [movable[j], movable[i]];
    order = ['usage', ...movable];
    draw(btn.dataset.move, btn.dataset.dir);
  };
  dlg.onclick = async (e) => {
    const todo = e.target.closest('[data-do]')?.dataset.do;
    if (e.target === dlg || todo === 'cancel') return dlg.close();
    if (todo === 'reset') { order = HOME_CARDS.map(([id]) => id); hidden = new Set(); draw(); }
    if (todo === 'save') {
      try {
        config.home = (await api('/settings/home', jsonBody({ order, hidden: [...hidden] }))).home;
        dlg.close();
        hooks.show();
        toast('메인 화면 구성을 저장했어요');
      } catch (err) { toast(err.message, true); }
    }
  };
  dlg.showModal();
}

function mountHome() {
  applyHomeLayout();
  $('#homeEdit').addEventListener('click', openHomeEditor);
  const tickClock = () => {
    const now = new Date();
    const h = now.getHours();
    $('#greeting').textContent = h < 5 ? '늦은 밤이에요' : h < 12 ? '좋은 아침이에요' : h < 18 ? '좋은 오후예요' : '좋은 저녁이에요';
    $('#clockTime').textContent = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    $('#clockDate').textContent = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  };
  tickClock();
  every(1000, tickClock);

  $('#activity').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    try { await api(`/activity/${btn.dataset.act}`, { method: 'DELETE' }); await loadSummary(); }
    catch (err) { toast(err.message, true); }
  });
  $('#activityClear').addEventListener('click', async () => {
    if (!(await confirmDelete('최근 활동', '기록 전체'))) return;
    try { await api('/activity', { method: 'DELETE' }); await loadSummary(); toast('활동 기록을 모두 지웠어요'); }
    catch (err) { toast(err.message, true); }
  });

  // 오늘 할 일: 기한이 오늘이거나 지난 것, 그다음 기한 없는 것
  const loadTodos = async () => {
    try {
      const { todos, today } = await api('/todos');
      const open = todos.filter((t) => !t.done);
      const pick = [...open.filter((t) => t.due && t.due <= today), ...open.filter((t) => !t.due)].slice(0, 8);
      const later = open.length - pick.length;
      fill('#homeTodos', pick.length ? pick.map((t) => todoRow(t, today)).join('') + (later > 0 ? `<li class="empty-inline">그 외 ${later}개는 전체 보기에서 확인하세요.</li>` : '')
        : `<li class="empty-inline">${open.length ? `오늘 할 일은 없어요. 예정된 일 ${open.length}개.` : '할 일이 없어요.'}</li>`);
    } catch (e) { fill('#homeTodos', `<li class="empty-inline">${esc(e.message)}</li>`); }
  };
  wireTodos($('#homeTodos'), loadTodos);
  $('#homeTodoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#homeTodoTitle');
    if (!input.value.trim()) return;
    try {
      const { today } = await api('/todos');
      await api('/todos', jsonBody({ title: input.value.trim(), due: today }));
      input.value = '';
      loadTodos();
    } catch (err) { toast(err.message, true); }
  });

  // 즐겨찾기
  // 순서는 이 브라우저에만 저장 (localStorage). 저장 불가 환경이면 기본 순서로 보입니다.
  const readLinkOrder = () => { try { const v = JSON.parse(localStorage.getItem('link-order')); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const writeLinkOrder = (ids) => { try { localStorage.setItem('link-order', JSON.stringify(ids)); } catch (e) { /* 무시 */ } };
  const loadLinks = async () => {
    try {
      const { links: fetched } = await api('/links');
      // 저장된 순서로 정렬 — 목록에 없는 새 링크는 맨 뒤(서버 순서 유지), 사라진 id는 정리
      const rank = new Map(readLinkOrder().map((id, i) => [id, i]));
      const at = (l, i) => (rank.has(l.id) ? rank.get(l.id) : 1e9 + i);
      const links = fetched.map((l, i) => [l, at(l, i)]).sort((a, b) => a[1] - b[1]).map(([l]) => l);
      writeLinkOrder(links.map((l) => l.id));
      const hint = $('#linkHint'); if (hint) hint.hidden = links.length < 2;
      fill('#links', links.length ? links.map((l) => `
        <div class="link-tile" draggable="true" data-id="${l.id}" title="끌어서 순서 변경">
          <a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" draggable="false" title="${esc(l.url)}">
            <span class="link-icon">${esc([...l.title][0].toUpperCase())}</span><span class="link-name">${esc(l.title)}</span>
          </a>
          <button class="icon-btn icon-btn-sm" type="button" data-link-del="${l.id}" aria-label="${esc(l.title)} 즐겨찾기 삭제" title="삭제">${icon('close')}</button>
        </div>`).join('') : '<p class="empty-inline">자주 가는 사이트를 추가해 보세요.</p>');
    } catch (e) { fill('#links', errLine(e)); }
  };
  // 마우스로 끌어서 순서 바꾸기 (타일은 다시 그려지므로 컨테이너에 이벤트 위임)
  const linksBox = $('#links');
  let dragTile = null;
  linksBox.addEventListener('dragstart', (e) => {
    const tile = e.target.closest('.link-tile');
    if (!tile) return;
    dragTile = tile;
    tile.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', tile.dataset.id); } catch (err) { /* 무시 */ }   // Firefox 는 데이터가 있어야 드래그가 시작됨
  });
  linksBox.addEventListener('dragover', (e) => {
    if (!dragTile) return;
    e.preventDefault();
    const over = e.target.closest('.link-tile');
    if (!over || over === dragTile) return;
    const r = over.getBoundingClientRect();
    const ref = e.clientX > r.left + r.width / 2 ? over.nextSibling : over;   // 가로 중앙 기준 앞/뒤
    if (ref !== dragTile) linksBox.insertBefore(dragTile, ref);
  });
  linksBox.addEventListener('drop', (e) => e.preventDefault());
  linksBox.addEventListener('dragend', () => {
    if (!dragTile) return;
    dragTile.classList.remove('dragging');
    dragTile = null;
    writeLinkOrder([...linksBox.querySelectorAll('.link-tile')].map((t) => t.dataset.id));
  });
  $('#links').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-link-del]');
    if (!btn) return;
    try { await api(`/links/${btn.dataset.linkDel}`, { method: 'DELETE' }); loadLinks(); }
    catch (err) { toast(err.message, true); }
  });
  $('#linkForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/links', jsonBody({ title: $('#linkTitle').value, url: $('#linkUrl').value }));
      $('#linkTitle').value = ''; $('#linkUrl').value = '';
      loadLinks();
    } catch (err) { toast(err.message, true); }
  });

  // 메모: 적어 둔 메모는 고친 뒤 칸 밖을 누르면 저장됩니다.
  const loadMemos = async () => {
    try {
      const { memos } = await api('/memos');
      fill('#memos', memos.map((m) => `
        <div class="memo">
          <textarea data-memo="${m.id}" rows="${Math.min(10, Math.max(3, m.body.split('\n').length))}" maxlength="5000" aria-label="메모">${esc(m.body)}</textarea>
          <div class="memo-foot"><span>${fmtDateTime(m.updated_at)}</span>
            <button class="icon-btn icon-btn-sm" type="button" data-memo-del="${m.id}" aria-label="메모 삭제" title="삭제">${icon('close')}</button></div>
        </div>`).join(''));
      document.querySelectorAll('#memos textarea').forEach((t) => { t.dataset.saved = t.value; });
    } catch (e) { fill('#memos', errLine(e)); }
  };
  $('#memos').addEventListener('focusout', async (e) => {
    const t = e.target.closest('textarea[data-memo]');
    if (!t || t.value === t.dataset.saved) return;
    if (!t.value.trim()) { t.value = t.dataset.saved; return; }
    try { await api(`/memos/${t.dataset.memo}`, jsonBody({ body: t.value })); t.dataset.saved = t.value; toast('메모를 저장했어요'); }
    catch (err) { toast(err.message, true); }
  });
  $('#memos').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-memo-del]');
    if (!btn) return;
    const body = btn.closest('.memo').querySelector('textarea').value;
    if (!(await confirmDelete(body.length > 40 ? body.slice(0, 40) + '…' : body, '메모'))) return;
    try { await api(`/memos/${btn.dataset.memoDel}`, { method: 'DELETE' }); loadMemos(); }
    catch (err) { toast(err.message, true); }
  });
  const memoForm = $('#memoForm');
  memoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = $('#memoText');
    if (!text.value.trim()) { text.focus(); return; }
    try { await api('/memos', jsonBody({ body: text.value })); text.value = ''; loadMemos(); }
    catch (err) { toast(err.message, true); }
  });
  $('#memoText').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); memoForm.requestSubmit(); } });

  // 숨긴 카드는 서버에 묻지 않습니다.
  const usageOn = cardOn('usage') || cardOn('tokens');
  const start = (on, fn, ms) => { if (!on) return; fn(); if (ms) every(ms, fn); };
  start(['diagram', 'document', 'size', 'activity'].some(cardOn), loadSummary, 30000);
  start(usageOn, loadUsage, USAGE_POLL_MS);
  if (usageOn) every(1000, tickUsage);
  start(cardOn('todos'), loadTodos);
  start(cardOn('links'), loadLinks);
  start(cardOn('memos'), loadMemos);
  start(cardOn('weather'), loadWeather, 600000);
  start(cardOn('system'), loadSystem, 5000);
  start(cardOn('oci'), loadOci, 30000);
  const onVisible = () => { if (!document.hidden && usageOn) loadUsage(); };
  document.addEventListener('visibilitychange', onVisible);
  lifecycle.cleanups.push(() => document.removeEventListener('visibilitychange', onVisible));
}

async function loadSummary() {
  try {
    const s = await api('/summary');
    if (!$('#activity')) return;
    $('#statDiagram').textContent = `${numFmt.format(s.counts.diagram.count)}개`;
    $('#statDocument').textContent = `${numFmt.format(s.counts.document.count)}개`;
    $('#statSize').textContent = fmtBytes(s.counts.diagram.size + s.counts.document.size);
    $('#activityClear').hidden = !s.activity.length;
    $('#activity').innerHTML = s.activity.length
      ? s.activity.map((a) => `
          <li class="row">
            <span class="chip ${a.action === '삭제' ? 'del' : 'add'}">${esc(a.action)}</span>
            <div class="row-main">
              <p class="row-title">${esc(a.name)}</p>
              <p class="row-sub">${esc(KIND_LABEL[a.kind] || a.kind)} · ${fmtDateTime(a.at)}</p>
            </div>
            <button class="icon-btn icon-btn-sm" type="button" data-act="${a.id}" aria-label="이 기록 지우기" title="이 기록 지우기">${icon('close')}</button>
          </li>`).join('')
      : '<li class="empty-inline">아직 기록이 없어요. 파일을 등록하면 여기에 시각과 함께 남습니다.</li>';
  } catch (e) {
    if ($('#activity')) $('#activity').innerHTML = `<li class="empty-inline">${esc(e.message)}</li>`;
  }
}

const dayName = (iso, i) => i === 0 ? '오늘' : i === 1 ? '내일' : new Date(iso + 'T00:00:00').toLocaleDateString('ko-KR', { weekday: 'short' });
async function loadWeather() {
  try {
    const w = await api('/weather');
    if (!$('#weather')) return;
    $('#weatherCity').textContent = w.city || '';
    if (w.error) { fill('#weather', `<p class="empty-inline">${esc(w.error)}</p>`); return; }
    fill('#weather', `
      <p class="weather-now"><b>${Math.round(w.current.temp)}°</b><span>${esc(w.current.text)}</span></p>
      <p class="card-note">체감 ${Math.round(w.current.feels)}° · 습도 ${Math.round(w.current.humidity)}% · 바람 ${w.current.wind.toFixed(1)}m/s</p>
      <ul class="weather-days">${w.days.map((d, i) => `
        <li><span>${dayName(d.date, i)}</span><span class="wd-text">${esc(d.text)}</span><span>${Math.round(d.min)}° / ${Math.round(d.max)}°</span><span class="wd-rain">비 ${d.rain ?? 0}%</span></li>`).join('')}</ul>`);
  } catch (e) { fill('#weather', errLine(e)); }
}

const fmtDuration = (sec) => {
  const d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60);
  return d ? `${d}일 ${h}시간` : h ? `${h}시간 ${m}분` : `${m}분`;
};
async function loadSystem() {
  if (document.hidden) return;
  try {
    const s = await api('/system');
    if (!$('#system')) return;
    const gauge = (label, pct, note) => `
      <div class="gauge"><div class="gauge-top"><span>${label}</span><span>${note}</span></div>
      <div class="gauge-bar"><i style="width:${Math.min(100, Math.max(0, pct)).toFixed(1)}%" class="${pct >= 90 ? 'hot' : ''}"></i></div></div>`;
    $('#sysUp').textContent = `가동 ${fmtDuration(s.uptime)}`;
    fill('#system',
      (s.cpu != null ? gauge('CPU', s.cpu, `${s.cpu}% · ${s.cores}코어`) : '')
      + (s.mem_total ? gauge('메모리', 100 * s.mem_used / s.mem_total, `${fmtBytes(s.mem_used)} / ${fmtBytes(s.mem_total)}`) : '')
      + gauge('디스크', 100 * s.disk_used / s.disk_total, `${fmtBytes(s.disk_used)} / ${fmtBytes(s.disk_total)}`)
      + (s.host_uptime ? `<p class="card-note">서버 켜진 지 ${fmtDuration(s.host_uptime)}</p>` : ''));
  } catch (e) { fill('#system', errLine(e)); }
}

async function loadOci() {
  try {
    const o = await api('/oci');
    if (!$('#oci')) return;
    if (!o.available) { fill('#oci', '<p class="empty-inline">이 서버에는 재시도 기록이 없어요.</p>'); return; }
    fill('#ociChip', o.success ? '<span class="chip add">생성 완료</span>' : o.running ? '<span class="chip add">재시도 중</span>' : '<span class="chip del">멈춤</span>');
    const cost = o.cost.amount != null ? `${numFmt.format(o.cost.amount)} ${esc(o.cost.currency)}` : o.cost.error ? '확인 실패' : '확인 중…';
    fill('#oci', `
      <p class="card-value">${o.attempt != null ? `${numFmt.format(o.attempt)}번째 시도` : '—'}</p>
      <p class="card-note">${esc(o.last_result || '')}${o.last_at ? ` · ${fmtDateTime(o.last_at)}` : ''}</p>
      <dl class="kv"><dt>이번 달 과금</dt><dd>${cost}</dd></dl>`);
  } catch (e) { fill('#oci', errLine(e)); }
}

export { mountHome, renderHome };

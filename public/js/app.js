/* ------------------------------------------------------------------
   메뉴 정의 — 이름을 바꾸거나 메뉴를 추가하려면 이 배열만 고치면 됩니다.
   id    : 주소에 쓰이는 값 (#menu1)
   label : 메뉴바에 보이는 이름
   icon  : 아래 ICONS 의 키
   render: 화면 틀을 HTML 문자열로 돌려주는 함수 (없으면 빈 화면)
   mount : 화면이 그려진 직후 실행 — 서버에서 데이터를 받아 채웁니다 (선택)
   wide  : true 면 본문을 화면 폭 전체로 사용
------------------------------------------------------------------- */
const ICONS = {
  home:     '<path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z"/>',
  grid:     '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  chart:    '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  folder:   '<path d="M3 7a2 2 0 012-2h4l2 2.5h8a2 2 0 012 2V17a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
  gear:     '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  plus:     '<path d="M12 5v14M5 12h14"/>',
  upload:   '<path d="M12 16V5M7 9.5L12 4.5l5 5"/><path d="M5 19h14"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5"/><path d="M5 19h14"/>',
  trash:    '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7"/>',
  note:     '<path d="M5 4h14a1 1 0 011 1v10l-5 5H5a1 1 0 01-1-1V5a1 1 0 011-1z"/><path d="M15 20v-5h5M8 9h8M8 13h5"/>',
  chat:     '<path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2h-7l-4.5 3.5V17H6a2 2 0 01-2-2z"/>',
  back:     '<path d="M14 7l-5 5 5 5"/>',
  mail:     '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7.5l8 6 8-6"/>',
  refresh:  '<path d="M19.5 12a7.5 7.5 0 11-2.3-5.4"/><path d="M19.5 4.5v4h-4"/>',
  close:    '<path d="M6 6l12 12M18 6L6 18"/>',
  check:    '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 12.2l2.5 2.5 4.5-5"/>',
  pin:      '<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/>',
  edit:     '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  link:     '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  image:    '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4"/>',
  clip:     '<path d="M19 11.5l-7.2 7.2a4.2 4.2 0 01-6-6L13 5.5a2.8 2.8 0 014 4l-7 7a1.4 1.4 0 01-2-2l6.3-6.3"/>',
  eye:      '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  bell:     '<path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z"/><path d="M10 20.5h4"/>',
  restore:  '<path d="M4.5 12a7.5 7.5 0 102.3-5.4"/><path d="M4.5 4.5v4h4"/>',
  pdf:      '<path d="M6 3.5h8l4 4V20a.5.5 0 01-.5.5h-11A.5.5 0 016 20z"/><path d="M14 3.5v4h4M9 13h6M9 16.5h4"/>',
  up:       '<path d="M6 14l6-6 6 6"/>',
  down:     '<path d="M6 10l6 6 6-6"/>',
  sort:     '<path d="M7 5v14M4 16l3 3 3-3M17 19V5M14 8l3-3 3 3"/>',
  disk:     '<ellipse cx="12" cy="6.5" rx="7.5" ry="3"/><path d="M4.5 6.5v11c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-11"/><path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

const MENUS = [
  { id: 'menu1', label: 'Menu 1', icon: 'home',   render: renderHome,      mount: mountHome },
  { id: 'menu2', label: 'Menu 2', icon: 'grid',   render: renderDiagrams,  mount: mountDiagrams },
  { id: 'menu3', label: 'Menu 3', icon: 'note',   render: renderBoard,     mount: mountBoard },
  { id: 'menu4', label: 'Menu 4', icon: 'folder', render: renderDocuments, mount: mountDocuments },
  { id: 'menu5', label: 'Menu 5', icon: 'gear',   render: renderSettings,  mount: mountSettings, foot: true },  // 메뉴바 맨 아래 톱니바퀴
  { id: 'menu6', label: 'Menu 6', icon: 'mail',   render: renderMail,      mount: mountMail },
  { id: 'menu7', label: 'Menu 7', icon: 'check',  render: renderTodos,     mount: mountTodos },
];
// 파일 종류 → 그 파일을 다루는 메뉴
MENUS.forEach((m) => { m.base = m.label; });
const menuName = (id) => MENUS.find((m) => m.id === id)?.label || '';
const KIND_MENU = { diagram: 'menu2', document: 'menu4' };
const KIND_LABEL = { diagram: '다이어그램', document: '문서', post: '게시글', comment: '댓글', mail: '메일 계정' };

/* ------------------------------------------------------------------
   공통 도구
------------------------------------------------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let CONFIG = { kinds: {}, max_upload: 0, menus: {}, home: {}, trash_days: 30, pdf_sources: [] };

// 로그인이 풀렸으면 로그인 화면으로 (보던 메뉴는 주소에 남겨 둡니다)
const toLogin = () => location.replace('/login.html' + location.hash);

async function api(path, opts = {}) {
  let res;
  try {
    res = await fetch('/api' + path, { ...opts, headers: { 'X-Requested-With': 'dashboard', ...(opts.headers || {}) } });
  } catch (e) {
    throw new Error('서버에 연결할 수 없어요');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { toLogin(); throw new Error('로그인이 필요해요'); }
  if (!res.ok) throw new Error(data.error || `요청에 실패했어요 (${res.status})`);
  return data;
}

const fmtBytes = (n) => {
  if (n < 1024) return `${n}B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)}${units[i]}`;
};
const tokenFmt = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 });
const numFmt = new Intl.NumberFormat('ko-KR');
const fmtTokens = (n) => tokenFmt.format(n || 0);
const dateTimeFmt = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const timeFmt = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
const fmtDateTime = (iso) => dateTimeFmt.format(new Date(iso));
const fmtTime = (iso) => timeFmt.format(new Date(iso));
const fmtLeft = (ms) => {
  const min = Math.max(0, Math.round(ms / 60000));
  return min >= 60 ? `${Math.floor(min / 60)}시간 ${min % 60}분` : `${min}분`;
};
const extBadge = (ext) => {
  const e = String(ext).replace('.', '').toLowerCase();
  return `<span class="ext-badge ext-${esc(e)}">${esc(e.slice(0, 4))}</span>`;
};

function toast(message, isError = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.textContent = message;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), isError ? 5000 : 2600);
}

function confirmDelete(name, what = '파일', okLabel = '삭제') {
  const dlg = $('#confirmDialog');
  const days = CONFIG.trash_days || 30;
  const text = {
    '계정 연결': `"${name}" 연결을 해제합니다. 메일함의 메일은 그대로예요.`,
    '기록 전체': '최근 활동 기록을 모두 지웁니다. 파일과 게시글은 그대로예요.',
    '카테고리': `"${name}" 카테고리를 삭제합니다. 이 카테고리의 글은 지워지지 않고 미분류로 바뀌어요.`,
    '파일': `"${name}" 파일을 휴지통으로 옮깁니다. ${days}일 안에 설정 메뉴에서 복구할 수 있어요.`,
    '게시글': `"${name}" 게시글을 휴지통으로 옮깁니다. ${days}일 안에 설정 메뉴에서 복구할 수 있어요.`,
    '메모': `"${name}" 메모를 삭제합니다. 되돌릴 수 없어요.`,
    '영구 삭제': `"${name}" 항목을 완전히 삭제합니다. 되돌릴 수 없어요.`,
    '휴지통 비우기': '휴지통의 모든 항목을 완전히 삭제합니다. 되돌릴 수 없어요.',
  }[what] || `"${name}" ${what}을 삭제합니다. 되돌릴 수 없어요.`;
  $('#confirmTitle').textContent = what === '계정 연결' ? '연결을 해제할까요?' : what === '휴지통 비우기' ? '휴지통을 비울까요?' : '삭제할까요?';
  $('#confirmText').textContent = text;
  $('#confirmDialog .btn-danger').textContent = okLabel;
  return new Promise((resolve) => {
    const done = (ok) => {
      dlg.removeEventListener('click', onClick);
      dlg.removeEventListener('cancel', onEsc);
      if (dlg.open) dlg.close();
      resolve(ok);
    };
    const onClick = (e) => {
      const btn = e.target.closest('button[value]');
      if (btn) { e.preventDefault(); done(btn.value === 'ok'); }
    };
    const onEsc = () => done(false);
    dlg.addEventListener('click', onClick);
    dlg.addEventListener('cancel', onEsc);
    dlg.showModal();
  });
}

// 화면을 떠날 때 정리할 타이머들
let cleanups = [];
const every = (ms, fn) => { const t = setInterval(fn, ms); cleanups.push(() => clearInterval(t)); };

/* ------------------------------------------------------------------
   파일 등록 · 삭제 (Menu 2, Menu 4 공용)
------------------------------------------------------------------- */
async function uploadFiles(kind, fileList) {
  const files = [...fileList];
  if (!files.length) return null;
  let last = null, okCount = 0;
  for (const file of files) {
    try {
      if (CONFIG.max_upload && file.size > CONFIG.max_upload) throw new Error(`파일이 너무 커요 (최대 ${fmtBytes(CONFIG.max_upload)})`);
      const res = await api(`/files?kind=${kind}&name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file });
      last = res.file; okCount++;
    } catch (e) {
      toast(`${file.name}: ${e.message}`, true);
    }
  }
  if (okCount) toast(okCount === 1 ? `${last.name} 등록했어요` : `${okCount}개 파일을 등록했어요`);
  return last;
}

const acceptOf = (kind) => (CONFIG.kinds[kind]?.ext || []).join(',');
const extListOf = (kind) => (CONFIG.kinds[kind]?.ext || []).map((e) => e.slice(1)).join(', ');

// 버튼(파일 선택)과 끌어다 놓기를 한 영역에 연결
function wireUploader({ kind, button, dropZone, onDone }) {
  const input = document.createElement('input');
  input.type = 'file'; input.multiple = true; input.accept = acceptOf(kind); input.hidden = true;
  document.body.appendChild(input);
  cleanups.push(() => input.remove());
  const run = async (files) => { const last = await uploadFiles(kind, files); if (last) onDone(last); };
  input.addEventListener('change', () => { run(input.files); input.value = ''; });
  button?.addEventListener('click', () => input.click());
  if (dropZone) {
    let depth = 0;
    dropZone.addEventListener('dragenter', (e) => { e.preventDefault(); depth++; dropZone.classList.add('over'); });
    dropZone.addEventListener('dragover', (e) => e.preventDefault());
    dropZone.addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; dropZone.classList.remove('over'); } });
    dropZone.addEventListener('drop', (e) => { e.preventDefault(); depth = 0; dropZone.classList.remove('over'); run(e.dataTransfer.files); });
  }
}

async function deleteFile(file) {
  if (!(await confirmDelete(file.name))) return false;
  try {
    await api(`/files/${file.id}`, { method: 'DELETE' });
    toast(`${file.name} 휴지통으로 옮겼어요`);
    return true;
  } catch (e) {
    toast(e.message, true);
    return false;
  }
}

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

// 화면에 아직 그 요소가 있을 때만 그립니다 (다른 메뉴로 옮긴 뒤 도착한 응답 무시).
const fill = (sel, html) => { const el = $(sel); if (el) el.innerHTML = html; return el; };
const errLine = (e) => `<p class="empty-inline">${esc(e.message)}</p>`;

// 메인 화면 카드: [id, 이름]. Claude 사용량은 항상 맨 위이고 숨기기만 됩니다.
const HOME_CARDS = [['usage', 'Claude 사용량'], ['diagram', '다이어그램 수'], ['document', '문서 수'], ['size', '저장 용량'],
  ['todos', '오늘 할 일'], ['weather', '날씨'], ['links', '즐겨찾기'], ['system', '서버 상태'], ['memos', '메모'],
  ['oci', 'Oracle VM'], ['activity', '최근 활동'], ['tokens', '최근 7일 토큰']];
const homeLayout = () => {
  const saved = CONFIG.home || {};
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
        CONFIG.home = (await api('/settings/home', jsonBody({ order, hidden: [...hidden] }))).home;
        dlg.close();
        show();
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
  const loadLinks = async () => {
    try {
      const { links } = await api('/links');
      fill('#links', links.length ? links.map((l) => `
        <div class="link-tile">
          <a href="${esc(l.url)}" target="_blank" rel="noopener noreferrer" title="${esc(l.url)}">
            <span class="link-icon">${esc([...l.title][0].toUpperCase())}</span><span class="link-name">${esc(l.title)}</span>
          </a>
          <button class="icon-btn icon-btn-sm" type="button" data-link-del="${l.id}" aria-label="${esc(l.title)} 즐겨찾기 삭제" title="삭제">${icon('close')}</button>
        </div>`).join('') : '<p class="empty-inline">자주 가는 사이트를 추가해 보세요.</p>');
    } catch (e) { fill('#links', errLine(e)); }
  };
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
  cleanups.push(() => document.removeEventListener('visibilitychange', onVisible));
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

/* ------------------------------------------------------------------
   할 일 (메인 화면 카드와 Menu 7 공용)
------------------------------------------------------------------- */
const fmtDue = (d) => { const [, m, day] = d.split('-'); return `${Number(m)}월 ${Number(day)}일`; };
const PRIORITY = ['보통', '높음', '긴급'];
function todoRow(t, today) {
  const late = !t.done && t.due && t.due < today, now = t.due === today;
  return `
    <li class="row todo${t.done ? ' done' : ''}">
      <input type="checkbox" class="check" data-todo="${t.id}" ${t.done ? 'checked' : ''} aria-label="${esc(t.title)} 완료">
      <div class="row-main"><p class="row-title" title="${esc(t.title)}">${esc(t.title)}</p></div>
      ${t.priority ? `<span class="chip ${t.priority === 2 ? 'del' : 'add'}">${PRIORITY[t.priority]}</span>` : ''}
      ${t.due ? `<span class="chip ${late ? 'del' : now ? 'add' : ''}">${late ? '지남 · ' : ''}${now ? '오늘' : fmtDue(t.due)}</span>` : ''}
      <button class="icon-btn icon-btn-sm" type="button" data-todo-del="${t.id}" aria-label="${esc(t.title)} 삭제" title="삭제">${icon('close')}</button>
    </li>`;
}
function wireTodos(el, reload) {
  el.addEventListener('change', async (e) => {
    const box = e.target.closest('[data-todo]');
    if (!box) return;
    try { await api(`/todos/${box.dataset.todo}`, jsonBody({ done: box.checked })); }
    catch (err) { toast(err.message, true); }
    reload();
  });
  el.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-todo-del]');
    if (!btn) return;
    try { await api(`/todos/${btn.dataset.todoDel}`, { method: 'DELETE' }); }
    catch (err) { toast(err.message, true); }
    reload();
  });
}

function renderTodos(menu) {
  return `
    <header class="page-head">
      <div>
        <p class="eyebrow">${esc(menu.label)}</p>
        <h1 class="page-title">할 일</h1>
        <p class="page-desc">기한과 우선순위를 정해 두면 메인 화면에 오늘 할 일이 표시돼요.</p>
      </div>
    </header>
    <form class="card todo-form" id="todoForm">
      <input class="field" id="todoTitle" type="text" maxlength="200" placeholder="할 일" aria-label="할 일" autocomplete="off" required>
      <input class="field" id="todoDue" type="date" aria-label="기한">
      <select class="field" id="todoPriority" aria-label="우선순위">${PRIORITY.map((p, i) => `<option value="${i}">${p}</option>`).join('')}</select>
      <button class="btn btn-blue" type="submit">${icon('plus')} 추가</button>
    </form>
    <section class="card" style="margin-top:16px">
      <div class="card-head"><h2 class="card-title">진행 중</h2><span class="muted" id="todoOpenCount"></span></div>
      <ul class="rows" id="todoOpen"><li class="empty-inline">불러오는 중…</li></ul>
    </section>
    <section class="card" style="margin-top:16px">
      <div class="card-head"><h2 class="card-title">완료</h2><span class="muted" id="todoDoneCount"></span></div>
      <ul class="rows" id="todoDone"></ul>
    </section>`;
}

function mountTodos() {
  const load = async () => {
    try {
      const { todos, today } = await api('/todos');
      if (!$('#todoOpen')) return;
      const open = todos.filter((t) => !t.done);
      const done = todos.filter((t) => t.done).sort((a, b) => (b.done_at || '').localeCompare(a.done_at || ''));
      $('#todoOpenCount').textContent = open.length ? `${open.length}개` : '';
      $('#todoDoneCount').textContent = done.length ? `${done.length}개` : '';
      $('#todoOpen').innerHTML = open.map((t) => todoRow(t, today)).join('') || '<li class="empty-inline">할 일이 없어요.</li>';
      $('#todoDone').innerHTML = done.map((t) => todoRow(t, today)).join('') || '<li class="empty-inline">완료한 일이 여기에 모여요.</li>';
    } catch (e) { fill('#todoOpen', `<li class="empty-inline">${esc(e.message)}</li>`); }
  };
  wireTodos($('#todoOpen'), load);
  wireTodos($('#todoDone'), load);
  $('#todoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/todos', jsonBody({ title: $('#todoTitle').value, due: $('#todoDue').value, priority: Number($('#todoPriority').value) }));
      $('#todoTitle').value = '';
      $('#todoTitle').focus();
      load();
    } catch (err) { toast(err.message, true); }
  });
  load();
}

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
      <p class="card-note">삭제한 파일과 게시글은 ${CONFIG.trash_days || 30}일 동안 보관된 뒤 자동으로 완전히 삭제됩니다.</p>
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
      CONFIG.menus = (await api('/settings/menus', jsonBody({ labels }))).menus;
      applyMenuNames();
      show();
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

const USAGE_POLL_MS = 3000;
let usageData = null, usageBusy = false;

async function loadUsage() {
  if (usageBusy || document.hidden) return;
  usageBusy = true;
  try { usageData = await api('/claude-usage'); usageData.fetchedAt = Date.now(); }
  catch (e) { usageData = { error: e.message }; }
  usageBusy = false;
  drawUsage();
}

const fmtCountdown = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (h ? `${h}시간 ` : '') + `${m}분 ${String(sec).padStart(2, '0')}초`;
};
const fmtAge = (sec) => sec < 5 ? '방금' : sec < 60 ? `${Math.floor(sec)}초 전` : sec < 3600 ? `${Math.floor(sec / 60)}분 전` : `${Math.floor(sec / 3600)}시간 전`;
const fmtPct = (n) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

function drawUsage() {
  const box = $('#usage');
  if (!box || !usageData) return;
  const u = usageData;
  const stat = (label, value, small = '') => `<div class="hero-stat"><dt>${label}</dt><dd>${value}${small ? `<small>${small}</small>` : ''}</dd></div>`;

  if (u.error || !u.available) {
    box.innerHTML = `<div><p class="hero-kicker">Claude 사용량</p>
      <h2 class="hero-title">${u.error ? '불러오지 못했어요' : '사용 기록이 없어요'}</h2>
      <p class="hero-sub">${esc(u.error || '이 서버에서 Claude Code를 사용하면 여기에 표시됩니다.')}</p></div>`;
  } else {
    const L = u.limits, five = L?.five_hour, week = L?.seven_day, w = u.window, t = u.today;
    const fiveLive = five && !five.expired;
    let left;
    if (fiveLive) {
      left = `
        <p class="hero-kicker">Claude 사용량 · 5시간 한도</p>
        <h2 class="hero-title">${fmtPct(five.used_percentage)} 사용</h2>
        <p class="hero-sub">${fmtTime(five.resets_at)}에 초기화 · <span data-countdown="${five.resets_at}"></span> 남음</p>
        <div class="meter" role="img" aria-label="5시간 한도 ${fmtPct(five.used_percentage)} 사용"><i style="width:${Math.min(100, five.used_percentage)}%"></i></div>`;
    } else if (five) {
      left = `
        <p class="hero-kicker">Claude 사용량 · 5시간 한도</p>
        <h2 class="hero-title">초기화됐어요</h2>
        <p class="hero-sub">${fmtTime(five.resets_at)}에 구간이 끝났습니다. 다음 대화를 시작하면 새 구간이 열려요.</p>
        <div class="meter" role="img" aria-label="5시간 한도 0% 사용"><i style="width:0%"></i></div>`;
    } else if (w) {
      left = `
        <p class="hero-kicker">Claude 사용량 · 추정 구간</p>
        <h2 class="hero-title">${fmtTime(w.reset)}쯤 초기화</h2>
        <p class="hero-sub"><span data-countdown="${w.reset}"></span> 남음 · 한도 %는 아직 받지 못했어요</p>`;
    } else {
      left = `
        <p class="hero-kicker">Claude 사용량</p>
        <h2 class="hero-title">진행 중인 구간이 없어요</h2>
        <p class="hero-sub">다음 대화를 시작하면 새 5시간 구간이 열립니다.</p>`;
    }
    const note = L
      ? `<p class="hero-note">한도 %와 초기화 시각은 Claude Code가 받은 공식 값이에요 · <span data-age="${L.captured_at}"></span> 갱신. 토큰 수는 이 PC의 기록 기준입니다.</p>`
      : '<p class="hero-note">공식 한도 값을 아직 받지 못해 이 PC의 기록으로 추정했어요. Claude Code에서 메시지를 한 번 보내면 정확한 값으로 바뀝니다.</p>';

    let right = '';
    if (week) {
      right += stat('주간 한도', week.expired ? '초기화됨' : fmtPct(week.used_percentage), `${fmtDateTime(week.resets_at)} 초기화`);
    }
    if (w) {
      right += stat('이번 구간 토큰', fmtTokens(w.tokens), `메시지 ${numFmt.format(w.messages)}개`)
             + stat('출력 / 입력', `${fmtTokens(w.output)} / ${fmtTokens(w.input + w.cache_write)}`)
             + stat('캐시 읽기', fmtTokens(w.cache_read), '토큰 합계에서 제외');
    } else {
      right += stat('오늘 토큰', fmtTokens(t.tokens), `메시지 ${numFmt.format(t.messages)}개`)
             + stat('오늘 출력 / 입력', `${fmtTokens(t.output)} / ${fmtTokens(t.input + t.cache_write)}`)
             + stat('오늘 캐시 읽기', fmtTokens(t.cache_read), '토큰 합계에서 제외');
    }
    const models = (w || t).by_model.slice(0, 3).map((m) => `${esc(m.model.replace(/^claude-/, ''))} ${fmtTokens(m.tokens)}`).join(' · ');
    box.innerHTML = `<div>${left}${note}</div><div><dl class="hero-stats">${right}</dl>${models ? `<p class="hero-note">모델별 토큰: ${models}</p>` : ''}</div>`;
    tickUsage();
  }

  const bars = $('#bars');
  if (bars && u.days) {
    const max = Math.max(...u.days.map((d) => d.tokens));
    bars.innerHTML = u.days.map((d, i) => {
      const last = i === u.days.length - 1;
      const label = last ? '오늘' : new Date(d.date + 'T00:00:00').toLocaleDateString('ko-KR', { weekday: 'short' });
      const h = max ? Math.max(3, (d.tokens / max) * 100) : 3;
      return `<div class="bar${last ? ' today' : ''}" title="${d.date} · ${numFmt.format(d.tokens)} 토큰"><i style="height:${h.toFixed(1)}%"></i><span>${label}</span></div>`;
    }).join('');
    $('#barsNote').textContent = `오늘 ${fmtTokens(u.days.at(-1).tokens)} · 최대 ${fmtTokens(max)} (캐시 읽기 제외)`;
  }
}

// 남은 시간과 "N초 전"만 1초마다 갱신. 초기화 시각이 지나면 즉시 서버에 다시 묻습니다.
function tickUsage() {
  const now = Date.now();
  document.querySelectorAll('[data-countdown]').forEach((el) => {
    const left = new Date(el.dataset.countdown) - now;
    el.textContent = fmtCountdown(left);
    if (left <= 0 && !el.dataset.fired) { el.dataset.fired = '1'; loadUsage(); }
  });
  document.querySelectorAll('[data-age]').forEach((el) => {
    el.textContent = fmtAge((now - new Date(el.dataset.age)) / 1000);
  });
}

/* ------------------------------------------------------------------
   Menu 2: 다이어그램 (draw.io · 이미지)
------------------------------------------------------------------- */
const VIEWER_JS = 'https://viewer.diagrams.net/js/viewer-static.min.js';

function renderDiagrams() {
  return '<div id="dg"><p class="empty-inline">불러오는 중…</p></div>';
}

let viewerLoading;
function loadViewer() {
  if (window.GraphViewer) return Promise.resolve();
  viewerLoading = viewerLoading || new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = VIEWER_JS;
    s.onload = resolve;
    s.onerror = () => { viewerLoading = null; reject(new Error('다이어그램 뷰어를 불러오지 못했어요 (인터넷 연결 필요)')); };
    document.head.appendChild(s);
  });
  return viewerLoading;
}

// 목록(#menu2) · 등록(#menu2?write=1) · 보기(#menu2?file=ID) — 게시판과 같은 흐름
const dgTitle = (f) => f.title || f.name.replace(/\.[^.]+$/, '');

async function mountDiagrams(menu, params) {
  const root = $('#dg');
  if (params.has('write')) return diagramWrite(root, menu);
  let files;
  try { files = (await api('/files?kind=diagram')).files; }
  catch (e) { root.innerHTML = errLine(e); return; }
  if (!root.isConnected) return;
  const current = params.get('file') && files.find((f) => f.id === params.get('file'));
  if (current) return diagramView(root, menu, current);
  if (params.get('file')) toast('삭제됐거나 없는 항목이에요', true);

  root.innerHTML = `
    <header class="page-head">
      <div>
        <p class="eyebrow">${esc(menu.label)}</p>
        <h1 class="page-title">아키텍처</h1>
        <p class="page-desc">아키텍처 그림을 제목과 설명을 붙여 등록해 두고 열어 볼 수 있어요.</p>
      </div>
      <a class="btn btn-blue" href="#menu2?write=1">${icon('plus')} 등록</a>
    </header>
    <section class="card">
      <div class="card-head"><h2 class="card-title">등록된 아키텍처 <span class="muted">${files.length ? `${files.length}개` : ''}</span></h2></div>
      ${files.length ? `<ul class="rows">${files.map((f) => `
        <li class="row">
          ${extBadge(f.ext)}
          <a class="row-main post-link" href="#menu2?file=${f.id}">
            <p class="row-title">${esc(dgTitle(f))}</p>
            ${f.note ? `<p class="post-excerpt">${esc(f.note.slice(0, 160))}</p>` : ''}
            <p class="row-sub">${esc(f.name)} · ${fmtBytes(f.size)} · ${fmtDateTime(f.created_at)}</p>
          </a>
          <div class="row-actions">
            <button class="btn btn-ghost btn-sm" type="button" data-del="${f.id}" aria-label="${esc(dgTitle(f))} 삭제">${icon('trash')}<span>삭제</span></button>
          </div>
        </li>`).join('')}</ul>`
      : `<div class="empty"><div class="empty-art">${icon('grid')}</div><h2>등록된 아키텍처가 없어요</h2><p>drawio 파일이나 그림 파일을 등록해 보세요.</p><a class="btn btn-blue" href="#menu2?write=1">${icon('plus')} 등록</a></div>`}
    </section>`;
  root.onclick = async (e) => {
    const btn = e.target.closest('[data-del]');
    const file = btn && files.find((f) => f.id === btn.dataset.del);
    if (file && await deleteFile(file)) show();
  };
}

function diagramWrite(root, menu) {
  root.innerHTML = `
    <header class="page-head">
      <div>
        <p class="eyebrow">${esc(menu.label)}</p>
        <h1 class="page-title">아키텍처 등록</h1>
      </div>
      <a class="btn btn-soft" href="#menu2">${icon('back')} 목록</a>
    </header>
    <form class="card" id="dgForm">
      <input class="field title-field" id="dgTitleIn" type="text" maxlength="200" placeholder="제목 (비우면 파일 이름)" aria-label="제목" autocomplete="off">
      <textarea class="field" id="dgNoteIn" rows="5" maxlength="20000" placeholder="설명 (선택)" aria-label="설명" style="margin-top:12px"></textarea>
      <label class="drop file-drop" id="dgDrop" style="margin-top:12px">
        <input type="file" id="dgFile" accept="${esc(acceptOf('diagram'))}" class="sr">
        <span class="card-icon">${icon('upload')}</span>
        <span class="drop-title" id="dgFileName">파일을 선택하거나 여기에 끌어다 놓으세요</span>
        <span class="drop-sub">${esc(extListOf('diagram'))}</span>
      </label>
      <div class="form-actions">
        <a class="btn btn-soft" href="#menu2">취소</a>
        <button class="btn btn-blue" type="submit" id="dgSave">등록</button>
      </div>
    </form>`;
  const input = $('#dgFile'), drop = $('#dgDrop');
  let picked = null;
  const pick = (file) => { picked = file || null; $('#dgFileName').textContent = picked ? `${picked.name} (${fmtBytes(picked.size)})` : '파일을 선택하거나 여기에 끌어다 놓으세요'; };
  input.addEventListener('change', () => pick(input.files[0]));
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); pick(e.dataTransfer.files[0]); });
  $('#dgForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!picked) { toast('등록할 파일을 선택해 주세요', true); return; }
    const save = $('#dgSave');
    save.disabled = true;
    const file = await uploadFiles('diagram', [picked]);   // 실패하면 안에서 알림을 띄우고 null
    if (!file) { save.disabled = false; return; }
    const title = $('#dgTitleIn').value.trim(), note = $('#dgNoteIn').value.trim();
    try { if (title || note) await api(`/files/${file.id}/meta`, jsonBody({ title, note })); }
    catch (err) { toast(`파일은 등록됐지만 제목·설명을 저장하지 못했어요: ${err.message}`, true); }
    location.hash = `#menu2?file=${file.id}`;
  });
  $('#dgTitleIn').focus();
}

async function diagramView(root, menu, current) {
  root.innerHTML = `
    <header class="page-head">
      <a class="btn btn-soft" href="#menu2">${icon('back')} 목록</a>
      <div class="row-actions">
        <button class="btn btn-soft" type="button" id="dgEdit">${icon('edit')} 수정</button>
        <a class="btn btn-soft" href="/api/files/${current.id}/raw?download" download>${icon('download')} 내려받기</a>
        <button class="btn btn-ghost" type="button" id="dgDel">${icon('trash')} 삭제</button>
      </div>
    </header>
    <article class="card">
      <div id="dgInfo">
        <h1 class="post-title">${esc(dgTitle(current))}</h1>
        <p class="row-sub">${esc(current.name)} · ${fmtBytes(current.size)} · ${fmtDateTime(current.created_at)} 등록</p>
        ${current.note ? `<p class="dg-note">${esc(current.note)}</p>` : ''}
      </div>
      <form id="dgEditForm" hidden>
        <input class="field title-field" id="dgTitleIn" type="text" maxlength="200" value="${esc(current.title || '')}" placeholder="제목 (비우면 파일 이름)" aria-label="제목" autocomplete="off">
        <textarea class="field" id="dgNoteIn" rows="5" maxlength="20000" placeholder="설명 (선택)" aria-label="설명" style="margin-top:12px">${esc(current.note || '')}</textarea>
        <div class="form-actions">
          <button class="btn btn-soft" type="button" id="dgEditCancel">취소</button>
          <button class="btn btn-blue" type="submit">저장</button>
        </div>
      </form>
      <div class="diagram post-view" id="diagram"><p class="diagram-msg">다이어그램을 불러오는 중…</p></div>
    </article>`;

  const editing = (on) => { $('#dgInfo').hidden = on; $('#dgEditForm').hidden = !on; if (on) $('#dgTitleIn').focus(); };
  $('#dgEdit').addEventListener('click', () => editing($('#dgEditForm').hidden));
  $('#dgEditCancel').addEventListener('click', () => editing(false));
  $('#dgEditForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api(`/files/${current.id}/meta`, jsonBody({ title: $('#dgTitleIn').value, note: $('#dgNoteIn').value })); toast('저장했어요'); show(); }
    catch (err) { toast(err.message, true); }
  });
  $('#dgDel').addEventListener('click', async () => { if (await deleteFile(current)) location.hash = '#menu2'; });

  const box = $('#diagram');
  const src = `/api/files/${current.id}/raw`;
  try {
    if (!['.drawio', '.xml'].includes(current.ext)) {
      box.innerHTML = `<img src="${src}" alt="${esc(dgTitle(current))}">`;
      return;
    }
    const [res] = await Promise.all([fetch(src), loadViewer()]);
    if (!res.ok) throw new Error('파일을 불러오지 못했어요');
    const xml = await res.text();
    if (!box.isConnected) return;
    // 내용이 있는 첫 페이지를 먼저 보여 줍니다
    const pages = [...new DOMParser().parseFromString(xml, 'text/xml').querySelectorAll('diagram')];
    const first = pages.findIndex((d) => d.querySelectorAll('mxCell').length > 2 || (!d.children.length && d.textContent.trim()));
    const el = document.createElement('div');
    el.className = 'mxgraph';
    el.style.width = '100%';
    el.setAttribute('data-mxgraph', JSON.stringify({
      xml, page: Math.max(0, first),
      toolbar: 'pages zoom layers lightbox', 'toolbar-position': 'top',
      nav: true, resize: true, 'auto-fit': true, highlight: '#1F3FA8',
    }));
    box.replaceChildren(el);
    window.GraphViewer.createViewerForElement(el);
  } catch (e) {
    if (box.isConnected) box.innerHTML = `<p class="diagram-msg">${esc(e.message)}</p>`;
  }
}

/* ------------------------------------------------------------------
   Menu 4: 문서 (hwp, word, ppt …)
------------------------------------------------------------------- */
const PREVIEW_IMG = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const PREVIEW_EXT = ['.pdf', '.txt', '.md', '.csv', ...PREVIEW_IMG];
function openPreview(file) {
  if (!file) return;
  const dlg = $('#previewDialog');
  const src = `/api/files/${file.id}/raw`;
  $('#previewTitle').textContent = file.name;
  $('#previewBody').innerHTML = PREVIEW_IMG.includes(file.ext)
    ? `<img src="${src}" alt="${esc(file.name)}">`
    : `<iframe src="${src}" title="${esc(file.name)}"></iframe>`;
  dlg.showModal();
}
$('#previewDialog').addEventListener('click', (e) => { if (e.target === e.currentTarget || e.target.closest('[data-close]')) e.currentTarget.close(); });
$('#previewDialog').addEventListener('close', () => { $('#previewBody').innerHTML = ''; });

function renderDocuments(menu) {
  return `
    <header class="page-head">
      <div>
        <p class="eyebrow">${esc(menu.label)}</p>
        <h1 class="page-title">문서</h1>
        <p class="page-desc">문서 파일을 등록하고 내려받을 수 있어요. PDF, 이미지, 텍스트는 바로 미리 볼 수 있습니다.</p>
      </div>
      <button class="btn btn-blue" type="button" id="docAdd">${icon('upload')} 파일 등록</button>
    </header>
    <section class="drop" id="docDrop">
      <div class="card-icon">${icon('upload')}</div>
      <p class="drop-title">여기에 파일을 끌어다 놓으세요</p>
      <p class="drop-sub">${esc(extListOf('document'))}</p>
    </section>
    <section class="card" style="margin-top:16px">
      <div class="card-head"><h2 class="card-title">등록된 문서</h2><span class="muted" id="docCount"></span></div>
      <ul class="rows" id="docList"><li class="empty-inline">불러오는 중…</li></ul>
    </section>`;
}

async function mountDocuments(menu, params) {
  const reload = (id) => { const h = `#menu4${id ? `?file=${id}` : ''}`; if (location.hash === h) show(); else location.hash = h; };
  wireUploader({ kind: 'document', button: $('#docAdd'), dropZone: $('#docDrop'), onDone: (f) => reload(f.id) });

  const list = $('#docList');
  let files;
  try { files = (await api('/files?kind=document')).files; }
  catch (e) { list.innerHTML = `<li class="empty-inline">${esc(e.message)}</li>`; return; }
  if (!list.isConnected) return;

  $('#docCount').textContent = files.length ? `${files.length}개 · ${fmtBytes(files.reduce((s, f) => s + f.size, 0))}` : '';
  if (!files.length) { list.innerHTML = '<li class="empty-inline">아직 등록된 문서가 없어요.</li>'; return; }

  list.innerHTML = files.map((f) => `
    <li class="row" data-id="${f.id}">
      ${extBadge(f.ext)}
      <div class="row-main">
        <p class="row-title" title="${esc(f.name)}">${esc(f.name)}</p>
        <p class="row-sub">${fmtBytes(f.size)} · ${fmtDateTime(f.created_at)} 등록</p>
      </div>
      <div class="row-actions">
        ${PREVIEW_EXT.includes(f.ext) ? `<button class="btn btn-soft btn-sm" type="button" data-preview="${f.id}" aria-label="${esc(f.name)} 미리보기">${icon('eye')}<span>미리보기</span></button>` : ''}
        ${(CONFIG.pdf_sources || []).includes(f.ext) ? `<button class="btn btn-soft btn-sm" type="button" data-pdf="${f.id}" aria-label="${esc(f.name)} PDF로 변환">${icon('pdf')}<span>PDF로 변환</span></button>` : ''}
        <a class="btn btn-soft btn-sm" href="/api/files/${f.id}/raw?download" download aria-label="${esc(f.name)} 내려받기">${icon('download')}<span>내려받기</span></a>
        <button class="btn btn-ghost btn-sm" type="button" data-del="${f.id}" aria-label="${esc(f.name)} 삭제">${icon('trash')}<span>삭제</span></button>
      </div>
    </li>`).join('');

  list.addEventListener('click', async (e) => {
    const view = e.target.closest('[data-preview]');
    if (view) return openPreview(files.find((f) => f.id === view.dataset.preview));
    const pdf = e.target.closest('[data-pdf]');
    if (pdf) {
      const label = pdf.querySelector('span');
      pdf.disabled = true; label.textContent = '변환 중…';
      try {
        const { file } = await api(`/files/${pdf.dataset.pdf}/pdf`, { method: 'POST' });
        toast(`${file.name} 파일을 만들었어요`);
        reload(file.id);
      } catch (err) {
        toast(err.message, true);
        pdf.disabled = false; label.textContent = 'PDF로 변환';
      }
      return;
    }
    const btn = e.target.closest('[data-del]');
    if (!btn) return;
    const file = files.find((f) => f.id === btn.dataset.del);
    if (file && await deleteFile(file)) reload('');
  });

  // 검색이나 등록 직후 넘어온 파일을 잠깐 강조
  const target = params.get('file') && list.querySelector(`[data-id="${CSS.escape(params.get('file'))}"]`);
  if (target) {
    target.classList.add('flash');
    target.scrollIntoView({ block: 'center' });
    setTimeout(() => target.classList.remove('flash'), 2200);
  }
}

/* ------------------------------------------------------------------
   Menu 3: 게시판 — 목록(#menu3) · 글쓰기(#menu3?write=1) · 글 보기(#menu3?post=ID)
------------------------------------------------------------------- */
const jsonBody = (data) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
const TEXT_COLORS = [['빨강', '#E5484D'], ['주황', '#E8850C'], ['초록', '#2E9E5B'], ['파랑', '#3B6FE0'], ['보라', '#8E5CD9']];
const HILITE = 'rgba(255, 214, 0, 0.45)';

function renderBoard(menu) {
  return `<div id="board" data-label="${esc(menu.label)}"><p class="empty-inline">불러오는 중…</p></div>`;
}

function mountBoard(menu, params) {
  const root = $('#board');
  if (params.get('post')) return boardPost(root, menu, params.get('post'));
  if (params.get('edit')) return boardWrite(root, menu, params.get('edit'));
  if (params.has('write')) return boardWrite(root, menu);
  return boardList(root, menu, params.get('cat') || '');
}

async function boardList(root, menu, filter) {
  let posts, cats;
  try { [{ posts }, { categories: cats }] = await Promise.all([api('/posts'), api('/categories')]); }
  catch (e) { root.innerHTML = `<p class="empty-inline">${esc(e.message)}</p>`; return; }
  if (!root.isConnected) return;

  if (filter && filter !== 'none' && !cats.some((c) => c.id === filter)) filter = '';
  let oldFirst = false;
  try { oldFirst = localStorage.getItem('board-sort') === 'old'; } catch (e) { /* 무시 */ }
  const shown = posts.filter((p) => !filter || (filter === 'none' ? !p.category_id : p.category_id === filter));
  if (oldFirst) shown.reverse();
  shown.sort((a, b) => b.pinned - a.pinned);   // 고정한 글은 항상 맨 위 (나머지 순서는 유지)
  const loose = posts.filter((p) => !p.category_id).length;
  const chip = (id, label, count) => `<a class="tab" href="#menu3${id ? `?cat=${id}` : ''}" ${filter === id ? 'aria-current="true"' : ''}>${esc(label)} <small>${count}</small></a>`;

  root.innerHTML = `
    <header class="page-head">
      <div>
        <p class="eyebrow">${esc(menu.label)}</p>
        <h1 class="page-title">게시판</h1>
        <p class="page-desc">글을 쓰고 댓글을 남길 수 있어요.</p>
      </div>
      <a class="btn btn-blue" href="#menu3?write=1">${icon('plus')} 글쓰기</a>
    </header>
    <nav class="tabs cat-tabs" aria-label="카테고리">
      ${chip('', '전체', posts.length)}
      ${cats.map((c) => chip(c.id, c.name, c.posts)).join('')}
      ${cats.length && loose ? chip('none', '미분류', loose) : ''}
    </nav>
    <details class="card cat-manage" id="catManage">
      <summary>카테고리 관리</summary>
      <ul class="cat-list">
        ${cats.map((c) => `<li><span>${esc(c.name)} <small>글 ${c.posts}개</small></span><button class="icon-btn icon-btn-sm" type="button" data-cat-del="${c.id}" aria-label="${esc(c.name)} 카테고리 삭제" title="삭제">${icon('close')}</button></li>`).join('') || '<li class="muted">아직 카테고리가 없어요.</li>'}
      </ul>
      <form class="cat-add" id="catAdd">
        <input class="field" id="catName" type="text" maxlength="30" placeholder="새 카테고리 이름" aria-label="새 카테고리 이름" autocomplete="off">
        <button class="btn btn-soft" type="submit">추가</button>
      </form>
    </details>
    <section class="card">
      <div class="card-head"><h2 class="card-title">게시글 <span class="muted">${shown.length ? `${shown.length}개` : ''}</span></h2>
        <button class="btn btn-ghost btn-sm" type="button" id="sortBtn">${icon('sort')} ${oldFirst ? '오래된순' : '최신순'}</button></div>
      ${shown.length ? `<ul class="rows">${shown.map((p) => `
        <li class="row">
          <a class="row-main post-link" href="#menu3?post=${p.id}">
            <p class="row-title">${p.pinned ? `<span class="pin-mark" title="고정됨">${icon('pin')}</span>` : ''}${p.category ? `<span class="chip add cat-chip">${esc(p.category)}</span>` : ''}${esc(p.title)}</p>
            <p class="post-excerpt">${esc(p.excerpt)}</p>
            <p class="row-sub">${fmtDateTime(p.created_at)} · 댓글 ${p.comments}</p>
          </a>
          <div class="row-actions">
            <button class="btn btn-ghost btn-sm pin-btn${p.pinned ? ' on' : ''}" type="button" data-pin="${p.id}" aria-pressed="${p.pinned ? 'true' : 'false'}" aria-label="${esc(p.title)} ${p.pinned ? '고정 해제' : '상단 고정'}" title="${p.pinned ? '고정 해제' : '상단 고정'}">${icon('pin')}</button>
            <button class="btn btn-ghost btn-sm" type="button" data-del="${p.id}" aria-label="${esc(p.title)} 삭제">${icon('trash')}<span>삭제</span></button>
          </div>
        </li>`).join('')}</ul>`
      : `<div class="empty"><div class="empty-art">${icon('note')}</div><h2>${posts.length ? '이 카테고리에는 글이 없어요' : '아직 글이 없어요'}</h2><p>${posts.length ? '' : '첫 글을 써 보세요.'}</p><a class="btn btn-blue" href="#menu3?write=1">${icon('plus')} 글쓰기</a></div>`}
    </section>`;

  // 관리 창을 열어 둔 채로 다시 그릴 수 있게 기억
  const redraw = async () => { const open = $('#catManage').open; await boardList(root, menu, filter); if (open && $('#catManage')) $('#catManage').open = true; };
  root.onclick = async (e) => {
    const del = e.target.closest('[data-del]');
    const catDel = e.target.closest('[data-cat-del]');
    const pin = e.target.closest('[data-pin]');
    if (e.target.closest('#sortBtn')) {
      try { localStorage.setItem('board-sort', oldFirst ? 'new' : 'old'); } catch (err) { /* 무시 */ }
      redraw();
    } else if (pin) {
      const post = posts.find((p) => p.id === pin.dataset.pin);
      try { await api(`/posts/${post.id}/pin`, jsonBody({ pinned: !post.pinned })); redraw(); }
      catch (err) { toast(err.message, true); }
    } else if (del) {
      const post = posts.find((p) => p.id === del.dataset.del);
      if (post && await deletePost(post)) redraw();
    } else if (catDel) {
      const cat = cats.find((c) => c.id === catDel.dataset.catDel);
      if (!cat || !(await confirmDelete(cat.name, '카테고리'))) return;
      try { await api(`/categories/${cat.id}`, { method: 'DELETE' }); toast('카테고리를 삭제했어요'); redraw(); }
      catch (err) { toast(err.message, true); }
    }
  };
  $('#catAdd').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#catName').value.trim();
    if (!name) { $('#catName').focus(); return; }
    try { await api('/categories', jsonBody({ name })); toast(`${name} 카테고리를 추가했어요`); await redraw(); $('#catName')?.focus(); }
    catch (err) { toast(err.message, true); }
  });
}

async function deletePost(post) {
  if (!(await confirmDelete(post.title, '게시글'))) return false;
  try { await api(`/posts/${post.id}`, { method: 'DELETE' }); toast('게시글을 휴지통으로 옮겼어요'); return true; }
  catch (e) { toast(e.message, true); return false; }
}

async function boardWrite(root, menu, editId) {
  let editing = null;
  if (editId) {
    try { editing = (await api(`/posts/${encodeURIComponent(editId)}`)).post; }
    catch (e) { root.innerHTML = `<section class="card"><div class="empty"><h2>${esc(e.message)}</h2><p></p><a class="btn btn-soft" href="#menu3">목록으로</a></div></section>`; return; }
    if (!root.isConnected) return;
  }
  const backHref = editing ? `#menu3?post=${editing.id}` : '#menu3';
  const tool = (cmd, label, inner, arg = '') => `<button class="tool" type="button" data-cmd="${cmd}" data-arg="${esc(arg)}" title="${label}" aria-label="${label}">${inner}</button>`;
  root.innerHTML = `
    <header class="page-head">
      <div>
        <p class="eyebrow">${esc(menu.label)}</p>
        <h1 class="page-title">${editing ? '글 수정' : '글쓰기'}</h1>
      </div>
      <a class="btn btn-soft" href="${backHref}">${icon('back')} ${editing ? '돌아가기' : '목록'}</a>
    </header>
    <form class="card" id="postForm">
      <div class="write-top">
        <input class="field" id="postCat" type="text" list="catOptions" maxlength="30" placeholder="카테고리 (선택)" aria-label="카테고리" autocomplete="off">
        <datalist id="catOptions"></datalist>
        <input class="field title-field" id="postTitle" type="text" maxlength="200" placeholder="제목" aria-label="제목" autocomplete="off">
      </div>
      <p class="card-note write-note">카테고리는 목록에서 고르거나 새 이름을 적으면 새로 만들어져요. 비워 두면 미분류로 등록됩니다.</p>
      <div class="editor">
        <div class="toolbar" id="toolbar" role="toolbar" aria-label="글자 서식">
          ${tool('bold', '굵게', '<b>가</b>')}
          ${tool('italic', '기울임', '<i>가</i>')}
          ${tool('underline', '밑줄', '<u>가</u>')}
          ${tool('strikeThrough', '취소선', '<s>가</s>')}
          <span class="tool-sep"></span>
          ${tool('fontSize', '글자 작게', '<span style="font-size:12px">가</span>', '2')}
          ${tool('fontSize', '글자 크게', '<span style="font-size:20px">가</span>', '5')}
          ${tool('formatBlock', '제목', 'H', 'h2')}
          <span class="tool-sep"></span>
          ${TEXT_COLORS.map(([name, c]) => tool('foreColor', `${name} 글자`, `<i class="swatch" style="background:${c}"></i>`, c)).join('')}
          ${tool('hiliteColor', '형광펜', `<span class="hl" style="background:${HILITE}">가</span>`, HILITE)}
          <span class="tool-sep"></span>
          ${tool('insertUnorderedList', '목록', '•≡')}
          ${tool('formatBlock', '인용', '❝', 'blockquote')}
          <span class="tool-sep"></span>
          ${tool('link', '링크 넣기', icon('link'))}
          ${tool('image', '이미지 넣기', icon('image'))}
          ${tool('file', '파일 첨부', icon('clip'))}
          ${tool('clear', '서식 지우기', '<span class="tool-text">서식 지우기</span>')}
        </div>
        <div class="editor-body post-body" id="postBody" contenteditable="true" role="textbox" aria-multiline="true" aria-label="본문" data-placeholder="내용을 입력하세요"></div>
      </div>
      <div class="form-actions">
        <a class="btn btn-soft" href="${backHref}">취소</a>
        <button class="btn btn-blue" type="submit" id="postSave">${editing ? '저장' : '등록'}</button>
      </div>
    </form>`;

  api('/categories').then(({ categories }) => {
    const list = $('#catOptions');
    if (list) list.innerHTML = categories.map((c) => `<option value="${esc(c.name)}"></option>`).join('');
  }).catch(() => {});

  const body = $('#postBody');
  const exec = (cmd, arg) => document.execCommand(cmd, false, arg);
  if (editing) {
    $('#postTitle').value = editing.title;
    $('#postCat').value = editing.category || '';
    body.innerHTML = editing.body;   // 서버가 허용 태그만 남겨 저장한 HTML
  }

  // 파일 선택 창을 여는 동안 본문의 커서 위치를 기억해 둡니다.
  let savedRange = null;
  const remember = () => {
    const sel = getSelection();
    if (sel.rangeCount && body.contains(sel.anchorNode)) savedRange = sel.getRangeAt(0).cloneRange();
  };
  ['keyup', 'mouseup', 'blur', 'input'].forEach((ev) => body.addEventListener(ev, remember));
  const insertHtml = (markup) => {
    body.focus();
    if (savedRange) { const sel = getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); }
    exec('insertHTML', markup);
    remember();
  };
  const picker = document.createElement('input');
  picker.type = 'file'; picker.hidden = true;
  document.body.appendChild(picker);
  cleanups.push(() => picker.remove());
  const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
  picker.addEventListener('change', async () => {
    const file = picker.files[0];
    const asImage = picker.dataset.mode === 'image';
    picker.value = '';
    if (!file) return;
    try {
      if (CONFIG.max_upload && file.size > CONFIG.max_upload) throw new Error(`파일이 너무 커요 (최대 ${fmtBytes(CONFIG.max_upload)})`);
      const { file: saved } = await api(`/files?kind=attachment&name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file });
      insertHtml(asImage ? `<img src="/api/files/${saved.id}/raw" alt=""><br>`
        : `<a href="/api/files/${saved.id}/raw?download">${esc(saved.name)}</a>&nbsp;`);
    } catch (err) { toast(`${file.name}: ${err.message}`, true); }
  });
  // 버튼을 눌러도 본문의 선택 영역이 풀리지 않게 합니다.
  $('#toolbar').addEventListener('mousedown', (e) => e.preventDefault());
  $('#toolbar').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cmd]');
    if (!btn) return;
    body.focus();
    const { cmd, arg } = btn.dataset;
    if (cmd === 'image' || cmd === 'file') {
      remember();
      picker.dataset.mode = cmd;
      picker.accept = cmd === 'image' ? IMAGE_EXT.join(',') : acceptOf('attachment');
      picker.click();
    } else if (cmd === 'link') {
      remember();
      let url = (prompt('링크 주소를 입력하세요', 'https://') || '').trim();
      if (!url || url === 'https://') return;
      if (!/^(https?:\/\/|mailto:)/i.test(url)) url = 'https://' + url;
      if (savedRange && !savedRange.collapsed) { body.focus(); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); exec('createLink', url); }
      else insertHtml(`<a href="${esc(url)}">${esc(url)}</a>&nbsp;`);
    } else if (cmd === 'clear') { exec('removeFormat'); exec('formatBlock', 'div'); }
    else if (cmd === 'formatBlock' && document.queryCommandValue('formatBlock').toLowerCase() === arg) exec('formatBlock', 'div');
    else exec(cmd, arg || null);
  });
  // 붙여넣기는 글자만 받습니다 (다른 사이트의 서식이 섞이지 않게).
  body.addEventListener('paste', (e) => {
    e.preventDefault();
    exec('insertText', (e.clipboardData || window.clipboardData).getData('text/plain'));
  });

  $('#postForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = $('#postTitle').value.trim();
    if (!title) { toast('제목을 입력해 주세요', true); $('#postTitle').focus(); return; }
    if (!body.textContent.trim() && !body.querySelector('img')) { toast('본문을 입력해 주세요', true); body.focus(); return; }
    const save = $('#postSave');
    save.disabled = true;
    try {
      const { post } = await api(editing ? `/posts/${editing.id}` : '/posts', jsonBody({ title, body: body.innerHTML, category: $('#postCat').value.trim() }));
      toast(editing ? '게시글을 수정했어요' : '게시글을 등록했어요');
      location.hash = `#menu3?post=${post.id}`;
    } catch (err) {
      toast(err.message, true);
      save.disabled = false;
    }
  });
  $('#postTitle').focus();
}

async function boardPost(root, menu, id) {
  let data;
  try { data = await api(`/posts/${encodeURIComponent(id)}`); }
  catch (e) {
    root.innerHTML = `<section class="card"><div class="empty"><h2>${esc(e.message)}</h2><p></p><a class="btn btn-soft" href="#menu3">목록으로</a></div></section>`;
    return;
  }
  if (!root.isConnected) return;
  const { post } = data;
  let comments = data.comments;
  root.innerHTML = `
    <header class="page-head">
      <a class="btn btn-soft" href="#menu3">${icon('back')} 목록</a>
      <div class="row-actions">
        <button class="btn btn-ghost pin-btn${post.pinned ? ' on' : ''}" type="button" id="postPin" aria-pressed="${post.pinned ? 'true' : 'false'}">${icon('pin')} ${post.pinned ? '고정 해제' : '상단 고정'}</button>
        <a class="btn btn-soft" href="#menu3?edit=${post.id}">${icon('edit')} 수정</a>
        <button class="btn btn-ghost" type="button" id="postDel">${icon('trash')} 글 삭제</button>
      </div>
    </header>
    <article class="card">
      <h1 class="post-title">${esc(post.title)}</h1>
      <p class="row-sub">${post.category ? `<a class="chip add cat-chip" href="#menu3?cat=${post.category_id}">${esc(post.category)}</a>` : ''}${fmtDateTime(post.created_at)} 작성${post.updated_at ? ` · ${fmtDateTime(post.updated_at)} 수정` : ''}</p>
      <!-- 본문은 서버가 허용된 서식 태그만 남겨 저장한 HTML입니다 -->
      <div class="post-body post-view">${post.body}</div>
    </article>
    <section class="card" style="margin-top:16px">
      <div class="card-head"><h2 class="card-title">댓글</h2><span class="muted" id="cmtCount"></span></div>
      <ul class="rows" id="cmtList"></ul>
      <form class="comment-form" id="cmtForm">
        <textarea class="field" id="cmtText" rows="2" maxlength="2000" placeholder="댓글을 입력하세요 (Ctrl+Enter로 등록)" aria-label="댓글"></textarea>
        <button class="btn btn-blue" type="submit" id="cmtSave">등록</button>
      </form>
    </section>`;

  const list = $('#cmtList');
  const draw = () => {
    $('#cmtCount').textContent = comments.length ? `${comments.length}개` : '';
    list.innerHTML = comments.length ? comments.map((c) => `
      <li class="row comment">
        <span class="mini-icon">${icon('chat')}</span>
        <div class="row-main">
          <p class="comment-text">${esc(c.body)}</p>
          <p class="row-sub">${fmtDateTime(c.created_at)}</p>
        </div>
        <div class="row-actions">
          <button class="btn btn-ghost btn-sm" type="button" data-del="${c.id}" aria-label="댓글 삭제">${icon('trash')}<span>삭제</span></button>
        </div>
      </li>`).join('') : '<li class="empty-inline">아직 댓글이 없어요.</li>';
  };
  draw();

  $('#postDel').addEventListener('click', async () => { if (await deletePost(post)) location.hash = '#menu3'; });
  $('#postPin').addEventListener('click', async () => {
    try { await api(`/posts/${post.id}/pin`, jsonBody({ pinned: !post.pinned })); toast(post.pinned ? '고정을 해제했어요' : '목록 맨 위에 고정했어요'); show(); }
    catch (err) { toast(err.message, true); }
  });

  list.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-del]');
    if (!btn) return;
    const c = comments.find((x) => x.id === btn.dataset.del);
    if (!c || !(await confirmDelete(c.body.length > 40 ? c.body.slice(0, 40) + '…' : c.body, '댓글'))) return;
    try {
      await api(`/comments/${c.id}`, { method: 'DELETE' });
      comments = comments.filter((x) => x.id !== c.id);
      draw();
      toast('댓글을 삭제했어요');
    } catch (err) { toast(err.message, true); }
  });

  const text = $('#cmtText');
  const form = $('#cmtForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = text.value.trim();
    if (!value) { text.focus(); return; }
    $('#cmtSave').disabled = true;
    try {
      const { comment } = await api(`/posts/${post.id}/comments`, jsonBody({ body: value }));
      comments.push(comment);
      text.value = '';
      draw();
    } catch (err) { toast(err.message, true); }
    $('#cmtSave').disabled = false;
  });
  text.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); } });
}

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
}
// 설정에서 바꾼 메뉴 이름을 적용
function applyMenuNames() {
  MENUS.forEach((m) => { m.label = (CONFIG.menus || {})[m.id] || m.base; });
  drawNav();
}
drawNav();

function route() {
  const [id, query = ''] = location.hash.slice(1).split('?');
  return { menu: MENUS.find((m) => m.id === id) || MENUS[0], params: new URLSearchParams(query) };
}

function show() {
  const { menu, params } = route();
  cleanups.forEach((fn) => fn());
  cleanups = [];
  document.querySelectorAll('#sidebar .nav-item').forEach((a) => {
    if (a.dataset.id === menu.id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  main.classList.toggle('wide', Boolean(menu.wide));
  main.innerHTML = `<div class="view">${(menu.render || renderEmpty)(menu)}</div>`;
  document.title = `${menu.label} · My Site`;
  setDrawer(false);
  if (menu.mount) menu.mount(menu, params);
}

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
  collapseBtn.querySelector('.nav-text').textContent = on ? '메뉴 펼치기' : '메뉴 접기';
  try { localStorage.setItem('sidebar-collapsed', on ? '1' : ''); } catch (e) { /* 저장 불가 환경은 무시 */ }
}
collapseBtn.addEventListener('click', () => setCollapsed(!app.classList.contains('collapsed')));
try { if (localStorage.getItem('sidebar-collapsed')) setCollapsed(true); } catch (e) { /* 무시 */ }

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
api('/config').then((c) => { CONFIG = c; applyMenuNames(); }).catch(() => {}).finally(show);
watchMail();
setInterval(watchMail, 30000);

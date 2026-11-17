// 진입점: 모듈을 불러오고 셸을 시작합니다.
import { api, jsonBody, toLogin } from './core/api.js';
import { setSubTabs } from './core/chrome.js';
import { confirmDelete } from './core/dialogs.js';
import { $, esc, toast } from './core/dom.js';
import { extBadge, fmtBytes, fmtDateTime, fmtTime, numFmt } from './core/format.js';
import { hooks } from './core/hooks.js';
import { icon } from './core/icons.js';
import { KIND_LABEL, KIND_MENU, MENUS } from './core/registry.js';
import { config, every, lifecycle, runCleanups } from './core/state.js';
import { acceptOf } from './core/uploads.js';
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
   Menu 3: 게시판 — 목록(#menu3) · 글쓰기(#menu3?write=1) · 글 보기(#menu3?post=ID)
------------------------------------------------------------------- */
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

  setSubTabs($('.cat-tabs', root));   // 카테고리 탭을 FM식 서브탭 줄로 옮김

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
  lifecycle.cleanups.push(() => picker.remove());
  const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
  picker.addEventListener('change', async () => {
    const file = picker.files[0];
    const asImage = picker.dataset.mode === 'image';
    picker.value = '';
    if (!file) return;
    try {
      if (config.max_upload && file.size > config.max_upload) throw new Error(`파일이 너무 커요 (최대 ${fmtBytes(config.max_upload)})`);
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

// Menu 3: 게시판
import { api, jsonBody } from '../core/api.js';
import { confirmDelete } from '../core/dialogs.js';
import { $, esc, toast } from '../core/dom.js';
import { fmtDateTime } from '../core/format.js';
import { hooks } from '../core/hooks.js';
import { icon } from '../core/icons.js';
import { attachDraft } from './board-editor/draft.js';
import { attachMarkdownShortcuts } from './board-editor/markdown.js';
import { attachMedia } from './board-editor/media.js';
import { decorateFiles } from './board-editor/filechip.js';

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

const avatarColor = (t) => { let h = 0; for (const ch of String(t)) h = (h * 31 + ch.codePointAt(0)) % 6; return h; };
function ago(iso) {
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!(sec >= 0) || sec > 7 * 86400) return fmtDateTime(iso);
  if (sec < 60) return '방금 전';
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  return `${Math.floor(sec / 86400)}일 전`;
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
    <section class="card board-list">
      <div class="card-head"><h2 class="card-title">게시글 <span class="muted">${shown.length ? `${shown.length}개` : ''}</span></h2>
        <button class="btn btn-ghost btn-sm" type="button" id="sortBtn">${icon('sort')} ${oldFirst ? '오래된순' : '최신순'}</button></div>
      ${shown.length ? `<ul class="rows">${shown.map((p) => `
        <li class="row${p.pinned ? ' is-pinned' : ''}">
          <span class="post-avatar" data-c="${avatarColor(p.category || p.title)}" aria-hidden="true">${esc([...(p.category || p.title || '?')][0].toUpperCase())}</span>
          <a class="row-main post-link" href="#menu3?post=${p.id}">
            <p class="row-title">${p.pinned ? `<span class="pin-mark" title="고정됨">${icon('pin')}</span>` : ''}${p.category ? `<span class="chip add cat-chip" data-c="${avatarColor(p.category)}">${esc(p.category)}</span>` : ''}<span class="t">${esc(p.title)}</span></p>
            ${p.excerpt ? `<p class="post-excerpt">${esc(p.excerpt)}</p>` : ''}
            <p class="row-sub"><span>${ago(p.created_at)}</span><span class="cm" title="댓글">${icon('chat')} ${p.comments}</span></p>
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
      <div class="draft-banner" id="draftBanner" hidden></div>
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
        <span class="draft-status muted" id="draftStatus" aria-live="polite"></span>
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
    decorateFiles(body, { editable: true });
  }

  const media = attachMedia(body, { exec, onChange: () => draft.touch() });
  attachMarkdownShortcuts(body, exec);
  const draft = attachDraft({ key: `board-draft:${editing ? editing.id : 'new'}`, body, editing });

  // 버튼을 눌러도 본문의 선택 영역이 풀리지 않게 합니다.
  $('#toolbar').addEventListener('mousedown', (e) => e.preventDefault());
  $('#toolbar').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cmd]');
    if (!btn) return;
    body.focus();
    const { cmd, arg } = btn.dataset;
    if (cmd === 'image' || cmd === 'file') media.openPicker(cmd);
    else if (cmd === 'link') {
      const ranged = media.reselect();
      let url = (prompt('링크 주소를 입력하세요', 'https://') || '').trim();
      if (!url || url === 'https://') return;
      if (!/^(https?:\/\/|mailto:)/i.test(url)) url = 'https://' + url;
      if (ranged && media.reselect()) exec('createLink', url);
      else media.insertHtml(`<a href="${esc(url)}">${esc(url)}</a>&nbsp;`);
    } else if (cmd === 'clear') { exec('removeFormat'); exec('formatBlock', 'div'); }
    else if (cmd === 'formatBlock' && document.queryCommandValue('formatBlock').toLowerCase() === arg) exec('formatBlock', 'div');
    else exec(cmd, arg || null);
  });
  // Ctrl+S: 브라우저 저장 창 대신 글을 등록(저장)한다
  $('#postForm').addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); $('#postForm').requestSubmit(); }
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
      draft.finish();   // 저장됐으니 임시저장본은 지운다
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
      <p class="row-sub">${post.category ? `<a class="chip add cat-chip" data-c="${avatarColor(post.category)}" href="#menu3?cat=${post.category_id}">${esc(post.category)}</a>` : ''}${fmtDateTime(post.created_at)} 작성${post.updated_at ? ` · ${fmtDateTime(post.updated_at)} 수정` : ''}</p>
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

  decorateFiles(root.querySelector('.post-view'));   // 첨부 링크를 아이콘 붙은 파일 칸으로
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
    try { await api(`/posts/${post.id}/pin`, jsonBody({ pinned: !post.pinned })); toast(post.pinned ? '고정을 해제했어요' : '목록 맨 위에 고정했어요'); hooks.show(); }
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

export { mountBoard, renderBoard };

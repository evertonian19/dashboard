// Menu 2: 다이어그램
import { api, jsonBody } from '../core/api.js';
import { $, errLine, esc, toast } from '../core/dom.js';
import { extBadge, fmtBytes, fmtDateTime } from '../core/format.js';
import { hooks } from '../core/hooks.js';
import { icon } from '../core/icons.js';
import { acceptOf, deleteFile, extListOf, uploadFiles } from '../core/uploads.js';

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
    if (file && await deleteFile(file)) hooks.show();
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
    try { await api(`/files/${current.id}/meta`, jsonBody({ title: $('#dgTitleIn').value, note: $('#dgNoteIn').value })); toast('저장했어요'); hooks.show(); }
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

export { dgTitle, mountDiagrams, renderDiagrams };

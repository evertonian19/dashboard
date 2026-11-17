// Menu 4: 문서
import { api } from '../core/api.js';
import { $, esc, toast } from '../core/dom.js';
import { extBadge, fmtBytes, fmtDateTime } from '../core/format.js';
import { hooks } from '../core/hooks.js';
import { icon } from '../core/icons.js';
import { config } from '../core/state.js';
import { deleteFile, extListOf, wireUploader } from '../core/uploads.js';

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
  const reload = (id) => { const h = `#menu4${id ? `?file=${id}` : ''}`; if (location.hash === h) hooks.show(); else location.hash = h; };
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
        ${(config.pdf_sources || []).includes(f.ext) ? `<button class="btn btn-soft btn-sm" type="button" data-pdf="${f.id}" aria-label="${esc(f.name)} PDF로 변환">${icon('pdf')}<span>PDF로 변환</span></button>` : ''}
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

export { mountDocuments, renderDocuments };

// 파일 등록 · 삭제 (다이어그램, 문서 공용)
import { api } from './api.js';
import { confirmDelete } from './dialogs.js';
import { toast } from './dom.js';
import { fmtBytes } from './format.js';
import { config, lifecycle } from './state.js';

/* ------------------------------------------------------------------
   파일 등록 · 삭제 (Menu 2, Menu 4 공용)
------------------------------------------------------------------- */
async function uploadFiles(kind, fileList) {
  const files = [...fileList];
  if (!files.length) return null;
  let last = null, okCount = 0;
  for (const file of files) {
    try {
      if (config.max_upload && file.size > config.max_upload) throw new Error(`파일이 너무 커요 (최대 ${fmtBytes(config.max_upload)})`);
      const res = await api(`/files?kind=${kind}&name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file });
      last = res.file; okCount++;
    } catch (e) {
      toast(`${file.name}: ${e.message}`, true);
    }
  }
  if (okCount) toast(okCount === 1 ? `${last.name} 등록했어요` : `${okCount}개 파일을 등록했어요`);
  return last;
}

const acceptOf = (kind) => (config.kinds[kind]?.ext || []).join(',');
const extListOf = (kind) => (config.kinds[kind]?.ext || []).map((e) => e.slice(1)).join(', ');

// 버튼(파일 선택)과 끌어다 놓기를 한 영역에 연결
function wireUploader({ kind, button, dropZone, onDone }) {
  const input = document.createElement('input');
  input.type = 'file'; input.multiple = true; input.accept = acceptOf(kind); input.hidden = true;
  document.body.appendChild(input);
  lifecycle.cleanups.push(() => input.remove());
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

export { acceptOf, deleteFile, extListOf, uploadFiles, wireUploader };

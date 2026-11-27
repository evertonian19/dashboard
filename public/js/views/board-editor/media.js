// 게시판 편집기: 이미지·파일 넣기 — 버튼 선택, 붙여넣기(스크린샷·복사한 이미지), 끌어다 놓기
import { api } from '../../core/api.js';
import { esc, toast } from '../../core/dom.js';
import { fmtBytes } from '../../core/format.js';
import { config, lifecycle } from '../../core/state.js';
import { acceptOf } from '../../core/uploads.js';
import { decorateFiles } from './filechip.js';

// 붙여넣은 이미지의 형식 → 확장자 (서버가 받는 이미지 형식과 같다)
const IMG_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };
const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const pad2 = (n) => String(n).padStart(2, '0');
const stamp = () => { const d = new Date(); return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`; };
const clipboardFiles = (cd) => (cd.files && cd.files.length ? [...cd.files]
  : [...(cd.items || [])].filter((i) => i.kind === 'file').map((i) => i.getAsFile()).filter(Boolean));
const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');

function pointRange(e) {
  if (document.caretRangeFromPoint) return document.caretRangeFromPoint(e.clientX, e.clientY);
  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(e.clientX, e.clientY);
    if (pos) { const r = document.createRange(); r.setStart(pos.offsetNode, pos.offset); r.collapse(true); return r; }
  }
  return null;
}

// body(contenteditable)에 이미지·파일 넣기를 붙인다. exec = document.execCommand 래퍼, onChange = 본문이 바뀌었을 때 부를 함수.
export function attachMedia(body, { exec, onChange }) {
  // 커서 위치 기억: 파일 선택 창을 여는 동안 본문의 선택 영역이 풀리기 때문
  let savedRange = null;
  const remember = () => {
    const sel = getSelection();
    if (sel.rangeCount && body.contains(sel.anchorNode)) savedRange = sel.getRangeAt(0).cloneRange();
  };
  ['keyup', 'mouseup', 'blur', 'input'].forEach((ev) => body.addEventListener(ev, remember));
  const select = (range) => { body.focus(); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range); };
  const insertHtml = (markup) => {
    body.focus();
    if (savedRange) select(savedRange);
    exec('insertHTML', markup);
    remember();
  };

  // 자리표시자를 range(없으면 마지막으로 기억한 커서, 그것도 없으면 본문 끝)에 넣고 커서를 그 뒤로 옮긴다.
  const placeAt = (node, range) => {
    let r = range && body.contains(range.startContainer) ? range : savedRange;
    if (!r || !body.contains(r.startContainer)) { r = document.createRange(); r.selectNodeContents(body); r.collapse(false); }
    r.deleteContents();
    r.insertNode(node);
    const after = document.createRange();
    after.setStartAfter(node); after.collapse(true);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(after);
    savedRange = after.cloneRange();
  };
  // 파일 하나를 올리고 본문에 넣는다: 이미지는 <img>, 그 밖의 파일은 내려받기 링크. 올리는 동안은 자리표시자가 보인다.
  const uploadInto = async (file, asImage, range = null) => {
    if (config.max_upload && file.size > config.max_upload) { toast(`${file.name}: 파일이 너무 커요 (최대 ${fmtBytes(config.max_upload)})`, true); return; }
    const mark = document.createElement('span');
    mark.className = 'img-uploading';
    mark.contentEditable = 'false';
    mark.textContent = asImage ? '이미지 올리는 중…' : `${file.name} 올리는 중…`;
    placeAt(mark, range);
    try {
      const { file: saved } = await api(`/files?kind=attachment&name=${encodeURIComponent(file.name)}`, { method: 'POST', body: file });
      const tpl = document.createElement('template');
      tpl.innerHTML = asImage ? `<img src="/api/files/${saved.id}/raw" alt=""><br>`
        : `<a href="/api/files/${saved.id}/raw?download">${esc(saved.name)}</a><br>`;
      decorateFiles(tpl.content, { editable: true });   // 파일은 아이콘이 붙은 칸으로
      mark.replaceWith(tpl.content);
      onChange();
    } catch (err) { mark.remove(); toast(`${file.name}: ${err.message}`, true); }
  };

  // 툴바 버튼: 파일 선택 창
  const picker = document.createElement('input');
  picker.type = 'file'; picker.hidden = true;
  document.body.appendChild(picker);
  lifecycle.cleanups.push(() => picker.remove());
  picker.addEventListener('change', async () => {
    const file = picker.files[0];
    const asImage = picker.dataset.mode === 'image';
    picker.value = '';
    if (file) await uploadInto(file, asImage);
  });
  const openPicker = (mode) => {
    remember();
    picker.dataset.mode = mode;
    picker.accept = mode === 'image' ? IMAGE_EXT.join(',') : acceptOf('attachment');
    picker.click();
  };

  // 붙여넣기: 스크린샷·복사한 이미지는 올려서 넣고, 글자는 서식 없이 글자만 받는다 (다른 사이트의 서식이 섞이지 않게).
  body.addEventListener('paste', async (e) => {
    e.preventDefault();
    const cd = e.clipboardData || window.clipboardData;
    const text = cd.getData('text/plain');
    const images = clipboardFiles(cd).filter((f) => f.type.startsWith('image/'));
    if (!images.length || text.trim()) { exec('insertText', text); return; }   // 글자가 같이 있으면(표 복사 등) 글자만
    remember();
    let n = 0;
    for (const f of images) {
      const ext = IMG_TYPES[f.type];
      if (!ext) { toast('이 이미지 형식은 붙여넣을 수 없어요 (png · jpg · gif · webp)', true); continue; }
      await uploadInto(new File([f], `paste-${stamp()}${n ? `-${n + 1}` : ''}.${ext}`, { type: f.type }), true);
      n++;
    }
  });
  // 끌어다 놓기: 이미지는 놓은 자리에, 다른 파일은 내려받기 링크로 넣는다. 글자 끌어다 놓기는 브라우저 기본 동작.
  body.addEventListener('dragover', (e) => { if (hasFiles(e)) { e.preventDefault(); body.classList.add('over'); } });
  body.addEventListener('dragleave', () => body.classList.remove('over'));
  body.addEventListener('drop', async (e) => {
    body.classList.remove('over');
    const files = [...(e.dataTransfer?.files || [])];
    if (!files.length) return;
    e.preventDefault();
    let range = pointRange(e);
    for (const f of files) { await uploadInto(f, f.type in IMG_TYPES, range); range = null; }   // 첫 파일만 놓은 자리, 나머지는 그 뒤에 이어서
  });

  return {
    openPicker,
    insertHtml,
    // 링크 넣기용: 드래그로 고른 글자가 있으면 그 범위를 다시 선택하고 true
    reselect() { remember(); if (savedRange && !savedRange.collapsed) { select(savedRange); return true; } return false; },
  };
}

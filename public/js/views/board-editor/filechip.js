// 게시글의 첨부 링크(/api/files/<id>/raw?download)를 "파일 칸"으로 보이게 한다.
// 본문 글자는 그대로 두고 표시용 속성(class·data-ext)만 입힌다. 이 속성은 저장할 때 서버가 지우므로
// 글 보기·글쓰기·임시저장 복원에서 매번 다시 불러 준다. 여러 번 불러도 결과는 같다.
const FILE_HREF = /^\/api\/files\/[0-9a-f]{12}\/raw\?download$/;

export function extOf(name) {
  const m = /\.([A-Za-z0-9]{1,5})\s*$/.exec(String(name).replace(/ /g, ' ').trim());
  return m ? m[1].toLowerCase() : 'file';
}

// 링크 하나를 파일 칸으로 만든다.
export function chipify(a, { editable = false } = {}) {
  a.classList.add('file-chip');
  a.dataset.ext = extOf(a.textContent);
  const next = a.nextSibling;   // 예전 글에서 링크 뒤에 붙던 공백(&nbsp;)은 칸 사이를 벌리므로 치운다
  if (next && next.nodeType === 3 && !next.textContent.replace(/[\s\u00a0]/g, '')) next.remove();
  if (editable) a.contentEditable = 'false';   // 칸이 통째로 하나로 지워지고, 글자처럼 쪼개 편집되지 않게
  return a;
}

export function decorateFiles(root, opts = {}) {
  for (const a of root.querySelectorAll('a[href]')) {
    if (FILE_HREF.test(a.getAttribute('href'))) chipify(a, opts);
  }
}

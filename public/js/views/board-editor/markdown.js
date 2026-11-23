// 게시판 편집기: 마크다운 단축입력 — 줄 맨 앞의 표식 뒤에서 Space → 목록·제목·인용
const SHORTCUTS = { '-': ['insertUnorderedList'], '*': ['insertUnorderedList'], '1.': ['insertOrderedList'], '##': ['formatBlock', 'h2'], '###': ['formatBlock', 'h3'], '>': ['formatBlock', 'blockquote'] };
const BLOCK_TAG = /^(DIV|P|LI|H2|H3|BLOCKQUOTE|UL|OL)$/;

export function attachMarkdownShortcuts(body, exec) {
  const atLineStart = (node) => {
    for (let n = node; n && n !== body; n = n.parentNode) {
      let p = n.previousSibling;
      while (p && p.nodeType === 3 && !p.textContent) p = p.previousSibling;
      if (p) return p.nodeName === 'BR' || BLOCK_TAG.test(p.nodeName);
      if (BLOCK_TAG.test(n.parentNode.nodeName)) return true;
    }
    return true;
  };
  const apply = () => {
    const sel = getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return false;
    const node = sel.anchorNode;
    if (!node || node.nodeType !== 3 || !body.contains(node)) return false;
    const marker = node.textContent.slice(0, sel.anchorOffset);
    const cmd = SHORTCUTS[marker];
    if (!cmd || node.parentElement.closest('li, h2, h3, blockquote') || !atLineStart(node)) return false;
    const r = document.createRange();
    r.setStart(node, 0); r.setEnd(node, marker.length); r.deleteContents();
    exec(cmd[0], cmd[1] || null);
    return true;
  };
  body.addEventListener('keydown', (e) => {
    if (e.key === ' ' && !e.isComposing && !e.ctrlKey && !e.metaKey && !e.altKey && apply()) e.preventDefault();
  });
}

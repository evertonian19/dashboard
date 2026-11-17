// DOM 도우미: 선택자, 이스케이프, 알림, 안전한 채우기

/* ------------------------------------------------------------------
   공통 도구
------------------------------------------------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(message, isError = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.textContent = message;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), isError ? 5000 : 2600);
}

// 화면에 아직 그 요소가 있을 때만 그립니다 (다른 메뉴로 옮긴 뒤 도착한 응답 무시).
const fill = (sel, html) => { const el = $(sel); if (el) el.innerHTML = html; return el; };
const errLine = (e) => `<p class="empty-inline">${esc(e.message)}</p>`;

export { $, errLine, esc, fill, toast };

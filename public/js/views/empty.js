// 내용이 아직 없는 메뉴
import { esc } from '../core/dom.js';
import { icon } from '../core/icons.js';

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

export { renderEmpty };

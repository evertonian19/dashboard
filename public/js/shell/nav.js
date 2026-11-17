// 좌측 메뉴 · 상단 주 메뉴 그리기
import { $, esc } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { MENUS } from '../core/registry.js';
import { config } from '../core/state.js';

const nav = $('#nav');

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

export { applyMenuNames };

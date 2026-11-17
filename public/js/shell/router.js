// 화면 전환
import { setSubTabs } from '../core/chrome.js';
import { $ } from '../core/dom.js';
import { MENUS } from '../core/registry.js';
import { runCleanups } from '../core/state.js';
import { setDrawer } from './layout.js';
import { renderEmpty } from '../views/empty.js';

/* ------------------------------------------------------------------
   화면 전환
------------------------------------------------------------------- */

const main = $('#main');

function route() {
  const [id, query = ''] = location.hash.slice(1).split('?');
  return { menu: MENUS.find((m) => m.id === id) || MENUS[0], params: new URLSearchParams(query) };
}

function show() {
  const { menu, params } = route();
  runCleanups();
  document.querySelectorAll('#sidebar .nav-item, #topNav .topnav-item').forEach((a) => {
    if (a.dataset.id === menu.id) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  main.classList.toggle('wide', Boolean(menu.wide));
  ctxTitle.textContent = menu.label;
  setSubTabs(null);
  main.innerHTML = `<div class="view">${(menu.render || renderEmpty)(menu)}</div>`;
  document.title = `${menu.label} · My Site`;
  setDrawer(false);
  if (menu.mount) menu.mount(menu, params);
}

const ctxTitle = $('#ctxTitle');

export { show };

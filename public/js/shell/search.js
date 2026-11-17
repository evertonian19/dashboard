// 검색: 메뉴 이름 + 등록된 파일 이름
import { api } from '../core/api.js';
import { $, esc } from '../core/dom.js';
import { extBadge, fmtDateTime } from '../core/format.js';
import { icon } from '../core/icons.js';
import { KIND_LABEL, KIND_MENU, MENUS } from '../core/registry.js';
import { setDrawer } from './layout.js';
import { dgTitle } from '../views/diagrams.js';

/* ------------------------------------------------------------------
   검색: 메뉴 이름 + 등록된 파일 이름
------------------------------------------------------------------- */
const searchInput = $('#searchInput');
const searchPanel = $('#searchPanel');
let searchSeq = 0, searchTimer;

function closeSearch() { searchPanel.hidden = true; }

async function runSearch() {
  const term = searchInput.value.trim();
  const seq = ++searchSeq;
  if (!term) return closeSearch();

  const menus = MENUS.filter((m) => m.label.toLowerCase().includes(term.toLowerCase()));
  let files = [], posts = [], error = '';
  try { ({ files, posts = [] } = await api(`/search?q=${encodeURIComponent(term)}`)); } catch (e) { error = e.message; }
  if (seq !== searchSeq) return; // 더 최근 검색이 있음

  const menuLabel = (id) => MENUS.find((m) => m.id === id)?.label || '';
  let html = '';
  if (menus.length) {
    html += '<p class="search-group">메뉴</p>' + menus.map((m) => `
      <a class="search-item" href="#${m.id}"><span class="mini-icon">${icon(m.icon)}</span><span><b>${esc(m.label)}</b><small>메뉴로 이동</small></span></a>`).join('');
  }
  if (files.length) {
    html += '<p class="search-group">파일</p>' + files.map((f) => `
      <a class="search-item" href="#${KIND_MENU[f.kind]}?file=${f.id}">${extBadge(f.ext)}<span><b>${esc(f.kind === 'diagram' ? dgTitle(f) : f.name)}</b><small>${esc(menuLabel(KIND_MENU[f.kind]))} · ${esc(KIND_LABEL[f.kind])} · ${fmtDateTime(f.created_at)}</small></span></a>`).join('');
  }
  if (posts.length) {
    html += '<p class="search-group">게시글</p>' + posts.map((p) => `
      <a class="search-item" href="#menu3?post=${p.id}"><span class="mini-icon">${icon('note')}</span><span><b>${esc(p.title)}</b><small>${esc(menuLabel('menu3'))} · 게시글 · ${fmtDateTime(p.created_at)}</small></span></a>`).join('');
  }
  searchPanel.innerHTML = html || `<p class="search-empty">${esc(error || `"${term}"에 맞는 결과가 없어요`)}</p>`;
  searchPanel.hidden = false;
}

searchInput.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(runSearch, 180); });
searchInput.addEventListener('focus', () => { if (searchInput.value.trim()) runSearch(); });
searchInput.addEventListener('keydown', (e) => {
  const items = [...searchPanel.querySelectorAll('.search-item')];
  const idx = items.findIndex((el) => el.classList.contains('active'));
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!items.length) return;
    e.preventDefault();
    const next = (idx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items.forEach((el, i) => el.classList.toggle('active', i === next));
    items[next].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') {
    const pick = items[idx] || items[0];
    if (pick && !searchPanel.hidden) { e.preventDefault(); pick.click(); }
  }
});
searchPanel.addEventListener('click', (e) => {
  if (e.target.closest('.search-item')) { closeSearch(); searchInput.value = ''; searchInput.blur(); }
});
document.addEventListener('click', (e) => { if (!e.target.closest('#searchWrap')) closeSearch(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeSearch(); setDrawer(false); }
  if (e.key === '/' && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) { e.preventDefault(); searchInput.focus(); }
});

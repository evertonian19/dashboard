// 메뉴바: 서랍(좁은 화면)과 접기(넓은 화면)
import { $ } from '../core/dom.js';

const app = $('#app');

const scrim = $('#scrim');
const menuBtn = $('#menuBtn');
const collapseBtn = $('#collapseBtn');

// 좁은 화면: 메뉴바를 서랍처럼 열고 닫기
function setDrawer(open) {
  app.classList.toggle('nav-open', open);
  scrim.hidden = !open;
  menuBtn.setAttribute('aria-expanded', String(open));
}
menuBtn.addEventListener('click', () => setDrawer(!app.classList.contains('nav-open')));
scrim.addEventListener('click', () => setDrawer(false));

// 넓은 화면: 메뉴바를 아이콘만 남기고 접기 (선택은 브라우저에 기억)
function setCollapsed(on) {
  app.classList.toggle('collapsed', on);
  collapseBtn.setAttribute('aria-pressed', String(on));
  collapseBtn.querySelector('.nav-text').textContent = on ? '이름 표시' : '이름 숨기기';
  try { localStorage.setItem('sidebar-collapsed', on ? '1' : '0'); } catch (e) { /* 저장 불가 환경은 무시 */ }
}
collapseBtn.addEventListener('click', () => setCollapsed(!app.classList.contains('collapsed')));
// FM27 북마크 바처럼 기본은 아이콘만, 이름 표시는 사용자가 켜면 기억
let startCollapsed = true;
try { if (localStorage.getItem('sidebar-collapsed') === '0') startCollapsed = false; } catch (e) { /* 무시 */ }
setCollapsed(startCollapsed);

export { setDrawer };

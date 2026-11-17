// 주간 / 야간 모드
import { $ } from '../core/dom.js';

/* ------------------------------------------------------------------
   주간 / 야간 모드
------------------------------------------------------------------- */
$('#themeBtn').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) { /* 무시 */ }
});

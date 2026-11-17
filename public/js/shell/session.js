// 로그아웃 · 자동 로그아웃
import { api, toLogin } from '../core/api.js';
import { $ } from '../core/dom.js';

/* ------------------------------------------------------------------
   로그아웃 · 자동 로그아웃
------------------------------------------------------------------- */
$('#logoutBtn').addEventListener('click', async () => {
  try { await api('/logout', { method: 'POST' }); } catch (e) { /* 그래도 로그인 화면으로 */ }
  toLogin();
});
api('/session').then((s) => {
  if (!s.authenticated) return toLogin();
  // 로그인 6시간 뒤 만료 시각에 맞춰 화면을 닫습니다.
  setTimeout(toLogin, Math.min(Math.max(0, s.expires * 1000 - Date.now()) + 1000, 2 ** 31 - 1));
}).catch(() => {});

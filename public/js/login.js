const form = document.getElementById('loginForm');
const errorEl = document.getElementById('loginError');
const btn = document.getElementById('loginBtn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  btn.disabled = true;
  let message = '';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'dashboard' },
      body: JSON.stringify({ username: form.username.value, password: form.password.value }),
    });
    if (res.ok) { location.replace('/' + location.hash); return; }
    message = (await res.json().catch(() => ({}))).error || `로그인에 실패했어요 (${res.status})`;
  } catch (err) {
    message = '서버에 연결할 수 없어요';
  }
  errorEl.textContent = message;
  errorEl.hidden = false;
  btn.disabled = false;
  form.password.value = '';
  form.password.focus();
});

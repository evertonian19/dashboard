// 서버 API 호출

// 로그인이 풀렸으면 로그인 화면으로 (보던 메뉴는 주소에 남겨 둡니다)
const toLogin = () => location.replace('/login.html' + location.hash);

async function api(path, opts = {}) {
  let res;
  try {
    res = await fetch('/api' + path, { ...opts, headers: { 'X-Requested-With': 'dashboard', ...(opts.headers || {}) } });
  } catch (e) {
    throw new Error('서버에 연결할 수 없어요');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { toLogin(); throw new Error('로그인이 필요해요'); }
  if (!res.ok) throw new Error(data.error || `요청에 실패했어요 (${res.status})`);
  return data;
}

const jsonBody = (data) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

export { api, jsonBody, toLogin };

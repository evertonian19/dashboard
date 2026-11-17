// 서울의 일출·일몰에 맞춰 하늘(해/달/별/잔디)을 갱신합니다. 서버·네트워크 없이 브라우저에서 계산합니다.
const LAT = 37.5665, LON = 126.978, TZ_MIN = 9 * 60;   // 서울 (한국은 서머타임 없음)
const MIN = 60000, DAY = 86400000;
const rad = Math.PI / 180;

// 서울 달력 기준 y-m-d 의 일출/일몰 (ms). NOAA 근사식.
function sunTimes(y, m, d) {
  const mid = Date.UTC(y, m - 1, d);
  const doy = Math.round((mid - Date.UTC(y, 0, 0)) / DAY);
  const g = (2 * Math.PI / 365) * (doy - 1);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const cosHa = Math.cos(90.833 * rad) / (Math.cos(LAT * rad) * Math.cos(dec)) - Math.tan(LAT * rad) * Math.tan(dec);
  const ha = Math.acos(Math.min(1, Math.max(-1, cosHa))) / rad;
  // 위 식은 UTC 기준 분 단위. mid 는 UTC 자정이므로 서울 달력의 자정(= UTC 전날 15시)로 보정.
  const base = mid - TZ_MIN * MIN;
  return { rise: base + (720 - 4 * (LON + ha) - eq) * MIN + TZ_MIN * MIN, set: base + (720 - 4 * (LON - ha) - eq) * MIN + TZ_MIN * MIN };
}

// now(ms) 의 서울 날짜에서 +offset 일의 일출/일몰
function seoulDay(now, offset = 0) {
  const t = new Date(now + TZ_MIN * MIN + offset * DAY);
  return sunTimes(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

// 월령 0~1 (0 신월, 0.5 보름). 기준 신월 2000-01-06 18:14 UTC, 삭망월 29.53일
const SYNODIC = 29.530588853, NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
function moonAge(now) {
  const a = ((now - NEW_MOON) / DAY / SYNODIC) % 1;
  return a < 0 ? a + 1 : a;
}
// 달의 밝은 부분 모양(SVG path, 반지름 20). 차오르는 달은 오른쪽, 기우는 달은 왼쪽이 밝음
function moonPath(age) {
  const c = Math.cos(2 * Math.PI * age), rx = (20 * Math.abs(c)).toFixed(2);
  return `M0,-20 A20,20 0 0 1 0,20 A${rx},20 0 0 ${c > 0 ? 0 : 1} 0,-20 Z`;
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
const NIGHT = [[9, 12, 30], [27, 36, 82]];
const DAYC = [[62, 150, 240], [182, 225, 255]];
const GLOW = [255, 140, 80];

// now 시각의 하늘 상태
function skyState(now) {
  const today = seoulDay(now), prev = seoulDay(now, -1), next = seoulDay(now, 1);
  const isDay = now >= today.rise && now < today.set;
  let t;
  if (isDay) t = (now - today.rise) / (today.set - today.rise);
  else {
    const from = now < today.rise ? prev.set : today.set;
    const to = now < today.rise ? today.rise : next.rise;
    t = (now - from) / (to - from);
  }
  // 일출 45분 전~45분 후, 일몰 45분 전~45분 후에 하늘색이 바뀜
  const dayF = Math.min(clamp01((now - (today.rise - 45 * MIN)) / (90 * MIN)), clamp01(((today.set + 45 * MIN) - now) / (90 * MIN)));
  const glow = 4 * dayF * (1 - dayF);
  const grass = isDay ? Math.min(clamp01((now - today.rise) / (60 * MIN)), clamp01((today.set - now) / (30 * MIN))) : 0;
  return { isDay, t: clamp01(t), dayF, glow, grass };
}

function render(now = Date.now(), age = moonAge(now)) {
  const s = skyState(now);
  const top = mix(NIGHT[0], DAYC[0], s.dayF);
  const bottom = mix(mix(NIGHT[1], DAYC[1], s.dayF), GLOW, s.glow * 0.7);
  const st = document.documentElement.style;
  st.setProperty('--sky-top', rgb(top));
  st.setProperty('--sky-bottom', rgb(bottom));
  st.setProperty('--stars', (1 - s.dayF).toFixed(2));
  st.setProperty('--grass', s.grass.toFixed(2));
  const x = (8 + 84 * s.t).toFixed(1), h = Math.sin(Math.PI * s.t).toFixed(3);
  st.setProperty('--sun-x', s.isDay ? x : '50'); st.setProperty('--sun-h', s.isDay ? h : '0'); st.setProperty('--sun-o', s.isDay ? '1' : '0');
  st.setProperty('--moon-x', s.isDay ? '50' : x); st.setProperty('--moon-h', s.isDay ? '0' : h); st.setProperty('--moon-o', s.isDay ? '0' : '1');
  document.documentElement.dataset.sky = s.isDay ? 'day' : 'night';
  // 달 위상
  const d = moonPath(age);
  const lit = document.getElementById('moonLit');   // 밝은 부분만 뒤집어 질감(바다·크레이터)은 그대로 둠
  if (lit) { lit.setAttribute('d', d); lit.setAttribute('transform', age < 0.5 ? '' : 'scale(-1 1)'); }
  st.setProperty('--moon-illum', ((1 - Math.cos(2 * Math.PI * age)) / 2).toFixed(2));
  if (s.isDay) cancelSatellite();
}

// 인공위성: 밤에 가끔 콘텐츠 위(투명 레이어)를 가로지름. 첫 비행은 8~20초 뒤, 이후 40~100초 간격
let satTimer = null, satAnim = null;
const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const satEl = () => document.querySelector('.sat-layer .sat');
function cancelSatellite() {
  if (satAnim) { satAnim.cancel(); satAnim = null; }
  const el = satEl();
  if (el) el.hidden = true;
}
function flySatellite(duration = 30000) {
  const el = satEl();
  if (!el || !el.animate || satAnim || reduced()) return;
  const ltr = Math.random() < 0.5, w = window.innerWidth, h = window.innerHeight;
  const x0 = ltr ? -60 : w + 60, x1 = ltr ? w + 60 : -60, dy = (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 40);
  const at = (f) => x0 + (x1 - x0) * f;
  el.style.top = (110 + Math.random() * h * 0.3).toFixed(0) + 'px';   // 헤더 바로 아래 ~ 화면 위쪽 40%
  el.classList.toggle('rtl', !ltr);
  el.hidden = false;
  satAnim = el.animate([
    { offset: 0, opacity: 0, transform: `translate(${x0}px, 0)` },
    { offset: 0.1, opacity: 1, transform: `translate(${at(0.1)}px, ${(dy * 0.15).toFixed(0)}px)` },
    { offset: 0.5, opacity: 1, transform: `translate(${at(0.5)}px, ${(dy * 0.6).toFixed(0)}px)` },
    { offset: 0.88, opacity: 1, transform: `translate(${at(0.88)}px, ${(dy * 0.92).toFixed(0)}px)` },
    { offset: 1, opacity: 0, transform: `translate(${x1}px, ${dy.toFixed(0)}px)` },
  ], { duration, easing: 'linear' });
  satAnim.onfinish = () => { el.hidden = true; satAnim = null; };
}
const satDelay = (first) => (first ? 8 + Math.random() * 12 : 40 + Math.random() * 60) * 1000;
function scheduleSatellite(first = false) {
  clearTimeout(satTimer);
  satTimer = setTimeout(() => {
    if (!document.hidden && document.documentElement.dataset.sky === 'night') flySatellite();
    scheduleSatellite();
  }, satDelay(first));
}

// ?sky=HH:MM (서울 시각) 이면 그 시각으로 고정해 미리 볼 수 있음
function fixedNow() {
  const m = /^(\d{1,2}):(\d{2})$/.exec(new URLSearchParams(location.search).get('sky') || '');
  if (!m) return null;
  const t = new Date(Date.now() + TZ_MIN * MIN);
  return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate(), +m[1], +m[2]) - TZ_MIN * MIN;
}

function startSky() {
  const q = new URLSearchParams(location.search);
  const moon = parseFloat(q.get('moon'));   // ?moon=0~1 : 월령 고정 미리보기
  const age = (now) => (Number.isFinite(moon) ? ((moon % 1) + 1) % 1 : moonAge(now));
  const fixed = fixedNow();
  const sat = q.get('sat');   // 미리보기: 1 = 바로 1회, loop = 11초마다 반복(짧게)
  if (sat === '1') setTimeout(flySatellite, 500);
  if (sat === 'loop') { setTimeout(() => flySatellite(9000), 500); setInterval(() => flySatellite(9000), 11000); }
  if (fixed !== null) { render(fixed, age(fixed)); return; }
  render(Date.now(), age(Date.now()));
  setInterval(() => { if (!document.hidden) render(Date.now(), age(Date.now())); }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelSatellite(); else render(Date.now(), age(Date.now())); });
  scheduleSatellite(true);
}

export { sunTimes, skyState, moonAge, moonPath, render, startSky, satDelay };

// 상단 띠: 라커룸에 Everton 2026-27 홈 유니폼(뒷면)이 걸려 있는 장식.
// 가장 최근에 확인된 경기의 선발 11명(4-2-3-1)입니다. 다음 경기 후에는 MATCH 와 LINEUP 만 고치면 됩니다.
const MATCH = { vs: 'Coventry', date: '2026-11-06' };
const LINEUP = [
  { num: 1, name: 'Pickford', gk: true },
  { num: 16, name: 'Mykolenko' }, { num: 34, name: 'Röhl' }, { num: 6, name: 'Tarkowski', captain: true }, { num: 4, name: 'Branthwaite' },
  { num: 45, name: 'Armstrong' }, { num: 37, name: 'Garner' },
  { num: 19, name: 'George' }, { num: 8, name: 'Dewsbury-Hall' }, { num: 20, name: 'Dibling' },
  { num: 11, name: 'Barry' },
];
const ITEM_W = 96, ITEM_W_MOBILE = 72;   // locker.css 의 --locker-w 와 같게 유지

// 너비에 들어가는 벌 수 (1 ~ 11, 항상 골키퍼부터)
function countFor(width, itemW) {
  return Math.min(LINEUP.length, Math.max(1, Math.floor(width / itemW)));
}

// 이름은 길수록 글자를 줄여 어깨 폭(46)에 맞춤
function nameSize(name) {
  return Math.min(7.5, 46 / (name.length * 0.7));
}

function jerseyMarkup(p) {
  const name = p.name.toUpperCase();
  const kit = p.gk ? 'jerseyGK' : 'jersey';
  return `<div class="locker-item${p.gk ? ' gk' : ''}" title="${p.num} ${p.name} · vs ${MATCH.vs} ${MATCH.date}"><svg class="jersey${p.gk ? ' gk-kit' : ''}" viewBox="0 -14 100 134" role="presentation">
    <path class="hanger" d="M50 -4V-8a3 3 0 1 1 3 3M50 -4L18 11M50 -4L82 11"/>
    <use href="#${kit}"/>
    ${p.captain ? '<path class="armband" d="M5 31.5L18 41.5L16.5 43.5L3.8 33.6Z"/>' : ''}
    <text class="jn" x="50" y="37" text-anchor="middle" font-size="${nameSize(name).toFixed(2)}">${name}</text>
    <text class="jx" x="50" y="82" text-anchor="middle" font-size="${p.num >= 10 ? 38 : 44}">${p.num}</text>
  </svg></div>`;
}

function fill(band) {
  const mobile = window.matchMedia && window.matchMedia('(max-width: 760px)').matches;
  const width = band.clientWidth || window.innerWidth || 1200;
  const n = countFor(width, mobile ? ITEM_W_MOBILE : ITEM_W);
  if (band.dataset.count === String(n)) return;
  band.dataset.count = String(n);
  band.innerHTML = LINEUP.slice(0, n).map(jerseyMarkup).join('');
}

function startLocker() {
  const band = document.getElementById('locker');
  if (!band) return;
  fill(band);
  let timer = null;
  window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(() => fill(band), 120); });
}

export { MATCH, LINEUP, countFor, nameSize, jerseyMarkup, startLocker };

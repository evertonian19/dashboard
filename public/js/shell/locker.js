// 상단 띠: 라커룸에 Everton 2026-27 홈 유니폼(뒷면)이 걸려 있는 장식. 이름·번호는 아래 배열만 고치면 바뀝니다.
// 2026-27 등번호 발표(8월 14일) 기준이며 이적 시장으로 실제 명단과 다를 수 있습니다.
const PLAYERS = [
  { num: 1, name: 'Pickford' }, { num: 2, name: 'Patterson' }, { num: 4, name: 'Branthwaite' }, { num: 5, name: 'Keane' },
  { num: 6, name: 'Tarkowski' }, { num: 8, name: 'Dewsbury-Hall' }, { num: 10, name: 'Ndiaye' }, { num: 12, name: 'Travers' },
  { num: 15, name: "O'Brien" }, { num: 16, name: 'Mykolenko' }, { num: 19, name: 'George' }, { num: 20, name: 'Dibling' },
  { num: 22, name: 'Johnson' }, { num: 23, name: 'Nørgaard' }, { num: 24, name: 'Alcaraz' }, { num: 37, name: 'Garner' },
  { num: 42, name: 'Iroegbunam' },
];
const ITEM_W = 96, ITEM_W_MOBILE = 72;   // locker.css 의 --locker-w 와 같게 유지

// 너비에 들어가는 벌 수 (최소 1)
function countFor(width, itemW) {
  return Math.max(1, Math.floor(width / itemW));
}

// i 번째 칸의 선수 (목록보다 많으면 처음부터 반복)
function playerAt(i) {
  return PLAYERS[i % PLAYERS.length];
}

// 이름은 길수록 글자를 줄여 어깨 폭(46)에 맞춤
function nameSize(name) {
  return Math.min(7.5, 46 / (name.length * 0.7));
}

function jerseyMarkup(p) {
  const name = p.name.toUpperCase();
  return `<div class="locker-item"><svg class="jersey" viewBox="0 -14 100 134" role="presentation">
    <path class="hanger" d="M50 -4V-8a3 3 0 1 1 3 3M50 -4L18 11M50 -4L82 11"/>
    <use href="#jersey"/>
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
  band.innerHTML = Array.from({ length: n }, (_, i) => jerseyMarkup(playerAt(i))).join('');
}

function startLocker() {
  const band = document.getElementById('locker');
  if (!band) return;
  fill(band);
  let timer = null;
  window.addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(() => fill(band), 120); });
}

export { PLAYERS, countFor, playerAt, nameSize, jerseyMarkup, startLocker };

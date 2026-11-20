// 메뉴를 누르면 챔피언스리그 공인구(2026/27 리그 페이즈 공, assets/ball/ucl-ball.png)가 통통 튀며 굴러간다. 모션은 css/ball.css 의 키프레임.
// 좌측/하단 설정/상단 메뉴 모두 클릭 위임으로 처리하므로 nav.js 가 메뉴를 다시 그려도 그대로 동작한다.
const IMG = 'assets/ball/ucl-ball.png';   // 로컬 전용 공인구 사진(저장소에 포함하지 않음). 없으면 위 SVG 로 대체.
const MAX = 3;
const ACTIONS = ['roll', 'high', 'shot', 'juggle', 'wall'];   // css/ball.css 의 .a-<이름>
let last = '';

// 실제 공인구 사진이 없을 때만 쓰는 단순 대체 공
const SVG = `<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false"><circle cx="20" cy="20" r="18.6" fill="#EEF1F7" stroke="#8D98B0" stroke-width="1"/></svg>`;

let hasImg = false;
let live = 0;
const probe = new Image();
probe.onload = () => { hasImg = true; };
probe.src = IMG;                      // 없으면 조용히 SVG 사용

function drop(item) {
  if (live >= MAX) return;
  live += 1;
  const r = item.getBoundingClientRect();
  const ball = document.createElement('div');
  const pool = ACTIONS.filter((a) => a !== last);              // 직전 동작과 겹치지 않게 랜덤
  last = pool[Math.floor(Math.random() * pool.length)];
  ball.className = `ucl-ball a-${last}`;
  ball.setAttribute('aria-hidden', 'true');
  // 항목 오른쪽 가장자리 부근 바닥선에서 시작 (사이드바 밖으로 굴러나가도록)
  ball.style.setProperty('--x', `${Math.round(Math.min(r.right - 34, window.innerWidth - 110))}px`);
  ball.style.setProperty('--y', `${Math.round(r.bottom - 4)}px`);
  ball.innerHTML = `<i class="b-shadow"></i><div class="b-move"><div class="b-squash"><div class="b-spin">${hasImg ? `<img src="${IMG}" alt="" draggable="false">` : SVG}</div></div></div>`;
  document.body.appendChild(ball);
  const done = () => { ball.remove(); live = Math.max(0, live - 1); };
  ball.querySelector('.b-move').addEventListener('animationend', done, { once: true });
  setTimeout(() => { if (ball.isConnected) done(); }, 1300);   // 애니메이션이 꺼진 환경 대비
}

document.addEventListener('click', (e) => {
  const item = e.target instanceof Element && e.target.closest('.nav-item, .topnav-item');
  if (item) drop(item);
});

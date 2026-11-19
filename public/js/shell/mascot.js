// 좌측 사이드바 마스코트: 은혼 '사카타 긴토키' 모티브의 오리지널 SD 캐릭터.
// 마우스를 올리거나(포커스·탭) 누르면 목검 베기를 시전한다. 모든 움직임은 css/mascot.css 의 키프레임이 하고, 여기서는 클래스만 붙인다.
const SVG = `
<svg class="m-svg" viewBox="0 0 64 72" width="46" height="52" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="mHair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F7F9FD"/><stop offset="1" stop-color="#C9D3E4"/></linearGradient>
    <linearGradient id="mWood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#D49A5C"/><stop offset="1" stop-color="#9C6535"/></linearGradient>
  </defs>
  <ellipse class="m-shadow" cx="32" cy="68.5" rx="14" ry="2.6"/>
  <g class="m-legs">
    <rect x="24" y="56" width="6" height="11" rx="2.5" fill="#2B2F40" stroke="#1B1D28" stroke-width=".8"/>
    <rect x="34" y="56" width="6" height="11" rx="2.5" fill="#2B2F40" stroke="#1B1D28" stroke-width=".8"/>
    <ellipse cx="26.5" cy="67.2" rx="5" ry="2.3" fill="#171922"/><ellipse cx="37.5" cy="67.2" rx="5" ry="2.3" fill="#171922"/>
  </g>
  <g class="m-body">
    <path d="M20 40 Q32 36.5 44 40 L46 58.5 Q32 62.5 18 58.5 Z" fill="#F6F8FC" stroke="#3B4256" stroke-width="1" stroke-linejoin="round"/>
    <path d="M27 38.6 L32 51 L37 38.6 Q32 40.6 27 38.6 Z" fill="#2A2D3A"/>
    <rect x="19.2" y="49.5" width="25.6" height="4.2" rx="1.2" fill="#3A3F52" stroke="#262938" stroke-width=".6"/>
    <path d="M18.4 56.2 q2.5 -2.6 5 0 t5 0 t5 0 t5 0 t5 0 t5 0" fill="none" stroke="#4E78D6" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M19.2 59 q2.4 -2.4 4.8 0 t4.8 0 t4.8 0 t4.8 0 t4.8 0 t4.8 0" fill="none" stroke="#7C9BE6" stroke-width="1.1" stroke-linecap="round"/>
    <path d="M21 41 Q11.5 46 13.5 57.5 Q19 60 22.6 54.5 Z" fill="#F6F8FC" stroke="#3B4256" stroke-width="1" stroke-linejoin="round"/>
    <path d="M13.8 55.6 q2 -1.8 4 0 t4 -.6" fill="none" stroke="#4E78D6" stroke-width="1.2" stroke-linecap="round"/>
    <circle cx="15.4" cy="58.6" r="2.6" fill="#FBE3CF" stroke="#3B4256" stroke-width=".9"/>

    <g class="m-head">
      <g class="m-hair">
        <g fill="url(#mHair)" stroke="#3B4256" stroke-width="1">
          <circle cx="19.5" cy="21" r="6.2"/><circle cx="25.5" cy="12.4" r="7"/><circle cx="34.5" cy="9.8" r="7.2"/>
          <circle cx="43" cy="13" r="7"/><circle cx="47.6" cy="21.4" r="6"/><circle cx="16.2" cy="28.6" r="4.8"/><circle cx="49.4" cy="29.2" r="4.4"/>
        </g>
      </g>
      <ellipse cx="32" cy="26.4" rx="13.4" ry="12" fill="#FBE3CF" stroke="#3B4256" stroke-width="1"/>
      <path d="M18.6 22.4 Q23.5 31 27.6 21.6 Q32 29.4 36.2 21.4 Q41 30 45.6 22.4 Q46.4 14.6 32 14.4 Q18 14.6 18.6 22.4 Z" fill="url(#mHair)" stroke="#3B4256" stroke-width="1" stroke-linejoin="round"/>
      <g class="m-eyes">
        <ellipse cx="26" cy="27.4" rx="3.3" ry="2.7" fill="#fff" stroke="#3B4256" stroke-width=".8"/>
        <ellipse cx="38" cy="27.4" rx="3.3" ry="2.7" fill="#fff" stroke="#3B4256" stroke-width=".8"/>
        <circle cx="26.4" cy="27.9" r="1.9" fill="#B8402F"/><circle cx="38.4" cy="27.9" r="1.9" fill="#B8402F"/>
        <circle cx="26.9" cy="27.3" r=".55" fill="#fff"/><circle cx="38.9" cy="27.3" r=".55" fill="#fff"/>
        <path class="m-lid" d="M22.3 26.6 L29.7 26.6 M34.3 26.6 L41.7 26.6" stroke="#3B4256" stroke-width="1.5" stroke-linecap="round"/>
        <path class="m-lid" d="M22.5 25.6 Q26 24.2 29.4 25.6 L29.4 26.6 L22.5 26.6 Z M34.6 25.6 Q38 24.2 41.5 25.6 L41.5 26.6 L34.6 26.6 Z" fill="#F0CDB4"/>
      </g>
      <path class="m-brow" d="M22.6 22.4 L29 23.2 M41.4 22.4 L35 23.2" stroke="#8C95A8" stroke-width="1" stroke-linecap="round"/>
      <path class="m-mouth" d="M29.2 33.4 Q32 34.7 34.8 33.2" fill="none" stroke="#3B4256" stroke-width="1" stroke-linecap="round"/>
      <path class="m-glint" d="M22 25 l2.4 1 l-2.4 1 l-1 2.4 l-1 -2.4 l-2.4 -1 l2.4 -1 l1 -2.4 Z" fill="#fff"/>
    </g>

    <g class="m-sword">
      <path d="M43 41 Q51.5 38 51 31.5 L47.6 30.6 Q47.2 36 41.6 38 Z" fill="#F6F8FC" stroke="#3B4256" stroke-width="1" stroke-linejoin="round"/>
      <g transform="rotate(10 50 31)">
        <rect x="48.4" y="3.5" width="3.4" height="27" rx="1.6" fill="url(#mWood)" stroke="#5E3A1B" stroke-width=".8"/>
        <path d="M49.4 8 v14" stroke="#F0C48F" stroke-width=".6" stroke-linecap="round" opacity=".75"/>
        <rect x="48.1" y="28.4" width="4" height="7" rx="1.4" fill="#2A2D3A" stroke="#14151D" stroke-width=".6"/>
        <circle cx="50.1" cy="31.5" r="2.6" fill="#FBE3CF" stroke="#3B4256" stroke-width=".9"/>
      </g>
    </g>
  </g>
</svg>`;

const FX = `
<svg class="fx-slash" viewBox="0 0 150 150" aria-hidden="true">
  <path class="arc a1" d="M128 12 C 88 16, 34 58, 26 136"/><path class="arc a2" d="M118 22 C 84 28, 42 64, 36 128"/></svg>
<span class="fx-wave"></span><span class="fx-wave w2"></span>
<span class="fx-kanji">斬!</span>
<i class="fx-spark s1"></i><i class="fx-spark s2"></i><i class="fx-spark s3"></i><i class="fx-spark s4"></i>`;

const COOLDOWN = 1500;
let busy = false;

function mount() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar || sidebar.querySelector('.mascot')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'mascot';
  btn.setAttribute('aria-label', '긴토키 마스코트 — 올리거나 누르면 목검 베기');
  btn.innerHTML = SVG;
  const foot = sidebar.querySelector('.sidebar-foot');
  sidebar.insertBefore(btn, foot);

  const fx = document.createElement('div');
  fx.className = 'mascot-fx';
  fx.setAttribute('aria-hidden', 'true');
  fx.innerHTML = FX;
  document.body.appendChild(fx);

  const cast = () => {
    if (busy) return;
    busy = true;
    const r = btn.getBoundingClientRect();
    fx.style.setProperty('--x', `${Math.round(r.left + r.width / 2)}px`);
    fx.style.setProperty('--y', `${Math.round(r.top + r.height * 0.42)}px`);
    fx.classList.remove('go');
    btn.classList.remove('is-casting');
    void btn.offsetWidth;                     // 애니메이션을 처음부터 다시 시작
    btn.classList.add('is-casting');
    fx.classList.add('go');
    setTimeout(() => { btn.classList.remove('is-casting'); fx.classList.remove('go'); }, 1100);
    setTimeout(() => { busy = false; }, COOLDOWN);
  };
  btn.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') cast(); });
  btn.addEventListener('click', cast);
  btn.addEventListener('focus', () => { if (btn.matches(':focus-visible')) cast(); });
}

mount();

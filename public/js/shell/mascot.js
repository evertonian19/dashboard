// 좌측 사이드바 마스코트: 은혼 '사카타 긴토키' 모티브의 오리지널 SD 캐릭터.
// 마우스를 올리거나(포커스·탭) 누르면 목검 베기를 시전한다. 모든 움직임은 css/mascot.css 의 키프레임이 하고, 여기서는 클래스만 붙인다.
const SVG = `
<svg class="m-svg" viewBox="0 0 120 136" width="54" height="62" aria-hidden="true" focusable="false" shape-rendering="geometricPrecision">
  <defs>
    <linearGradient id="mHair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset=".55" stop-color="#E4EAF4"/><stop offset="1" stop-color="#BFCADD"/></linearGradient>
    <linearGradient id="mSkin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE9D6"/><stop offset="1" stop-color="#F6CDB1"/></linearGradient>
    <linearGradient id="mWood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#E2AC6E"/><stop offset=".55" stop-color="#B97F45"/><stop offset="1" stop-color="#8A5628"/></linearGradient>
    <radialGradient id="mIris" cx=".45" cy=".4" r=".7"><stop offset="0" stop-color="#E0604A"/><stop offset=".6" stop-color="#B23A2B"/><stop offset="1" stop-color="#7A2118"/></radialGradient>
  </defs>
  <ellipse class="m-shadow" cx="60" cy="130" rx="27" ry="4.6"/>
  <g class="m-legs" stroke="#1B1D28" stroke-width="1">
    <path d="M44 104 h13 l-1 20 h-11 z" fill="#2B2F40"/><path d="M63 104 h13 l1 20 h-11 z" fill="#2B2F40"/>
    <path d="M42.5 123 h15 q2.5 0 2.5 3.4 q0 3.4 -4 3.4 h-12.5 q-3.4 0 -3.4 -3.4 q0 -3.4 2.4 -3.4 z" fill="#171922"/>
    <path d="M62.5 123 h15 q2.5 0 2.5 3.4 q0 3.4 -4 3.4 h-12.5 q-3.4 0 -3.4 -3.4 q0 -3.4 2.4 -3.4 z" fill="#171922"/>
  </g>
  <g class="m-body" stroke="#434A60" stroke-width="1.1" stroke-linejoin="round">
    <path d="M36 76 Q60 68.5 84 76 L89 109 Q60 117.5 31 109 Z" fill="#F7F9FD"/>
    <path d="M73 77.5 Q86 80 89 109 Q82 112 75 110 Q78 93 73 77.5 Z" fill="#AEBBDA" fill-opacity=".28" stroke="none"/>
    <path d="M49.5 73.6 L60 98 L70.5 73.6 Q60 78 49.5 73.6 Z" fill="#262938" stroke="none"/>
    <rect x="34.5" y="93" width="51" height="8.4" rx="2.2" fill="#3A3F52" stroke="#262938" stroke-width=".8"/>
    <path d="M32 105.5 q4.7 -5 9.4 0 t9.4 0 t9.4 0 t9.4 0 t9.4 0 t9.4 0" fill="none" stroke="#4E78D6" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M33.5 112 q4.6 -4.6 9.2 0 t9.2 0 t9.2 0 t9.2 0 t9.2 0 t9.2 0" fill="none" stroke="#8FAAEA" stroke-width="1.8" stroke-linecap="round"/>
    <path d="M39 79 Q19 88 23.5 110 Q35 116 43 103.5 Z" fill="#F7F9FD"/>
    <path d="M23.8 107.5 q3.7 -3.4 7.4 0 t7.4 -1" fill="none" stroke="#4E78D6" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="27.6" cy="113.6" r="5.2" fill="url(#mSkin)"/>

    <g class="m-head">
      <g class="m-hair">
        <path d="M31 58 Q21 52 25 40 Q17 32 28 24 Q25 11 40 12 Q43 1 56 6 Q64 -3 77 6 Q91 3 93 16 Q106 20 99 33 Q108 41 99 51 Q101 58 92 63 Q90 50 86 46 Q84 30 60 26 Q36 30 34 46 Q30 50 31 58 Z" fill="url(#mHair)"/>
        <path d="M36 22 q5 -5 11 -2 q-4 4 -9 3 M52 12 q6 -4 12 0 q-5 4 -10 2 M72 14 q6 -3 11 2 q-5 3 -9 1 M90 30 q4 -2 6 2 M32 34 q-3 3 -1 7" fill="none" stroke="#B4C1D8" stroke-width="1.1" stroke-linecap="round"/>
        <path d="M44 11 q6 -6 14 -3 M70 9 q8 -3 13 3 M30 29 q2 -7 9 -10 M96 29 q-1 -6 -7 -9" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".9"/>
        <path d="M27 44 q-2 6 2 10 M97 42 q3 6 -1 11" fill="none" stroke="#9FB0CC" stroke-width="1.2" stroke-linecap="round"/>
      </g>
      <ellipse cx="35.4" cy="52.5" rx="3.3" ry="4.6" fill="url(#mSkin)"/><ellipse cx="84.6" cy="52.5" rx="3.3" ry="4.6" fill="url(#mSkin)"/>
      <path d="M35 46 Q35 24 60 24 Q85 24 85 46 Q85 63 73 70 Q60 76 47 70 Q35 63 35 46 Z" fill="url(#mSkin)"/>
      <ellipse cx="44" cy="62" rx="5.5" ry="3" fill="#F29C8E" opacity=".22" stroke="none"/><ellipse cx="76" cy="62" rx="5.5" ry="3" fill="#F29C8E" opacity=".22" stroke="none"/>
      <path d="M33.5 41 Q35 24 60 21.5 Q85 24 86.5 41 Q80.5 33.5 77 44.5 Q73 33 67 46.5 Q62 32 56 46.5 Q50 33 44 44.5 Q40.5 33.5 33.5 41 Z" fill="url(#mHair)" stroke="none"/>
      <path d="M33.5 41 Q40.5 33.5 44 44.5 Q50 33 56 46.5 Q62 32 67 46.5 Q73 33 77 44.5 Q80.5 33.5 86.5 41" fill="none"/>
      <path d="M46 30 q5 -4 11 -1 q-3 4 -8 3 M63 27 q7 -3 12 2 q-5 3 -10 1 M38 38 q3 -4 7 -2" fill="none" stroke="#B4C1D8" stroke-width="1" stroke-linecap="round"/>
      <path d="M40 30 q6 -6 14 -6.5 M66 23.6 q9 .8 14 6" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".95"/>
      <g class="m-eyes" stroke="none">
        <ellipse cx="48" cy="53" rx="7.2" ry="5.4" fill="#fff" stroke="#434A60" stroke-width=".9"/>
        <ellipse cx="72" cy="53" rx="7.2" ry="5.4" fill="#fff" stroke="#434A60" stroke-width=".9"/>
        <circle cx="48.7" cy="54" r="4.1" fill="url(#mIris)"/><circle cx="72.7" cy="54" r="4.1" fill="url(#mIris)"/>
        <circle cx="48.9" cy="54.2" r="1.7" fill="#2A1210"/><circle cx="72.9" cy="54.2" r="1.7" fill="#2A1210"/>
        <circle cx="50" cy="52.8" r="1.05" fill="#fff"/><circle cx="74" cy="52.8" r="1.05" fill="#fff"/>
        <path class="m-lid" d="M40.4 52 Q48 45.4 55.8 52 L55.8 53.4 L40.4 53.4 Z M64.2 52 Q72 45.4 79.6 52 L79.6 53.4 L64.2 53.4 Z" fill="#F4D3BB"/>
        <path class="m-lid" d="M40 53.2 Q48 47.4 56 53.2 M64 53.2 Q72 47.4 80 53.2" fill="none" stroke="#434A60" stroke-width="1.6" stroke-linecap="round"/>
      </g>
      <path class="m-brow" d="M39.5 44.2 Q48 41.2 56 44.8 M80.5 44.2 Q72 41.2 64 44.8" fill="none" stroke="#9AA6BD" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M60.6 58 q1.6 1.4 0 2.6" fill="none" stroke="#C99578" stroke-width="1" stroke-linecap="round"/>
      <path class="m-mouth" d="M53.6 64.6 Q60 67.8 66.6 64" fill="none" stroke="#7A3B33" stroke-width="1.3" stroke-linecap="round"/>
      <path class="m-glint" d="M44 49 l3 1.2 l-3 1.2 l-1.2 3 l-1.2 -3 l-3 -1.2 l3 -1.2 l1.2 -3 Z" fill="#fff" stroke="none"/>
    </g>

    <g class="m-sword">
      <path d="M82 78 Q99 72 98.5 59 L90 56.5 Q90 67 78.5 72 Z" fill="#F7F9FD"/>
      <path d="M90.4 62 q3.5 -3 7 0" fill="none" stroke="#4E78D6" stroke-width="2" stroke-linecap="round"/>
      <g transform="rotate(10 94 58)">
        <rect x="90.6" y="4" width="7" height="54" rx="3.2" fill="url(#mWood)" stroke="#5E3A1B" stroke-width="1"/>
        <path d="M92.6 10 v36" stroke="#F6D7A8" stroke-width="1.1" stroke-linecap="round" opacity=".8"/>
        <path d="M94.3 18 v8 M94.3 30 v10" stroke="#6B4220" stroke-width=".9" stroke-linecap="round" opacity=".55"/>
        <rect x="90.2" y="52.4" width="7.8" height="14" rx="2.6" fill="#2A2D3A" stroke="#14151D" stroke-width=".9"/>
        <path d="M90.6 56 l7 2 M90.6 60 l7 2" stroke="#4A4F66" stroke-width=".9" opacity=".8"/>
        <circle cx="94.1" cy="59.5" r="5.2" fill="url(#mSkin)"/>
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

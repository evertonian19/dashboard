// 우측 레일: 에버턴 다음 경기, 환율, 금속 시세 (넓은 화면에서만 보임)
import { api } from '../core/api.js';
import { marketCell } from './markets.js';

const REFRESH_MS = 60000;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const kst = (iso, opts) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', ...opts }).format(new Date(iso));

function countdown(iso, now = Date.now()) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return '곧 시작';
  const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60;
  return d > 0 ? `D-${d} · ${h}시간` : `${h}시간 ${m}분 후`;
}

export function evertonCard(data, now = Date.now()) {
  if (!data || data.error) return `<h3 class="rail-title">에버턴</h3><p class="rail-empty">경기 정보를 불러오지 못했어요.</p>`;
  const m = data.live || data.next;
  const form = (data.recent || []).map((r) => {
    const label = r.result === 'W' ? '승' : r.result === 'L' ? '패' : '무';
    return `<i class="fm ${r.result}" title="${esc(r.home ? '' : '@')}${esc(r.opponent)} ${r.score ? r.score.join(':') : ''}">${label}</i>`;
  }).join('');
  if (!m) return `<h3 class="rail-title">에버턴</h3><p class="rail-empty">예정된 경기가 없어요.</p><div class="form">${form}</div>`;
  const live = data.live === m;
  const score = live && m.score ? `<b class="rail-score">${m.score.join(' : ')}</b>` : '';
  return `<h3 class="rail-title">${live ? '<span class="live">LIVE</span> ' : ''}에버턴 ${live ? '경기 중' : '다음 경기'}</h3>
    <div class="match">
      <img src="${esc(m.opponent_logo || '')}" alt="" width="40" height="40" loading="lazy" onerror="this.style.visibility='hidden'">
      <div><b>${esc(m.opponent)}</b><span>${m.home ? '홈' : '원정'} · 프리미어리그</span></div>
      ${score}
    </div>
    <p class="when">${kst(m.kickoff, { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}</p>
    ${live ? '' : `<p class="cd" data-kick="${esc(m.kickoff)}">${countdown(m.kickoff, now)}</p>`}
    <div class="form" aria-label="최근 5경기">${form}</div>${data.stale ? '<p class="rail-empty">지연된 값</p>' : ''}`;
}

export function ratesCard(title, data) {
  const cells = (data.items || []).map(marketCell).join('');
  return `<h3 class="rail-title">${title}</h3><div class="rail-mk">${cells}</div>`;
}

export function startRail() {
  const el = document.getElementById('rail');
  if (!el) return;
  el.innerHTML = '<section class="rail-card" id="railEve"></section><section class="rail-card" id="railRates"></section>';
  const eve = el.querySelector('#railEve'), rates = el.querySelector('#railRates');
  const load = () => {
    api('/everton').then((d) => { eve.innerHTML = evertonCard(d); }).catch(() => { eve.innerHTML = evertonCard({ error: true }); });
    api('/rates').then((d) => {
      const items = d.items || [];
      rates.innerHTML = ratesCard('환율', { items: items.slice(0, 2) }) + ratesCard('금속 시세', { items: items.slice(2) });
    }).catch(() => { rates.innerHTML = '<p class="rail-empty">시세를 불러오지 못했어요.</p>'; });
  };
  const tick = () => eve.querySelectorAll('.cd').forEach((n) => { n.textContent = countdown(n.dataset.kick); });
  load();
  setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
  setInterval(() => { if (!document.hidden) tick(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { load(); tick(); } });
}

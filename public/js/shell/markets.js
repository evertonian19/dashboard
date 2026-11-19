// 상단 시장 지수 띠: 코스피·코스닥·나스닥·엔비디아의 최근 흐름(스파크라인)과 수치
import { api } from '../core/api.js';

const REFRESH_MS = 60000;
const W = 100, H = 32;

const fmt = (v) => Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const signed = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v));

// 한국 관행: 상승 빨강 / 하락 파랑
function direction(item) { return item.change > 0 ? 'up' : item.change < 0 ? 'down' : 'flat'; }

function sparkline(closes) {
  if (!closes || closes.length < 2) return { svg: '', lastY: 50 };
  const min = Math.min(...closes), max = Math.max(...closes);
  const span = max - min || 1;
  const pad = 3;
  const pts = closes.map((v, i) => [
    (i / (closes.length - 1)) * W,
    pad + (1 - (v - min) / span) * (H - pad * 2),
  ]);
  const line = pts.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(2)).join('');
  const area = line + `L${W} ${H}L0 ${H}Z`;
  return {
    svg: `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <path class="area" d="${area}"/><path class="line" d="${line}" vector-effect="non-scaling-stroke"/></svg>`,
    lastY: (pts[pts.length - 1][1] / H) * 100,
  };
}

export function marketCell(item) {
  if (item.error || item.price == null) {
    return `<div class="mk flat err" data-symbol="${item.symbol}"><div class="mk-info"><span class="mk-name">${item.name}</span><span class="mk-price">—</span><span class="mk-chg">데이터 없음</span></div></div>`;
  }
  const dir = direction(item);
  const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '–';
  const money = item.symbol.startsWith('^') ? '' : item.currency === 'USD' ? '$' : '';
  const { svg, lastY } = sparkline(item.closes);
  return `<div class="mk ${dir}${item.stale ? ' stale' : ''}" data-symbol="${item.symbol}" title="${item.name} ${money}${fmt(item.price)} (${signed(item.change)}, ${signed(item.pct)}%)${item.stale ? ' · 지연된 값' : ''}">
    <div class="mk-graph">${svg}<span class="dot" style="top:${lastY.toFixed(1)}%"></span></div>
    <div class="mk-info">
      <span class="mk-name">${item.name}</span>
      <span class="mk-price">${money}${fmt(item.price)}</span>
      <span class="mk-chg">${arrow} ${signed(item.change)} (${signed(item.pct)}%)</span>
    </div>
  </div>`;
}

export function renderMarkets(el, data) {
  el.innerHTML = (data.items || []).map(marketCell).join('');
}

export function startMarkets() {
  const el = document.getElementById('markets');
  if (!el) return;
  const load = () => api('/markets').then((d) => renderMarkets(el, d)).catch(() => el.classList.add('offline'));
  load();
  setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
}

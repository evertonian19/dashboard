// 숫자·날짜·파일 크기 표시 형식
import { esc } from './dom.js';

const fmtBytes = (n) => {
  if (n < 1024) return `${n}B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)}${units[i]}`;
};
const tokenFmt = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 });
const numFmt = new Intl.NumberFormat('ko-KR');
const fmtTokens = (n) => tokenFmt.format(n || 0);
const dateTimeFmt = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const timeFmt = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
const fmtDateTime = (iso) => dateTimeFmt.format(new Date(iso));
const fmtTime = (iso) => timeFmt.format(new Date(iso));
const fmtLeft = (ms) => {
  const min = Math.max(0, Math.round(ms / 60000));
  return min >= 60 ? `${Math.floor(min / 60)}시간 ${min % 60}분` : `${min}분`;
};
const extBadge = (ext) => {
  const e = String(ext).replace('.', '').toLowerCase();
  return `<span class="ext-badge ext-${esc(e)}">${esc(e.slice(0, 4))}</span>`;
};

export { extBadge, fmtBytes, fmtDateTime, fmtTime, fmtTokens, numFmt };

// Claude 사용량 카드
import { api } from '../core/api.js';
import { $, esc } from '../core/dom.js';
import { fmtDateTime, fmtTime, fmtTokens, numFmt } from '../core/format.js';

const USAGE_POLL_MS = 3000;
let usageData = null, usageBusy = false;

async function loadUsage() {
  if (usageBusy || document.hidden) return;
  usageBusy = true;
  try { usageData = await api('/claude-usage'); usageData.fetchedAt = Date.now(); }
  catch (e) { usageData = { error: e.message }; }
  usageBusy = false;
  drawUsage();
}

const fmtCountdown = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (h ? `${h}시간 ` : '') + `${m}분 ${String(sec).padStart(2, '0')}초`;
};
const fmtAge = (sec) => sec < 5 ? '방금' : sec < 60 ? `${Math.floor(sec)}초 전` : sec < 3600 ? `${Math.floor(sec / 60)}분 전` : `${Math.floor(sec / 3600)}시간 전`;
const fmtPct = (n) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

function drawUsage() {
  const box = $('#usage');
  if (!box || !usageData) return;
  const u = usageData;
  const stat = (label, value, small = '') => `<div class="hero-stat"><dt>${label}</dt><dd>${value}${small ? `<small>${small}</small>` : ''}</dd></div>`;

  if (u.error || !u.available) {
    box.innerHTML = `<div><p class="hero-kicker">Claude 사용량</p>
      <h2 class="hero-title">${u.error ? '불러오지 못했어요' : '사용 기록이 없어요'}</h2>
      <p class="hero-sub">${esc(u.error || '이 서버에서 Claude Code를 사용하면 여기에 표시됩니다.')}</p></div>`;
  } else {
    const L = u.limits, five = L?.five_hour, week = L?.seven_day, w = u.window, t = u.today;
    const fiveLive = five && !five.expired;
    let left;
    if (fiveLive) {
      left = `
        <p class="hero-kicker">Claude 사용량 · 5시간 한도</p>
        <h2 class="hero-title">${fmtPct(five.used_percentage)} 사용</h2>
        <p class="hero-sub">${fmtTime(five.resets_at)}에 초기화 · <span data-countdown="${five.resets_at}"></span> 남음</p>
        <div class="meter" role="img" aria-label="5시간 한도 ${fmtPct(five.used_percentage)} 사용"><i style="width:${Math.min(100, five.used_percentage)}%"></i></div>`;
    } else if (five) {
      left = `
        <p class="hero-kicker">Claude 사용량 · 5시간 한도</p>
        <h2 class="hero-title">초기화됐어요</h2>
        <p class="hero-sub">${fmtTime(five.resets_at)}에 구간이 끝났습니다. 다음 대화를 시작하면 새 구간이 열려요.</p>
        <div class="meter" role="img" aria-label="5시간 한도 0% 사용"><i style="width:0%"></i></div>`;
    } else if (w) {
      left = `
        <p class="hero-kicker">Claude 사용량 · 추정 구간</p>
        <h2 class="hero-title">${fmtTime(w.reset)}쯤 초기화</h2>
        <p class="hero-sub"><span data-countdown="${w.reset}"></span> 남음 · 한도 %는 아직 받지 못했어요</p>`;
    } else {
      left = `
        <p class="hero-kicker">Claude 사용량</p>
        <h2 class="hero-title">진행 중인 구간이 없어요</h2>
        <p class="hero-sub">다음 대화를 시작하면 새 5시간 구간이 열립니다.</p>`;
    }
    const note = L
      ? `<p class="hero-note">한도 %와 초기화 시각은 Claude Code가 받은 공식 값이에요 · <span data-age="${L.captured_at}"></span> 갱신. 토큰 수는 이 PC의 기록 기준입니다.</p>`
      : '<p class="hero-note">공식 한도 값을 아직 받지 못해 이 PC의 기록으로 추정했어요. Claude Code에서 메시지를 한 번 보내면 정확한 값으로 바뀝니다.</p>';

    let right = '';
    if (week) {
      right += stat('주간 한도', week.expired ? '초기화됨' : fmtPct(week.used_percentage), `${fmtDateTime(week.resets_at)} 초기화`);
    }
    if (w) {
      right += stat('이번 구간 토큰', fmtTokens(w.tokens), `메시지 ${numFmt.format(w.messages)}개`)
             + stat('출력 / 입력', `${fmtTokens(w.output)} / ${fmtTokens(w.input + w.cache_write)}`)
             + stat('캐시 읽기', fmtTokens(w.cache_read), '토큰 합계에서 제외');
    } else {
      right += stat('오늘 토큰', fmtTokens(t.tokens), `메시지 ${numFmt.format(t.messages)}개`)
             + stat('오늘 출력 / 입력', `${fmtTokens(t.output)} / ${fmtTokens(t.input + t.cache_write)}`)
             + stat('오늘 캐시 읽기', fmtTokens(t.cache_read), '토큰 합계에서 제외');
    }
    const models = (w || t).by_model.slice(0, 3).map((m) => `${esc(m.model.replace(/^claude-/, ''))} ${fmtTokens(m.tokens)}`).join(' · ');
    box.innerHTML = `<div>${left}${note}</div><div><dl class="hero-stats">${right}</dl>${models ? `<p class="hero-note">모델별 토큰: ${models}</p>` : ''}</div>`;
    tickUsage();
  }

  const bars = $('#bars');
  if (bars && u.days) {
    const max = Math.max(...u.days.map((d) => d.tokens));
    bars.innerHTML = u.days.map((d, i) => {
      const last = i === u.days.length - 1;
      const label = last ? '오늘' : new Date(d.date + 'T00:00:00').toLocaleDateString('ko-KR', { weekday: 'short' });
      const h = max ? Math.max(3, (d.tokens / max) * 100) : 3;
      return `<div class="bar${last ? ' today' : ''}" title="${d.date} · ${numFmt.format(d.tokens)} 토큰"><i style="height:${h.toFixed(1)}%"></i><span>${label}</span></div>`;
    }).join('');
    $('#barsNote').textContent = `오늘 ${fmtTokens(u.days.at(-1).tokens)} · 최대 ${fmtTokens(max)} (캐시 읽기 제외)`;
  }
}

// 남은 시간과 "N초 전"만 1초마다 갱신. 초기화 시각이 지나면 즉시 서버에 다시 묻습니다.
function tickUsage() {
  const now = Date.now();
  document.querySelectorAll('[data-countdown]').forEach((el) => {
    const left = new Date(el.dataset.countdown) - now;
    el.textContent = fmtCountdown(left);
    if (left <= 0 && !el.dataset.fired) { el.dataset.fired = '1'; loadUsage(); }
  });
  document.querySelectorAll('[data-age]').forEach((el) => {
    el.textContent = fmtAge((now - new Date(el.dataset.age)) / 1000);
  });
}

export { USAGE_POLL_MS, loadUsage, tickUsage };

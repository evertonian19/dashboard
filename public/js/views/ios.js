// iOS 앱 (Menu 8): 휴대폰 목업(앱과 같은 샘플 데이터·계산 규칙) + 개발 현황
import { api } from '../core/api.js';
import { $, errLine, esc, fill } from '../core/dom.js';
import { fmtDateTime, numFmt } from '../core/format.js';
import { every } from '../core/state.js';

const TABS = [['home', '개요'], ['fixtures', '일정'], ['league', '리그'], ['squad', '스쿼드'], ['news', '뉴스']];
// 하단 탭 아이콘 (앱의 SF Symbol: house / calendar / trophy / person.3 / newspaper 와 같은 의미)
const TAB_ICONS = {
  home: '<path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4v-5.5H9V20H5a1 1 0 0 1-1-1z"/>',
  fixtures: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
  league: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a2.5 2.5 0 0 0 3 3.5M16 6h3a2.5 2.5 0 0 1-3 3.5M12 13v4M8.5 20h7M10 17h4"/>',
  squad: '<circle cx="12" cy="8.5" r="3"/><path d="M6 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="5.5" cy="10" r="2"/><circle cx="18.5" cy="10" r="2"/>',
  news: '<rect x="4" y="5" width="13" height="14" rx="2"/><path d="M17 9h3v8.5a1.5 1.5 0 0 1-3 0M7.5 9h6M7.5 12.5h6M7.5 16h4"/>',
};
const tabIcon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${TAB_ICONS[k]}</svg>`;
const TEAM = 368;                      // ESPN 의 에버턴 ID (앱 EvertonInfo 와 같은 값)
const kst = (iso, o) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', ...o }).format(new Date(iso));
const dayText = (iso) => kst(iso, { month: 'long', day: 'numeric', weekday: 'short' });
const shortDay = (iso) => kst(iso, { month: 'numeric', day: 'numeric' });
const timeText = (iso) => kst(iso, { hour: '2-digit', minute: '2-digit', hour12: false });
const monthText = (iso) => kst(iso, { year: 'numeric', month: 'long' });
const isHome = (m) => m.home.id === TEAM;
const opp = (m) => (isHome(m) ? m.away : m.home);
const resultOf = (m) => {
  if (m.phase !== 'finished' || m.homeGoals == null) return null;
  const [a, b] = isHome(m) ? [m.homeGoals, m.awayGoals] : [m.awayGoals, m.homeGoals];
  return a > b ? 'W' : a === b ? 'D' : 'L';
};

function countdown(iso, now = Date.now()) {
  const s = Math.floor((new Date(iso).getTime() - now) / 1000);
  if (s <= 0) return null;
  const d = Math.floor(s / 86400), clock = [Math.floor(s / 3600) % 24, Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':');
  return d > 0 ? `${d}일 ${clock}` : clock;
}

/* FM 식 색: 값이 높을수록 초록·청록, 낮을수록 주황·빨강 (0~1 로 정규화한 값) */
const attrClass = (v) => (v >= 0.8 ? 'a5' : v >= 0.6 ? 'a4' : v >= 0.4 ? 'a3' : v >= 0.2 ? 'a2' : 'a1');
const POS = { goalkeeper: ['GK', '골키퍼'], defender: ['DF', '수비수'], midfielder: ['MF', '미드필더'], attacker: ['FW', '공격수'] };
const posBadge = (p) => `<i class="pos ${p}">${POS[p][0]}</i>`;

const crest = (c, size = 28) => `<span class="crest" style="--s:${size}px" title="${esc(c.name)}">${esc((c.code || c.name).slice(0, 3).toUpperCase())}${
  c.logoURL ? `<img src="${esc(c.logoURL)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`;
const flag = (p) => (p.flagURL ? `<img class="flag" src="${esc(p.flagURL)}" alt="" aria-hidden="true" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('i'), { className: 'flag' }))">` : '<i class="flag"></i>');
const face = (p) => (p.photoURL ? `<img class="face" src="${esc(p.photoURL)}" alt="" aria-hidden="true" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('i'), { className: 'face' }))">` : '<i class="face"></i>');
const formBoxes = (letters) => `<span class="fm-form">${letters.map((r) => `<i class="r-${r}">${{ W: '승', D: '무', L: '패' }[r]}</i>`).join('')}</span>`;
const card = (inner, cls = '') => `<section class="p-card ${cls}">${inner}</section>`;
const title = (t) => `<h3 class="p-sec">${esc(t)}</h3>`;
// 히어로 기록 칩(숫자는 화면을 그린 뒤 countUp 이 0 에서 올린다). 골·도움·선방이 1 이상이면 금색 글로우.
const chip = (label, value, hot = false, ico = '') => `<div class="hchip${hot && value > 0 ? ' hot' : ''}"><b>${ico ? `<i>${ico}</i>` : ''}<span data-count="${value}">${value}</span></b><small>${label}</small></div>`;
const rise = (i) => `style="--i:${i}"`;
// 팀 색: [주색, 어두운 색, 발광색]. ESPN 색은 흰색·검정이 섞여 있어 믿을 수 없으므로 구단 코드로 직접 정한 표를 쓴다(앱 TeamPalette.swift 와 같은 값).
const TEAM_PAL = {
  EVE: ['#0B3FB8', '#031A54', '#F2B84B'], ARS: ['#E10613', '#5E0008', '#F0C987'], AVL: ['#7A1038', '#2E0516', '#8FC3EE'], BOU: ['#D6281B', '#1A0504', '#FFB3AB'],
  BRE: ['#E30613', '#4A0208', '#FFD23F'], BHA: ['#0A5BC4', '#04224D', '#FFD400'], CHE: ['#0A4BA0', '#041F4A', '#E8B93A'], COV: ['#3F9FC4', '#10335A', '#BFEAFF'],
  CRY: ['#1B55B5', '#0A1F4D', '#E5384F'], FUL: ['#2B2B33', '#08080A', '#E4E6EB'], HUL: ['#E8890E', '#1B1006', '#FFE08A'], IPS: ['#1F5FCC', '#0A2250', '#EAF2FF'],
  LEE: ['#2147A0', '#091632', '#FFD84D'], LIV: ['#C8102E', '#4A0612', '#2ED1BE'], MNC: ['#4A93CC', '#102B52', '#E3F2FF'], MAN: ['#D3201A', '#3A0806', '#FFD92E'],
  NEW: ['#2F2F36', '#08080A', '#C9CED6'], NFO: ['#D01020', '#3E040A', '#FFE0E0'], SUN: ['#E01A2D', '#32060C', '#FFFFFF'], TOT: ['#1B2C6B', '#080F2B', '#D8DEEA'],
};
const palStyle = (code) => { const [a, b, g] = TEAM_PAL[String(code || '').toUpperCase()] || TEAM_PAL.EVE; return `--t1:${a};--t2:${b};--t3:${g}`; };
const palOfClub = (id) => palStyle(((model.clubs || []).find((x) => x.club.id === id) || {}).club?.code);
const clubIdOfPlayer = (pid) => Number(Object.keys(model.rosters).find((k) => (model.rosters[k].players || []).some((q) => q.id === pid)));
// 히어로 뒤 장식: 흐르는 오로라 + 떠오르는 스파크 + 도는 포일 테두리
const fxLayer = () => `<span class="fxl" aria-hidden="true"><i class="aur"></i>${Array.from({ length: 16 }, (_, i) => `<b class="sp" style="--x:${(i * 37 + 11) % 100}%;--d:${3 + (i * 13) % 5}s;--w:${-(i * 0.7).toFixed(1)}s;--z:${3 + (i % 4)}px"></b>`).join('')}<u class="foilb"></u></span>`;
const goalPips = (g) => (g > 0 ? `<div class="pips" aria-label="골 ${g}">${Array.from({ length: Math.min(g, 10) }, (_, i) => `<i style="--i:${i}">⚽</i>`).join('')}${g > 10 ? `<em>+${g - 10}</em>` : ''}</div>` : '');
const panel = (head, inner, cls = '', style = '') => `<section class="fmp ${cls}"${style ? ` style="${style}"` : ''}>${head ? `<h3 class="fmp-h">${head}</h3>` : ''}<div class="fmp-b">${inner}</div></section>`;
const err = (msg) => panel('', `<p class="p-dim">${esc(msg)}</p>`);

/* ---------------- 상태 (앱의 AppModel) ---------------- */
const model = { overview: null, matches: null, squad: null, clubs: null, standings: null, news: null, diag: null, details: {}, rosters: {}, tactics: {} };
const nav = { tab: 'home', stack: [], fixtureFilter: 'all', sort: 'pos', tabs: {}, raw: false };

async function loadAll() {
  const get = (path) => api(path).catch((e) => ({ __error: e.message || String(e) }));
  const [overview, matches, squad, clubs, standings, news, diag] = await Promise.all(
    ['/ios/overview', '/ios/matches', '/ios/squad', '/ios/clubs', '/ios/standings', '/ios/news', '/ios/diagnostics'].map(get));
  Object.assign(model, { overview, matches, squad, clubs, standings, news, diag });
  if (squad && !squad.__error) { model.rosters[TEAM] = squad; watchPhotos(TEAM); }
  ensureTactics(TEAM);
}
const bad = (x) => !x || x.__error;
const failMsg = (x) => (x && x.__error) || '불러오지 못했어요';
const findPlayer = (id) => Object.values(model.rosters).flatMap((r) => r.players || []).find((p) => p.id === id);
const st = (p, k) => (p.stats ? p.stats[k] : null);
const dash = (v) => (v == null ? '-' : v);
const per = (v, apps) => (apps ? (v / apps).toFixed(2) : '-');

/* ---------------- 공통 조각 ---------------- */
function matchRow(m) {
  const r = resultOf(m), o = opp(m);
  return `<button class="fx" data-go="match" data-id="${m.id}"><span class="fx-d">${shortDay(m.kickoff)}</span><i class="ha ${isHome(m) ? 'h' : 'a'}">${isHome(m) ? 'H' : 'A'}</i>
    ${crest(o, 22)}<b class="fx-o">${esc(o.shortName || o.name)}</b>
    ${r ? `<span class="fx-s r-${r}">${m.homeGoals}-${m.awayGoals}</span>` : `<span class="fx-t">${timeText(m.kickoff)}</span>`}</button>`;
}
const subTabs = (key, items, active) => `<div class="fm-tabs">${items.map(([k, t]) => `<button data-sub="${key}:${k}" class="${active === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
const subOf = (key, def) => nav.tabs[key] || def;

/* ---------------- 화면 ---------------- */
function homeView() {
  const ov = model.overview;
  if (bad(ov)) return err(failMsg(ov));
  const n = ov.next;
  const next = n ? panel('다음 경기', `<div class="nx"><div>${crest(n.home, 46)}<b>${esc(n.home.shortName)}</b></div>
      <div class="nx-m"><small>${esc(n.competition)} · ${isHome(n) ? '홈' : '원정'}</small><em>${n.phase === 'live' ? 'LIVE' : 'VS'}</em>
      <p>${dayText(n.kickoff)} ${timeText(n.kickoff)}</p></div><div>${crest(n.away, 46)}<b>${esc(n.away.shortName)}</b></div></div>
      <p class="p-count" data-kick="${esc(n.kickoff)}">${countdown(n.kickoff) || '곧 시작'}</p>`, 'fm-hero')
    : panel('다음 경기', '<p class="p-dim">예정된 경기가 없어요.</p>');
  const s = ov.standing;
  const table = s ? panel('리그 순위', `<div class="lg"><div><small>순위</small><b>${s.rank}<sup>위</sup></b></div><div><small>승점</small><b>${s.points}</b></div>
      <div><small>승-무-패</small><b class="sm">${s.won}-${s.drawn}-${s.lost}</b></div><div><small>득실</small><b class="sm">${s.goalDifference > 0 ? '+' : ''}${s.goalDifference}</b></div></div>
      <div class="lg-f">${formBoxes(ov.form)}<small>최근 5경기</small></div>`) : '';
  const recent = panel('최근 경기', [...ov.recent].reverse().map(matchRow).join('') || '<p class="p-dim">경기 기록이 없어요.</p>');
  const squad = model.rosters[TEAM];
  const topIds = squad ? squad.topContributors : [];
  const top = topIds.length ? panel('공격 포인트 TOP', `<table class="fm-t"><thead><tr><th class="tl">선수</th><th>출전</th><th>골</th><th>도움</th><th>합</th></tr></thead><tbody>${
    topIds.map(findPlayer).filter(Boolean).slice(0, 5).map((p) => `<tr data-go="player" data-id="${p.id}"><td class="tl">${posBadge(p.position)} ${esc(p.shortName)}</td><td>${st(p, 'appearances')}</td><td>${st(p, 'goals')}</td><td>${st(p, 'assists')}</td><td class="fm-hl">${p.contribution}</td></tr>`).join('')}</tbody></table>`) : '';
  const news = !bad(model.news) ? panel('최근 뉴스', model.news.slice(0, 3).map((x) => `<button class="nw" data-tab="news"><b>${esc(x.title)}</b><small>${x.date ? dayText(x.date) : ''}</small></button>`).join('')) : '';
  const src = model.diag && !bad(model.diag) ? `<button class="src" data-go="diag">데이터: ${esc(model.diag.source)} · ${esc(model.diag.seasonName || '')} ›</button>` : '';
  return next + table + recent + top + news + src;
}

function fixturesView() {
  if (bad(model.matches)) return err(failMsg(model.matches));
  const f = nav.fixtureFilter;
  const list = model.matches.filter((m) => f === 'all' || (f === 'upcoming' ? m.phase !== 'finished' : m.phase === 'finished')).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const seg = `<div class="fm-tabs">${[['all', '전체'], ['upcoming', '예정'], ['finished', '결과']].map(([k, t]) => `<button data-filter="${k}" class="${f === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  let last = '', out = '';
  for (const m of list) {
    const mo = monthText(m.kickoff);
    if (mo !== last) { if (last) out += '</div></section>'; out += `<section class="fmp"><h3 class="fmp-h">${mo}</h3><div class="fmp-b">`; last = mo; }
    out += matchRow(m);
  }
  if (last) out += '</div></section>';
  return seg + (out || err('경기가 없어요.'));
}

function matchView(id) {
  const d = model.details[id];
  if (!d) return err('불러오는 중…');
  if (d.__error) return err(failMsg(d));
  const m = d.match, sub = subOf('match', 'ov');
  const head = panel('', `<small class="p-dim">${esc(m.competition)} · ${dayText(m.kickoff)} ${timeText(m.kickoff)}${m.venue ? ' · ' + esc(m.venue) : ''}</small>
    <div class="nx"><div>${crest(m.home, 44)}<b>${esc(m.home.shortName)}</b></div><div class="nx-m"><em class="big">${m.homeGoals == null ? 'VS' : `${m.homeGoals} - ${m.awayGoals}`}</em><small>${esc(m.statusText)}</small></div>
    <div>${crest(m.away, 44)}<b>${esc(m.away.shortName)}</b></div></div>`, 'fm-hero');
  const tabs = subTabs('match', [['ov', '개요'], ['stats', '통계'], ['lineup', '라인업'], ['ev', '이벤트']], sub);
  const stats = d.stats.map((s) => {
    const total = s.home + s.away || 1, pct = (v) => (v / total) * 100, fmt = (v) => `${v}${s.isPercent ? '%' : ''}`;
    return `<div class="p-stat"><span>${fmt(s.home)}</span><small>${esc(s.label)}</small><span>${fmt(s.away)}</span><div class="p-bar"><i class="h" style="width:${pct(s.home)}%"></i><i class="a" style="width:${pct(s.away)}%"></i></div></div>`;
  }).join('') || '<p class="p-dim">통계가 아직 없어요.</p>';
  const evs = d.events.map((e) => {
    const home = e.clubID === m.home.id, min = `${e.minute}'${e.extra ? '+' + e.extra : ''}`;
    const who = `${e.icon} ${esc(e.player)}${e.assist ? `<small> (${esc(e.assist)})</small>` : ''}`;
    return `<div class="p-ev"><span class="l">${home ? who : ''}</span><span class="m">${min}</span><span class="r">${home ? '' : who}</span></div>`;
  }).join('') || '<p class="p-dim">주요 장면이 없어요.</p>';
  let body;
  if (sub === 'stats') body = panel('경기 통계', stats);
  else if (sub === 'ev') body = panel('주요 장면', evs);
  else if (sub === 'lineup') {
    const side = nav.tabs.lineupSide || 'home';
    const lu = d.lineups.find((x) => x.homeAway === side) || d.lineups[0];
    body = lu ? panel(`${esc(lu.club?.name || '')} ${esc(lu.formation || '')}`, `<div class="fm-seg"><button data-sub="lineupSide:home" class="${side === 'home' ? 'on' : ''}">홈</button><button data-sub="lineupSide:away" class="${side === 'away' ? 'on' : ''}">원정</button></div>${pitch(lu)}
      <p class="p-sec2">교체 명단</p><p class="p-dim">${lu.substitutes.map((p) => `${p.number ?? ''} ${esc(p.name)}`).join(' · ') || '-'}</p>`) : err('라인업이 아직 없어요.');
  } else body = panel('요약', stats.split('</div>').slice(0, 4).join('</div>') + '</div>') + panel('주요 장면', evs);
  return head + tabs + body;
}

const pitchFx = '<span class="lt l1"></span><span class="lt l2"></span><span class="cc"></span><span class="sw"></span><span class="vg"></span>';
function pitch(lineup) {
  const rows = {};
  lineup.starters.forEach((p) => { const [r, c] = (p.grid || '9:9').split(':').map(Number); (rows[r] ||= []).push({ ...p, c }); });
  const lines = Object.keys(rows).map(Number).sort((a, b) => b - a).map((r) =>
    `<div class="pl">${rows[r].sort((a, b) => a.c - b.c).map((p) => `<span class="pp"><i>${p.number ?? ''}</i><small>${esc(p.name.split(' ').pop())}</small></span>`).join('')}</div>`).join('');
  return `<div class="pitch" style="${palStyle(lineup.club?.code)}">${pitchFx}${lines}</div>`;
}

const SORTS = { pos: (a, b) => 0, apps: (a, b) => (st(b, 'appearances') || 0) - (st(a, 'appearances') || 0), goals: (a, b) => (st(b, 'goals') || 0) - (st(a, 'goals') || 0),
  assists: (a, b) => (st(b, 'assists') || 0) - (st(a, 'assists') || 0), age: (a, b) => (a.age || 0) - (b.age || 0) };
function rosterTable(players, ctx = 'squad') {
  const sorted = [...players].sort(SORTS[nav.sort] || SORTS.pos);
  const th = (k, t) => `<th class="${nav.sort === k ? 'on' : ''}" data-sort="${k}">${t}</th>`;
  return `<table class="fm-t sq"><thead><tr><th>#</th><th class="tl" data-sort="pos">선수</th>${th('age', '나이')}${th('apps', '출전')}${th('goals', '골')}${th('assists', '도움')}</tr></thead><tbody>${
    sorted.map((p) => `<tr data-go="player" data-id="${p.id}"><td class="num">${dash(p.number)}</td><td class="tl">${face(p)}${posBadge(p.position)} ${flag(p)} ${esc(p.shortName)}</td><td>${dash(p.age)}</td>
      <td>${dash(st(p, 'appearances'))}</td><td class="${st(p, 'goals') ? 'fm-hl' : ''}">${dash(st(p, 'goals'))}</td><td class="${st(p, 'assists') ? 'fm-hl' : ''}">${dash(st(p, 'assists'))}</td></tr>`).join('')}</tbody></table>`;
}

/* 베스트 11 (최근 5경기 주력 XI) 포메이션: 선수 칸은 골·도움만, 누르면 선수 상세 */
function xiPitch(xi, roster, pal = palStyle('EVE')) {
  const rows = {};
  xi.forEach((x) => { const [r, c] = (x.grid || '9:9').split(':').map(Number); (rows[r] ||= []).push({ ...x, c }); });
  const topG = Math.max(0, ...xi.map((x) => { const q = (roster.players || []).find((y) => y.id === x.id); return q ? st(q, 'goals') || 0 : 0; }));
  const order = Object.keys(rows).map(Number).sort((a, b) => a - b);   // 1 = 골키퍼부터 위로 떨어진다
  const lines = Object.keys(rows).map(Number).sort((a, b) => b - a).map((r) =>
    `<div class="pl">${rows[r].sort((a, b) => a.c - b.c).map((x, j) => {
      const p = (roster.players || []).find((q) => q.id === x.id);
      const g = p ? st(p, 'goals') : null, a = p ? st(p, 'assists') : null, star = topG > 0 && g === topG;
      const inner = `${star ? '<u class="crown">👑</u>' : ''}<i>${x.number ?? ''}</i><small>${esc(x.name.split(' ').pop())}</small><em class="ga${g || a ? '' : ' z'}">⚽${dash(g)} 🅰${dash(a)}</em>`;
      const cls = `pp xp drop${star ? ' star' : ''}`, sty = `style="--i:${order.indexOf(r) * 3 + j}"`;
      return p ? `<button class="${cls}" ${sty} data-go="player" data-id="${p.id}">${inner}</button>` : `<span class="${cls}" ${sty}>${inner}</span>`;
    }).join('')}</div>`).join('');
  return `<div class="pitch" style="${pal}">${pitchFx}${lines}</div>`;
}

function tacticsPanel(t) {
  const p = t.profile, kv = (l, v, u = '') => (v == null ? '' : `<div><small>${l}</small><b>${v}${u}</b></div>`);
  const kpi = `<div class="tac-kpi">${kv('점유율', p.possession, '%')}${kv('슈팅', p.shots)}${kv('유효슈팅', p.shotsOnTarget)}${kv('패스 성공', p.passPct, '%')}${kv('득점', p.scored)}${kv('실점', p.conceded)}</div>`;
  const tags = p.tags.length ? `<div class="p-tags"><small>성향</small>${p.tags.map((x) => `<b>${esc(x)}</b>`).join('')}</div>` : '';
  const fm = Object.entries(t.formationCounts).map(([f, n]) => `${esc(f)} ${n}회`).join(' · ');
  const n = t.notes;
  const notes = n ? `<p class="tac-sum">${esc(n.summary)}</p><ul class="tac-pts">${n.points.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <p class="p-note">해설: 직접 작성(${esc(n.written)} 기준 · ${esc(n.coach)} 감독 체제).</p>`
    : t.notesStale ? '<p class="p-note">감독이 바뀐 것으로 보여 작성해 둔 해설은 숨겼어요(갱신 필요).</p>'
      : '<p class="p-note">이 구단의 직접 쓴 해설은 아직 없어요. 아래는 경기 통계로 자동 정리한 내용입니다.</p>';
  return panel(`주요 전술${t.coach ? ` · ${esc(t.coach)}` : ''}`, `${tags}${kpi}${notes}<ul class="tac-pts">${t.summary.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
    <p class="p-note">사용 포메이션: ${fm || '-'}. 최근 ${t.matchesUsed.length}경기(${t.matchesUsed.map((m) => esc(m.opponent)).join('·')}) ESPN 경기 요약 기준.</p>`);
}

function teamSquadHtml(id, roster) {
  const t = model.tactics[id];
  const head = `${roster.coach ? ` · 감독 ${esc(roster.coach)}` : ''}`;
  if (!t || t.__error || !t.xi.length) {
    const note = !t ? '베스트 11 불러오는 중…' : `베스트 11 을 만들지 못했어요(${esc(t.__error || '최근 라인업 없음')}).`;
    return panel(`스쿼드 · ${roster.players.length}명${head}`, `<p class="p-note">${note}</p>${rosterTable(roster.players)}`);
  }
  const used = new Set(t.xi.map((x) => x.id));
  const bench = roster.players.filter((p) => !used.has(p.id));
  return panel(`베스트 11 · ${esc(t.formation)}`, `${xiPitch(t.xi, roster, palOfClub(id))}<p class="p-note">최근 ${t.matchesUsed.length}경기 주력 선발(선수를 누르면 상세) · 골·도움은 시즌 누적</p>`)
    + panel(`후보 · ${bench.length}명${head}`, rosterTable(bench)) + tacticsPanel(t);
}

function squadView() {
  const sq = model.rosters[TEAM];
  if (!sq) return err(failMsg(model.squad));
  return teamSquadHtml(TEAM, sq);
}

function radarSvg(metrics) {
  const R = 74, C = 100, n = metrics.length;
  const pt = (i, v) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; return [C + Math.cos(a) * R * v, C + Math.sin(a) * R * v]; };
  const ring = (k) => metrics.map((_, i) => pt(i, k).map((x) => x.toFixed(1)).join(',')).join(' ');
  const shape = metrics.map((m, i) => pt(i, m.value).map((x) => x.toFixed(1)).join(',')).join(' ');
  const labels = metrics.map((m, i) => { const [x, y] = pt(i, 1.22); return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${esc(m.label)}</text>`; }).join('');
  return `<svg viewBox="-26 -4 252 208" class="radar">${[0.33, 0.66, 1].map((k) => `<polygon points="${ring(k)}" class="rg"/>`).join('')}<polygon points="${shape}" class="rs"/>${labels}</svg>`;
}

// ---- FM 식 능력치 (EA SPORTS FC 공식 평가 → 1~20) ----
const stars = (n, max = 5) => `<span class="stars" aria-label="${n}/${max}">${'★'.repeat(n || 0)}<i>${'★'.repeat(max - (n || 0))}</i></span>`;
const fmCls = (v) => (v >= 16 ? 'a5' : v >= 11 ? 'a4' : v >= 6 ? 'a3' : 'a1');   // FM 식: 1~5 빨강 · 6~10 노랑 · 11~15 연두 · 16~20 청록
function posMap(positions) {
  const dots = positions.map((q) => `<g class="pm-d${q.main ? ' main' : ''}" transform="translate(${(q.x * 100).toFixed(1)} ${(q.y * 140).toFixed(1)})"><circle r="${q.main ? 6 : 4.5}"/>${q.main ? `<text y="-9">${esc(q.code)}</text>` : ''}</g>`).join('');
  return `<svg class="pm" viewBox="0 0 100 140" role="img" aria-label="포지션 ${positions.map((q) => esc(q.label)).join(', ')}"><rect x="1" y="1" width="98" height="138" rx="3"/><path d="M1 70H99M30 1V16H70V1M30 139V124H70V139M38 1V6H62V1M38 139V134H62V139"/><circle cx="50" cy="70" r="11"/>${dots}</svg>`;
}
function overviewHtml(p) {
  const rt = p.ratings, s = p.stats;
  let html = '';
  if (rt) {
    const mainPos = rt.positions.find((q) => q.main);
    const others = rt.positions.filter((q) => !q.main);
    html += panel('평가 · 포지션', `<div class="pm-wrap">${posMap(rt.positions)}<div class="pm-info">
      <div class="ovr"><b class="${fmCls(Math.round(rt.overall / 5))}">${rt.overall}</b><small>EA 종합</small></div>
      <dl><dt>주 포지션</dt><dd>${mainPos ? esc(mainPos.label) : '-'}</dd>${others.length ? `<dt>다른 포지션</dt><dd>${others.map((q) => esc(q.label)).join(', ')}</dd>` : ''}
      ${rt.foot ? `<dt>주발</dt><dd>${rt.foot === 'right' ? '오른발' : '왼발'}</dd>` : ''}<dt>약발</dt><dd>${stars(rt.weakFoot)}</dd><dt>개인기</dt><dd>${stars(rt.skillMoves)}</dd></dl></div></div>`);
    const top = new Set(rt.top);
    html += panel('능력치', `<div class="attrs">${rt.groups.map((g) => `<div class="ag"><h4>${esc(g.title)}</h4>${g.attrs.map((a) => `<div class="at${top.has(a.key) ? ' top' : ''}"><span>${esc(a.label)}</span>
      <b class="${fmCls(a.fm)}" title="EA 원본 ${a.raw}">${nav.raw ? a.raw : a.fm}</b></div>`).join('')}</div>`).join('')}</div>
      <button class="raw-t" data-raw>${nav.raw ? '1~20 환산값 보기' : 'EA 원본(1~99) 보기'}</button>
      <p class="p-note">EA SPORTS FC 공식 평가(${esc(rt.fetchedAt)} 받음)의 원본 1~99 값을 5로 나눠 1~20으로 환산했습니다. 테두리는 이 선수의 상위 3개 능력치. EA 등록 소속: ${esc(rt.eaTeam || '-')}.
      EA 평가는 게임 출시 시점·업데이트 기준이라 이번 시즌 이적·성장은 반영되지 않을 수 있습니다.</p>`);
    if (rt.abilities.length) html += panel('플레이 스타일', `<div class="pstyle">${rt.abilities.map((a) => `<div><b>${esc(a.label)}</b><small>${esc(a.description)}</small></div>`).join('')}</div>`);
  } else {
    html += panel('능력치', '<p class="p-dim">EA SPORTS FC 평가 데이터에서 이 선수를 확실히 찾지 못해 능력치를 표시하지 않습니다(이름·생년월일이 모두 일치할 때만 연결).</p>');
  }
  const rows = (p.season || []);
  html += panel('올 시즌 실적 · 리그 순위', rows.length ? `<div class="abs">${rows.map((m) => `<div class="ab"><span>${esc(m.label)}</span><div>${m.pct != null ? `<i class="${attrClass(m.pct / 100)}" style="width:${Math.max(m.pct, 3)}%"></i>` : ''}</div>
      <em>${m.pct != null ? `상위 ${Math.max(1, 100 - m.pct)}%` : '-'}</em><small>${m.total}회 · 출전당 ${m.perApp}</small></div>`).join('')}</div>
      <p class="p-note">ESPN 올 시즌 기록을 출전 1회당으로 환산해 리그 같은 포지션 선수(출전 3회 이상)와 비교한 순위입니다. 평점이 아닙니다.</p>`
    : '<p class="p-dim">출전 기록이 없어 시즌 실적을 만들 수 없어요.</p>');
  return html;
}

function playerView(id) {
  const p = findPlayer(id);
  if (!p) return err('선수를 찾지 못했어요.');
  const sub = subOf('player', 'ov'), s = p.stats, apps = s ? s.appearances : 0;
  const hero = panel('', `<div class="ph"><span class="av ring">${esc(p.name.slice(0, 1))}${p.photoURL ? `<img src="${esc(p.photoURL)}" alt="${esc(p.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span><div><b>${p.number != null ? `#${p.number} ` : ''}${esc(p.name)}</b>
      <small>${posBadge(p.position)} ${POS[p.position][1]} · ${dash(p.age)}세</small><small>${flag(p)} ${esc(p.nationality || '-')}</small></div>${p.ratings ? `<div class="ovrb" title="EA SPORTS FC 종합"><b>${p.ratings.overall}</b><small>EA</small></div>` : ''}</div>
    ${s ? `<div class="hchips">${p.position === 'goalkeeper' ? chip('출전', s.appearances) + chip('선방', s.saves, true, '✋') + chip('실점', s.conceded)
      : chip('출전', s.appearances) + chip('골', s.goals, true, '⚽') + chip('도움', s.assists, true, '↗')}</div>` : ''}
    ${p.number != null ? `<span class="wm" aria-hidden="true">${p.number}</span>` : ''}`, 'fm-hero fm-card', palOfClub(clubIdOfPlayer(id)));
  const tabs = subTabs('player', [['ov', '개요'], ['stats', '기록'], ['info', '정보']], sub);
  let body;
  if (sub === 'stats') {
    const rows = !s ? [] : p.position === 'goalkeeper'
      ? [['출전', s.appearances], ['교체 투입', s.subIns], ['선방', s.saves], ['실점', s.conceded], ['피유효슈팅', s.shotsFaced], ['경고', s.yellow], ['퇴장', s.red], ['파울', s.foulsCommitted]]
      : [['출전', s.appearances], ['교체 투입', s.subIns], ['골', s.goals], ['도움', s.assists], ['슈팅', s.shots], ['유효슈팅', s.shotsOnTarget], ['파울 획득', s.foulsSuffered], ['파울', s.foulsCommitted],
        ['오프사이드', s.offsides], ['경고', s.yellow], ['퇴장', s.red], ['자책골', s.ownGoals]];
    const bmax = Math.max(0, ...rows.filter(([l]) => l !== '출전' && l !== '교체 투입').map(([, v]) => v));
    body = panel('시즌 기록', rows.length ? `<table class="fm-t fm-kv">${rows.map(([l, v], i) => { const star = ['골', '도움', '선방'].includes(l) && v > 0; return `<tr class="rise rrow${star ? ' star' : ''}" ${rise(i)}><td class="tl">${star ? `<i class="ri">${{ 골: '⚽', 도움: '↗', 선방: '✋' }[l]}</i>` : ''}${l}</td><td class="fm-hl"><span data-count="${v}">${v}</span></td><td class="dim">${apps ? per(v, apps) + '/경기' : ''}</td></tr><tr class="rise rb${star ? ' star' : ''}" ${rise(i)}><td colspan="3"><u class="rbar"><s style="width:${bmax ? Math.round(v / bmax * 100) : 0}%"></s></u></td></tr>`; }).join('')}</table>` : '<p class="p-dim">ESPN 에 이 선수의 시즌 기록이 없어요(출전 전이거나 등록 직후).</p>') + `<p class="p-note">출처: ESPN 시즌 누적 기록(비공식 API). 경기 이벤트와의 대조 검증은 에버턴 선수만 수행합니다.</p>`;
  } else if (sub === 'info') {
    const kv = (k, v, note = '') => `<tr><td class="tl">${k}</td><td>${esc(v ?? '-')}${note}</td></tr>`;
    const dis = p.bioDisputed || {};
    const warn = (field, fmt = (x) => x) => (field in dis ? ` <i class="bio-warn" title="ESPN 원본: ${esc(fmt(dis[field]) ?? '-')}">!</i>` : '');
    const pc = p.photoCredit;
    const link = (u, t) => (u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>` : esc(t));
    const photoLine = !pc ? '<p class="p-note">사진: 사진을 구하지 못해 이니셜로 표시합니다.</p>'
      : p.photoSource === 'premierleague'
        ? `<p class="p-note">사진: ${link(pc.pageURL, 'Premier League 공식 사이트')} · 개인 로컬 열람용 이미지입니다.</p>`
        : `<p class="p-note">사진: ${esc(pc.author)} · ${link(pc.licenseURL, pc.license)} · ${link(pc.pageURL, 'Wikimedia Commons')}</p>`;
    const srcText = { override: '수동 보정', wikidata: 'Wikidata 보정', espn: p.bioVerified ? 'ESPN · Wikidata 교차 확인' : 'ESPN 원본 (미검증)' }[p.bioSource] || 'ESPN';
    const disNote = Object.keys(dis).length
      ? `<p class="p-note bio-note">ESPN 원본은 ${[['nationality', '국적', (x) => x], ['birthDate', '생년월일', (x) => x], ['heightCM', '키', (x) => (x ? x + ' cm' : '-')]]
        .filter(([f]) => f in dis).map(([f, l, fmt]) => `${l} ${esc(fmt(dis[f]) ?? '-')}`).join(' · ')} 로 달랐습니다 (동명이인 프로필이 섞인 것으로 보여 보정).</p>` : '';
    body = panel('선수 정보', `<table class="fm-t fm-kv">${kv('국적', p.nationality, warn('nationality'))}${kv('포지션', POS[p.position][1])}${kv('나이', p.age != null ? p.age + '세' : null)}
      ${kv('생년월일', p.birthDate, warn('birthDate'))}${kv('키', p.heightCM ? p.heightCM + ' cm' : null, warn('heightCM', (x) => (x ? x + ' cm' : '-')))}${kv('몸무게', p.weightKG ? p.weightKG + ' kg' : null)}
      ${kv('출생지', p.birthPlace)}${kv('등번호', p.number)}</table>
      <p class="p-note">신상 출처: ${srcText}${p.bioPending ? ' · 교차 확인 중(잠시 후 새로고침)' : ''}. 시즌 기록은 ESPN, 능력치는 EA SPORTS FC 공식 평가입니다(개요 탭). 경기 평점은 제공되지 않아 표시하지 않습니다.</p>${photoLine}${disNote}`);
  } else {
    body = overviewHtml(p);
  }
  return hero + tabs + body;
}

function leagueView() {
  const sub = subOf('league', 'table');
  const tabs = subTabs('league', [['table', '순위'], ['clubs', '구단']], sub);
  if (sub === 'clubs') {
    if (bad(model.clubs)) return tabs + err(failMsg(model.clubs));
    return tabs + panel(`프리미어리그 ${model.clubs.length}개 구단`, `<div class="clubs">${model.clubs.map((c) => `<button data-go="club" data-id="${c.club.id}">${crest(c.club, 34)}<span>${esc(c.club.shortName)}</span></button>`).join('')}</div>`);
  }
  if (bad(model.standings)) return tabs + err(failMsg(model.standings));
  const rows = model.standings.map((r) => `<tr class="z-${r.zone}${r.club.id === TEAM ? ' me' : ''}" data-go="club" data-id="${r.club.id}"><td class="rk">${r.rank}</td>
    <td class="tl">${crest(r.club, 18)} ${esc(r.club.shortName)}</td><td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td><td>${r.goalDifference > 0 ? '+' : ''}${r.goalDifference}</td><td class="fm-hl">${r.points}</td></tr>`).join('');
  return tabs + panel('', `<table class="fm-t lg-t"><thead><tr><th>#</th><th class="tl">구단</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>승점</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="p-note"><i class="zk champions"></i>챔피언스리그 <i class="zk europa"></i>유로파 <i class="zk relegation"></i>강등</p>`);
}

function clubView(id) {
  const c = (model.clubs || []).find((x) => x.club.id === id);
  const row = (model.standings || []).find((r) => r.club.id === id);
  if (!c) return err('구단 정보가 없어요.');
  const roster = model.rosters[id];
  const hero = panel('', `<div class="nx halo"><div>${crest(c.club, 58)}<b>${esc(c.club.name)}</b></div></div>
    ${row ? `<div class="hchips sm">${chip('순위', row.rank, row.rank === 1)}${chip('승점', row.points)}${chip('승', row.won)}${chip('무', row.drawn)}${chip('패', row.lost)}</div>` : ''}`, 'fm-hero fm-card', palStyle(c.club.code));
  const body = roster && roster.__error ? err(roster.__error) : roster ? teamSquadHtml(id, roster) : err('스쿼드 불러오는 중…');
  return hero + body;
}

function newsView() {
  if (bad(model.news)) return err(failMsg(model.news));
  return `<p class="p-note">출처: BBC Sport (영문 원문). 한글 번역은 앱의 온디바이스 번역(실기기)에서 동작합니다.</p>`
    + model.news.map((n) => panel('', `<b>${esc(n.title)}</b><p class="p-dim">${esc(n.summary)}</p><small class="p-dim">${n.date ? dayText(n.date) : ''}</small>`)).join('');
}

function diagView() {
  const d = model.diag;
  if (bad(d)) return err(failMsg(d));
  const meta = `<p class="p-note">출처 ${esc(d.source)} · 확인 ${d.checkedAt ? fmtDateTime(d.checkedAt) : '-'}</p>`;
  return panel('데이터 점검', d.checks.map((c) => `<div class="p-chk ${c.level}"><i></i><span><b>${esc(c.title)}</b><small>${esc(c.detail)}</small></span></div>`).join('') + meta);
}

const VIEW_TITLE = { home: '에버턴', fixtures: '일정', league: '프리미어리그', squad: '스쿼드', news: '뉴스', match: '경기', player: '선수', club: '구단', diag: '데이터 점검' };
function current() { return nav.stack.length ? nav.stack[nav.stack.length - 1] : { view: nav.tab }; }

function renderPhone() {
  const cur = current();
  const body = { home: homeView, fixtures: fixturesView, league: leagueView, squad: squadView, news: newsView, diag: diagView,
    match: () => matchView(cur.id), player: () => playerView(cur.id), club: () => clubView(cur.id) }[cur.view]();
  const scr = $('#phoneScreen');
  if (!scr) return;
  const keep = $('#pBody')?.scrollTop || 0;
  const navPal = cur.view === 'club' ? palOfClub(cur.id) : cur.view === 'player' ? palOfClub(clubIdOfPlayer(cur.id)) : '';   // 구단·선수 화면은 상단 바도 팀 색
  scr.innerHTML = `<header class="fm-nav"${navPal ? ` style="${navPal}"` : ''}>${nav.stack.length ? '<button data-back aria-label="뒤로">‹</button>' : '<span class="fm-badge">EFC</span>'}<b>${esc(VIEW_TITLE[cur.view])}</b><span class="fm-src">ESPN</span></header>
    <div class="p-body" id="pBody">${body}</div>
    <nav class="p-tabs">${TABS.map(([k, t]) => `<button data-tab="${k}" class="${nav.tab === k ? 'on' : ''}">${tabIcon(k)}<span>${t}</span></button>`).join('')}</nav>`;
  if (keep && nav.keepScroll) { $('#pBody').scrollTop = keep; }
  nav.keepScroll = false;
  const fxKey = `${cur.view}:${cur.id ?? ''}`, fresh = fxKey !== lastFx;   // 같은 화면을 다시 그릴 때(탭 전환·사진 갱신)는 효과를 다시 틀지 않는다
  lastFx = fxKey; scr.classList.toggle('nofx', !fresh);
  countUp(scr, fresh);
}
let lastFx = '';
// [data-count] 숫자를 0 에서 목표 값까지 올린다. 모션 줄이기면 바로 최종 값.
function countUp(root, animate) {
  const still = !animate || matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.querySelectorAll('[data-count]').forEach((el) => {
    const to = +el.dataset.count; if (still || !Number.isFinite(to) || to <= 0) { el.textContent = to; return; }
    const t0 = performance.now(); el.textContent = 0;
    const tick = (now) => { const k = Math.min(1, (now - t0) / 900); el.textContent = Math.round(to * (1 - (1 - k) ** 3)); if (k < 1 && el.isConnected) requestAnimationFrame(tick); else el.closest('.hchip')?.classList.add('pop'); };
    requestAnimationFrame(tick);
  });
}

// 사진은 백그라운드에서 받아 오므로, 대기 중인 선수가 있으면 몇 번 다시 불러와 화면에 반영한다.
const photoTries = {};
function watchPhotos(id) {
  const r = model.rosters[id];
  if (!r || r.__error || !(r.players || []).some((p) => p.photoPending) || (photoTries[id] || 0) >= 8) return;
  photoTries[id] = (photoTries[id] || 0) + 1;
  setTimeout(async () => {
    const fresh = await api(`/ios/squad?club=${id}`).catch(() => null);
    if (fresh && !fresh.__error) { model.rosters[id] = fresh; renderPhone(); }
    watchPhotos(id);
  }, 8000);
}

async function ensureRoster(id) {
  if (model.rosters[id] && !model.rosters[id].__error) return;
  model.rosters[id] = await api(`/ios/squad?club=${id}`).catch((e) => ({ __error: e.message || '스쿼드를 불러오지 못했어요' }));
  watchPhotos(id);
  if (current().view === 'club' && current().id === id) renderPhone();
}

async function ensureTactics(id) {
  if (model.tactics[id] && !model.tactics[id].__error) return;
  model.tactics[id] = await api(`/ios/tactics?club=${id}`).catch((e) => ({ __error: e.message || '전술을 불러오지 못했어요' }));
  const c = current();
  if ((c.view === 'club' && c.id === id) || (c.view === 'squad' && id === TEAM) || (!nav.stack.length && nav.tab === 'squad' && id === TEAM)) renderPhone();
}

async function go(view, id) {
  nav.stack.push({ view, id });
  nav.tabs.player = nav.tabs.match = 'ov';
  renderPhone();
  if (view === 'match' && !model.details[id]) {
    model.details[id] = await api(`/ios/match/${id}`).catch((e) => ({ __error: e.message }));
    if (current().view === 'match' && current().id === id) renderPhone();
  }
  if (view === 'club') { ensureRoster(id); ensureTactics(id); }
}

/* ---------------- 개발 현황 ---------------- */
function statusHtml(s) {
  if (!s.available) return card('<p class="p-dim">iOS 저장소를 찾지 못했어요.</p>', 'st');
  const max = Math.max(...s.modules.map((m) => m.lines));
  const mods = s.modules.map((m) => `<div class="st-mod"><span><b>${m.name}</b><small>${esc(m.role)} · ${m.files}파일</small></span><div class="st-bar"><i style="width:${(m.lines / max) * 100}%"></i></div><em>${numFmt.format(m.lines)}</em></div>`).join('');
  const feats = s.features.map((f) => `<li class="${f.implemented ? 'ok' : 'no'}"><b>${esc(f.name)}</b><span>${esc(f.desc)}</span>
    <em>${f.implemented ? '구현됨' : `${f.present}/${f.files}`}</em>${f.tests ? '<em class="t">테스트</em>' : '<em class="x"></em>'}<em class="u">실기기 미검증</em></li>`).join('');
  const commits = s.commits.map((c) => `<li><code>${esc(c.hash)}</code><span>${esc(c.subject)}</span><small>${fmtDateTime(c.at)}</small></li>`).join('');
  return `<div class="st-top">
      <div><b>${s.commits_total ?? '-'}</b><small>커밋</small></div><div><b>${numFmt.format(s.source_lines)}</b><small>소스 줄</small></div>
      <div><b>${s.tests.functions}</b><small>테스트</small></div><div><b>${s.implemented}/${s.features.length}</b><small>기능 구현</small></div></div>
    <div class="st-warn">⚠ 컴파일·실기기 미검증 — 왼쪽 휴대폰은 앱과 같은 로직으로 ESPN <b>실데이터</b>를 보여 주는 <b>재현</b>이며 SwiftUI 렌더링은 확인하지 못합니다.</div>
    ${card(`${title('모듈')}${mods}`, 'st')}${card(`${title('기능')}<ul class="st-feat">${feats}</ul>`, 'st')}
    ${card(`${title('최근 커밋')}<ul class="st-log">${commits}</ul>`, 'st')}
    ${card(`${title('남은 확인')}<ul class="st-open">${s.open_items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`, 'st')}`;
}

function renderIos() {
  return `<div class="ios-wrap">
    <div class="ios-phone-col"><div class="phone"><span class="notch"></span><div class="screen" id="phoneScreen"><p class="p-dim" style="padding:60px 20px">불러오는 중…</p></div><span class="homebar"></span></div>
      <div class="ios-tools"><button class="btn" id="iosReload">데이터 새로고침</button><button class="btn" id="iosHome">처음으로</button></div></div>
    <div class="ios-panel" id="iosStatus"><p class="empty-inline">불러오는 중…</p></div></div>`;
}

function mountIos() {
  nav.tab = 'home'; nav.stack = []; nav.fixtureFilter = 'all'; model.details = {};
  const screen = () => $('#phoneScreen');
  const start = async () => { await loadAll(); renderPhone(); };
  start();
  api('/ios/status').then((s) => fill('#iosStatus', statusHtml(s))).catch((e) => fill('#iosStatus', errLine(e)));
  screen()?.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-tab],[data-go],[data-back],[data-filter],[data-sub],[data-sort],[data-raw]');
    if (!el) return;
    if (el.dataset.tab) { nav.tab = el.dataset.tab; nav.stack = []; renderPhone(); }
    else if (el.dataset.go) go(el.dataset.go, el.dataset.id ? Number(el.dataset.id) : undefined);
    else if (el.hasAttribute('data-back')) { nav.stack.pop(); renderPhone(); }
    else if (el.dataset.filter) { nav.fixtureFilter = el.dataset.filter; renderPhone(); }
    else if (el.dataset.sub) { const [k, v] = el.dataset.sub.split(':'); nav.tabs[k] = v; nav.keepScroll = false; renderPhone(); }
    else if (el.hasAttribute('data-raw')) { nav.raw = !nav.raw; nav.keepScroll = true; renderPhone(); }
    else if (el.dataset.sort) { nav.sort = el.dataset.sort; nav.keepScroll = true; renderPhone(); }
  });
  $('#iosReload')?.addEventListener('click', () => { model.details = {}; model.tactics = {}; start(); });
  $('#iosHome')?.addEventListener('click', () => { nav.tab = 'home'; nav.stack = []; renderPhone(); });
  every(1000, () => document.querySelectorAll('#phoneScreen .p-count').forEach((n) => { n.textContent = countdown(n.dataset.kick) || '곧 시작'; }));
}

export { countdown, mountIos, renderIos, resultOf };

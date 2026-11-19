// iOS 앱 (Menu 8): 휴대폰 목업(앱과 같은 샘플 데이터·계산 규칙) + 개발 현황
import { api } from '../core/api.js';
import { $, errLine, esc, fill } from '../core/dom.js';
import { fmtDateTime, numFmt } from '../core/format.js';
import { every } from '../core/state.js';

const TABS = [['home', '개요'], ['fixtures', '일정'], ['league', '리그'], ['squad', '스쿼드'], ['news', '뉴스']];
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
const flag = (p) => (p.flagURL ? `<img class="flag" src="${esc(p.flagURL)}" alt="${esc(p.nationality || '')}" title="${esc(p.nationality || '')}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('i'), { className: 'flag' }))">` : '<i class="flag"></i>');
const formBoxes = (letters) => `<span class="fm-form">${letters.map((r) => `<i class="r-${r}">${{ W: '승', D: '무', L: '패' }[r]}</i>`).join('')}</span>`;
const card = (inner, cls = '') => `<section class="p-card ${cls}">${inner}</section>`;
const title = (t) => `<h3 class="p-sec">${esc(t)}</h3>`;
const panel = (head, inner, cls = '') => `<section class="fmp ${cls}">${head ? `<h3 class="fmp-h">${head}</h3>` : ''}<div class="fmp-b">${inner}</div></section>`;
const err = (msg) => panel('', `<p class="p-dim">${esc(msg)}</p>`);

/* ---------------- 상태 (앱의 AppModel) ---------------- */
const model = { overview: null, matches: null, squad: null, clubs: null, standings: null, news: null, diag: null, details: {}, rosters: {} };
const nav = { tab: 'home', stack: [], fixtureFilter: 'all', sort: 'pos', tabs: {} };

async function loadAll() {
  const get = (path) => api(path).catch((e) => ({ __error: e.message || String(e) }));
  const [overview, matches, squad, clubs, standings, news, diag] = await Promise.all(
    ['/ios/overview', '/ios/matches', '/ios/squad', '/ios/clubs', '/ios/standings', '/ios/news', '/ios/diagnostics'].map(get));
  Object.assign(model, { overview, matches, squad, clubs, standings, news, diag });
  if (squad && !squad.__error) model.rosters[TEAM] = squad;
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
    topIds.map(findPlayer).filter(Boolean).slice(0, 5).map((p) => `<tr data-go="player" data-id="${p.id}"><td class="tl">${posBadge(p.position)} ${esc(p.shortName)}</td><td>${st(p, 'appearances')}</td><td>${st(p, 'goals')}</td><td>${st(p, 'assists')}</td><td class="hl">${p.contribution}</td></tr>`).join('')}</tbody></table>`) : '';
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

function pitch(lineup) {
  const rows = {};
  lineup.starters.forEach((p) => { const [r, c] = (p.grid || '9:9').split(':').map(Number); (rows[r] ||= []).push({ ...p, c }); });
  const lines = Object.keys(rows).map(Number).sort((a, b) => b - a).map((r) =>
    `<div class="pl">${rows[r].sort((a, b) => a.c - b.c).map((p) => `<span class="pp"><i>${p.number ?? ''}</i><small>${esc(p.name.split(' ').pop())}</small></span>`).join('')}</div>`).join('');
  return `<div class="pitch">${lines}</div>`;
}

const SORTS = { pos: (a, b) => 0, apps: (a, b) => (st(b, 'appearances') || 0) - (st(a, 'appearances') || 0), goals: (a, b) => (st(b, 'goals') || 0) - (st(a, 'goals') || 0),
  assists: (a, b) => (st(b, 'assists') || 0) - (st(a, 'assists') || 0), age: (a, b) => (a.age || 0) - (b.age || 0) };
function rosterTable(players, ctx = 'squad') {
  const sorted = [...players].sort(SORTS[nav.sort] || SORTS.pos);
  const th = (k, t) => `<th class="${nav.sort === k ? 'on' : ''}" data-sort="${k}">${t}</th>`;
  return `<table class="fm-t sq"><thead><tr><th>#</th><th class="tl" data-sort="pos">선수</th>${th('age', '나이')}${th('apps', '출전')}${th('goals', '골')}${th('assists', '도움')}</tr></thead><tbody>${
    sorted.map((p) => `<tr data-go="player" data-id="${p.id}"><td class="num">${dash(p.number)}</td><td class="tl">${posBadge(p.position)} ${flag(p)} ${esc(p.shortName)}</td><td>${dash(p.age)}</td>
      <td>${dash(st(p, 'appearances'))}</td><td class="${st(p, 'goals') ? 'hl' : ''}">${dash(st(p, 'goals'))}</td><td class="${st(p, 'assists') ? 'hl' : ''}">${dash(st(p, 'assists'))}</td></tr>`).join('')}</tbody></table>`;
}

function squadView() {
  const sq = model.rosters[TEAM];
  if (!sq) return err(failMsg(model.squad));
  return panel(`1군 스쿼드 · ${sq.players.length}명${sq.coach ? ` · 감독 ${esc(sq.coach)}` : ''}`, rosterTable(sq.players));
}

function radarSvg(metrics) {
  const R = 74, C = 100, n = metrics.length;
  const pt = (i, v) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; return [C + Math.cos(a) * R * v, C + Math.sin(a) * R * v]; };
  const ring = (k) => metrics.map((_, i) => pt(i, k).map((x) => x.toFixed(1)).join(',')).join(' ');
  const shape = metrics.map((m, i) => pt(i, m.value).map((x) => x.toFixed(1)).join(',')).join(' ');
  const labels = metrics.map((m, i) => { const [x, y] = pt(i, 1.22); return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${esc(m.label)}</text>`; }).join('');
  return `<svg viewBox="-26 -4 252 208" class="radar">${[0.33, 0.66, 1].map((k) => `<polygon points="${ring(k)}" class="rg"/>`).join('')}<polygon points="${shape}" class="rs"/>${labels}</svg>`;
}

function playerView(id) {
  const p = findPlayer(id);
  if (!p) return err('선수를 찾지 못했어요.');
  const sub = subOf('player', 'ov'), s = p.stats, apps = s ? s.appearances : 0;
  const hero = panel('', `<div class="ph"><span class="av">${esc(p.name.slice(0, 1))}</span><div><b>${p.number != null ? `#${p.number} ` : ''}${esc(p.name)}</b>
      <small>${posBadge(p.position)} ${POS[p.position][1]} · ${dash(p.age)}세</small><small>${flag(p)} ${esc(p.nationality || '-')}</small></div></div>`, 'fm-hero');
  const tabs = subTabs('player', [['ov', '개요'], ['stats', '기록'], ['info', '정보']], sub);
  let body;
  if (sub === 'stats') {
    const rows = !s ? [] : p.position === 'goalkeeper'
      ? [['출전', s.appearances], ['교체 투입', s.subIns], ['선방', s.saves], ['실점', s.conceded], ['피유효슈팅', s.shotsFaced], ['경고', s.yellow], ['퇴장', s.red], ['파울', s.foulsCommitted]]
      : [['출전', s.appearances], ['교체 투입', s.subIns], ['골', s.goals], ['도움', s.assists], ['슈팅', s.shots], ['유효슈팅', s.shotsOnTarget], ['파울 획득', s.foulsSuffered], ['파울', s.foulsCommitted],
        ['오프사이드', s.offsides], ['경고', s.yellow], ['퇴장', s.red], ['자책골', s.ownGoals]];
    body = panel('시즌 기록', rows.length ? `<table class="fm-t kv">${rows.map(([l, v]) => `<tr><td class="tl">${l}</td><td class="hl">${v}</td><td class="dim">${apps ? per(v, apps) + '/경기' : ''}</td></tr>`).join('')}</table>` : '<p class="p-dim">시즌 기록이 없어요.</p>');
  } else if (sub === 'info') {
    const kv = (k, v) => `<tr><td class="tl">${k}</td><td>${esc(v ?? '-')}</td></tr>`;
    body = panel('선수 정보', `<table class="fm-t kv">${kv('국적', p.nationality)}${kv('포지션', POS[p.position][1])}${kv('나이', p.age != null ? p.age + '세' : null)}${kv('생년월일', p.birthDate)}
      ${kv('키', p.heightCM ? p.heightCM + ' cm' : null)}${kv('몸무게', p.weightKG ? p.weightKG + ' kg' : null)}${kv('출생지', p.birthPlace)}${kv('등번호', p.number)}</table>
      <p class="p-note">사진·평점·패스 지표는 데이터 출처(ESPN)가 제공하지 않아 표시하지 않습니다.</p>`);
  } else {
    const tags = p.strengths.length ? `<div class="p-tags"><small>강점</small>${p.strengths.map((t) => `<b>${esc(t)}</b>`).join('')}</div>` : '';
    const bars = p.radar.map((m) => `<div class="ab"><span>${esc(m.label)}</span><div><i class="${attrClass(m.value)}" style="width:${Math.max(m.value * 100, 3)}%"></i></div><em class="${attrClass(m.value)}">${Math.round(m.value * 100)}</em></div>`).join('');
    body = (tags ? panel('', tags) : '') + panel('시즌 스탯 지표 (출전당)', p.radar.length ? `${radarSvg(p.radar)}<div class="abs">${bars}</div>
      <p class="p-note">골·도움 등 실제 기록을 출전 1회당으로 환산한 값입니다. 평점이 아닙니다.</p>` : '<p class="p-dim">출전 기록이 없어 지표를 만들 수 없어요.</p>');
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
    <td class="tl">${crest(r.club, 18)} ${esc(r.club.shortName)}</td><td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td><td>${r.goalDifference > 0 ? '+' : ''}${r.goalDifference}</td><td class="hl">${r.points}</td></tr>`).join('');
  return tabs + panel('', `<table class="fm-t lg-t"><thead><tr><th>#</th><th class="tl">구단</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득실</th><th>승점</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="p-note"><i class="zk champions"></i>챔피언스리그 <i class="zk europa"></i>유로파 <i class="zk relegation"></i>강등</p>`);
}

function clubView(id) {
  const c = (model.clubs || []).find((x) => x.club.id === id);
  const row = (model.standings || []).find((r) => r.club.id === id);
  if (!c) return err('구단 정보가 없어요.');
  const roster = model.rosters[id];
  const hero = panel('', `<div class="nx"><div>${crest(c.club, 58)}<b>${esc(c.club.name)}</b></div></div>
    ${row ? `<p class="p-when">${row.rank}위 · 승점 ${row.points} · ${row.won}승 ${row.drawn}무 ${row.lost}패</p>` : ''}`, 'fm-hero');
  const body = roster && roster.__error ? err(roster.__error) : roster ? panel(`스쿼드 · ${roster.players.length}명${roster.coach ? ` · 감독 ${esc(roster.coach)}` : ''}`, rosterTable(roster.players)) : err('스쿼드 불러오는 중…');
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
  scr.innerHTML = `<header class="fm-nav">${nav.stack.length ? '<button data-back aria-label="뒤로">‹</button>' : '<span class="fm-badge">EFC</span>'}<b>${esc(VIEW_TITLE[cur.view])}</b><span class="fm-src">ESPN</span></header>
    <div class="p-body" id="pBody">${body}</div>
    <nav class="p-tabs">${TABS.map(([k, t]) => `<button data-tab="${k}" class="${nav.tab === k ? 'on' : ''}">${t}</button>`).join('')}</nav>`;
  if (keep && nav.keepScroll) { $('#pBody').scrollTop = keep; }
  nav.keepScroll = false;
}

async function ensureRoster(id) {
  if (model.rosters[id] && !model.rosters[id].__error) return;
  model.rosters[id] = await api(`/ios/squad?club=${id}`).catch((e) => ({ __error: e.message || '스쿼드를 불러오지 못했어요' }));
  if (current().view === 'club' && current().id === id) renderPhone();
}

async function go(view, id) {
  nav.stack.push({ view, id });
  nav.tabs.player = nav.tabs.match = 'ov';
  renderPhone();
  if (view === 'match' && !model.details[id]) {
    model.details[id] = await api(`/ios/match/${id}`).catch((e) => ({ __error: e.message }));
    if (current().view === 'match' && current().id === id) renderPhone();
  }
  if (view === 'club') ensureRoster(id);
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
    const el = ev.target.closest('[data-tab],[data-go],[data-back],[data-filter],[data-sub],[data-sort]');
    if (!el) return;
    if (el.dataset.tab) { nav.tab = el.dataset.tab; nav.stack = []; renderPhone(); }
    else if (el.dataset.go) go(el.dataset.go, el.dataset.id ? Number(el.dataset.id) : undefined);
    else if (el.hasAttribute('data-back')) { nav.stack.pop(); renderPhone(); }
    else if (el.dataset.filter) { nav.fixtureFilter = el.dataset.filter; renderPhone(); }
    else if (el.dataset.sub) { const [k, v] = el.dataset.sub.split(':'); nav.tabs[k] = v; nav.keepScroll = false; renderPhone(); }
    else if (el.dataset.sort) { nav.sort = el.dataset.sort; nav.keepScroll = true; renderPhone(); }
  });
  $('#iosReload')?.addEventListener('click', () => { model.details = {}; start(); });
  $('#iosHome')?.addEventListener('click', () => { nav.tab = 'home'; nav.stack = []; renderPhone(); });
  every(1000, () => document.querySelectorAll('#phoneScreen .p-count').forEach((n) => { n.textContent = countdown(n.dataset.kick) || '곧 시작'; }));
}

export { countdown, mountIos, renderIos, resultOf };

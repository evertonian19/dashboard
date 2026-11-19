// iOS 앱 (Menu 8): 휴대폰 목업(앱과 같은 샘플 데이터·계산 규칙) + 개발 현황
import { api } from '../core/api.js';
import { $, errLine, esc, fill } from '../core/dom.js';
import { fmtDateTime, numFmt } from '../core/format.js';
import { every } from '../core/state.js';

const TABS = [['home', '홈', '🏠'], ['fixtures', '일정', '📅'], ['league', '리그', '🏆'], ['squad', '스쿼드', '👥'], ['news', '뉴스', '📰']];
const TEAM = 45;
const kst = (iso, o) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', ...o }).format(new Date(iso));
const dayText = (iso) => kst(iso, { month: 'long', day: 'numeric', weekday: 'short' });
const timeText = (iso) => kst(iso, { hour: '2-digit', minute: '2-digit', hour12: false });
const monthText = (iso) => kst(iso, { year: 'numeric', month: 'long' });
const rating = (v) => (v == null ? '-' : Number(v).toFixed(1));
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

const crest = (c, size = 28) => `<span class="crest" style="--s:${size}px" title="${esc(c.name)}">${esc(c.name.slice(0, 2).toUpperCase())}${
  c.logoURL ? `<img src="${esc(c.logoURL)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`;
const formDots = (letters) => `<span class="p-form">${letters.map((r) => `<i class="r-${r}">${r}</i>`).join('')}</span>`;
const card = (inner, cls = '') => `<section class="p-card ${cls}">${inner}</section>`;
const title = (t) => `<h3 class="p-sec">${esc(t)}</h3>`;

/* ---------------- 상태 (앱의 AppModel) ---------------- */
const model = { overview: null, matches: null, squad: null, clubs: null, standings: null, news: null, diag: null, details: {} };
const nav = { tab: 'home', stack: [], fixtureFilter: 'all' };

async function loadAll() {
  const get = (path) => api(path).catch((e) => ({ __error: e.message || String(e) }));
  const [overview, matches, squad, clubs, standings, news, diag] = await Promise.all(
    ['/ios/overview', '/ios/matches', '/ios/squad', '/ios/clubs', '/ios/standings', '/ios/news', '/ios/diagnostics'].map(get));
  Object.assign(model, { overview, matches, squad, clubs, standings, news, diag });
}
const bad = (x) => !x || x.__error;
const playerById = (id) => (model.squad?.players || []).find((p) => p.id === id);

/* ---------------- 화면 ---------------- */
function matchRow(m) {
  const r = resultOf(m), o = opp(m);
  return `<button class="p-row" data-go="match" data-id="${m.id}">
    ${crest(o)}<span class="p-row-main"><b>${isHome(m) ? '' : '@ '}${esc(o.name)}</b><small>${dayText(m.kickoff)} ${timeText(m.kickoff)}</small></span>
    ${r ? `<span class="p-score">${m.homeGoals} : ${m.awayGoals}</span><i class="p-res r-${r}">${r}</i>` : '<span class="p-soon">예정</span>'}</button>`;
}

function homeView() {
  const ov = model.overview;
  if (bad(ov)) return card(errLine(ov?.__error ? new Error(ov.__error) : new Error('불러오지 못했어요')));
  const n = ov.next;
  const next = n ? card(`<small class="p-dim">다음 경기 · ${esc(n.competition)}</small>
    <div class="p-vs">${crest(n.home, 44)}<b>VS</b>${crest(n.away, 44)}</div>
    <div class="p-names"><span>${esc(n.home.name)}</span><span>${esc(n.away.name)}</span></div>
    <p class="p-when">${dayText(n.kickoff)} ${timeText(n.kickoff)}</p>
    <p class="p-count" data-kick="${esc(n.kickoff)}">${countdown(n.kickoff) || '곧 시작'}</p>`, 'p-hero')
    : card('<p class="p-dim">예정된 경기가 없어요.</p>');
  const recent = [...ov.recent].reverse().map(matchRow).join('');
  const top = (model.squad?.topRated || []).map(playerById).filter(Boolean).slice(0, 5).map((p) => `
    <button class="p-row" data-go="player" data-id="${p.id}"><span class="p-num">${p.number ?? ''}</span>
    <span class="p-row-main"><b>${esc(p.name)}</b><small>${esc(posTitle(p.position))}</small></span><span class="p-rate">${rating(p.stats?.rating)}</span></button>`).join('');
  return next + card(`${title('최근 5경기')}${formDots(ov.form)}`) + card(`${title('지난 경기')}${recent}`) + card(`${title('시즌 평점 TOP')}${top}`)
    + `<button class="p-link" data-go="diag">데이터 점검 ›</button>`;
}

function fixturesView() {
  if (bad(model.matches)) return card('<p class="p-dim">일정을 불러오지 못했어요.</p>');
  const f = nav.fixtureFilter;
  const list = model.matches.filter((m) => f === 'all' || (f === 'upcoming' ? m.phase !== 'finished' : m.phase === 'finished'))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  const seg = [['all', '전체'], ['upcoming', '예정'], ['finished', '결과']].map(([k, t]) => `<button class="${f === k ? 'on' : ''}" data-filter="${k}">${t}</button>`).join('');
  let last = '', rows = '';
  for (const m of list) {
    const mo = monthText(m.kickoff);
    if (mo !== last) { rows += title(mo); last = mo; }
    rows += matchRow(m);
  }
  return `<div class="p-seg">${seg}</div>${card(rows || '<p class="p-dim">경기가 없어요.</p>')}`;
}

function matchView(id) {
  const d = model.details[id];
  if (!d) return card('<p class="p-dim">불러오는 중…</p>');
  if (d.__error) return card('<p class="p-dim">경기 정보를 불러오지 못했어요.</p>');
  const m = d.match;
  const head = card(`<small class="p-dim">${esc(m.round)} · ${dayText(m.kickoff)}</small>
    <div class="p-vs">${crest(m.home, 40)}<b class="p-big">${m.homeGoals == null ? 'VS' : `${m.homeGoals} : ${m.awayGoals}`}</b>${crest(m.away, 40)}</div>
    <div class="p-names"><span>${esc(m.home.name)}</span><span>${esc(m.away.name)}</span></div>`, 'p-hero');
  const stats = d.stats.map((s) => {
    const total = s.home + s.away || 1, pct = (v) => (v / total) * 100, fmt = (v) => `${v}${s.isPercent ? '%' : ''}`;
    return `<div class="p-stat"><span>${fmt(s.home)}</span><div class="p-bar"><i class="h" style="width:${pct(s.home)}%"></i><i class="a" style="width:${pct(s.away)}%"></i></div><span>${fmt(s.away)}</span><small>${esc(s.label)}</small></div>`;
  }).join('');
  const lineup = d.lineups[0];
  const events = d.events.map((e) => `<div class="p-ev ${e.clubID === m.home.id ? 'l' : 'r'}"><span>${e.minute}'</span><span>${e.icon} ${esc(e.player)}</span></div>`).join('');
  return head + (stats ? card(`${title('경기 통계')}${stats}`) : '') + (lineup ? card(`${title(`라인업 ${esc(lineup.formation || '')}`)}${pitch(lineup)}`) : '')
    + (events ? card(`${title('주요 장면')}${events}`) : '');
}

function pitch(lineup) {
  const rows = {};
  lineup.starters.forEach((p) => { const [r, c] = (p.grid || '1:1').split(':').map(Number); (rows[r] ||= []).push({ ...p, c }); });
  const lines = Object.keys(rows).map(Number).sort((a, b) => b - a).map((r) =>
    `<div class="pl">${rows[r].sort((a, b) => a.c - b.c).map((p) => `<span class="pp"><i>${p.number ?? ''}</i><small>${esc(p.name.split(' ').pop())}</small>${p.rating ? `<em>${rating(p.rating)}</em>` : ''}</span>`).join('')}</div>`).join('');
  return `<div class="pitch">${lines}</div>`;
}

const posTitle = (p) => ({ goalkeeper: '골키퍼', defender: '수비수', midfielder: '미드필더', attacker: '공격수' }[p] || p);
const tier = (r) => (r >= 7.3 ? 'gold' : r >= 7 ? 'silver' : 'bronze');

function squadView() {
  if (bad(model.squad)) return card('<p class="p-dim">스쿼드를 불러오지 못했어요.</p>');
  return ['goalkeeper', 'defender', 'midfielder', 'attacker'].map((pos) => {
    const ps = model.squad.players.filter((p) => p.position === pos);
    return ps.length ? card(`${title(posTitle(pos))}<div class="p-cards">${ps.map(playerCard).join('')}</div>`) : '';
  }).join('');
}
const playerCard = (p) => `<button class="fut ${tier(p.stats?.rating || 0)}" data-go="player" data-id="${p.id}">
  <b class="fut-r">${rating(p.stats?.rating)}</b><span class="fut-pos">${posShort(p.position)}</span><span class="fut-av">${esc(p.name.split(' ').pop().slice(0, 1))}</span>
  <span class="fut-n">${esc(p.name.split(' ').pop())}</span><small>#${p.number ?? '-'}</small></button>`;
const posShort = (p) => ({ goalkeeper: 'GK', defender: 'DF', midfielder: 'MF', attacker: 'FW' }[p]);

function radarSvg(metrics) {
  const R = 78, C = 100, n = metrics.length;
  const pt = (i, v) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; return [C + Math.cos(a) * R * v, C + Math.sin(a) * R * v]; };
  const ring = (k) => metrics.map((_, i) => pt(i, k).map((x) => x.toFixed(1)).join(',')).join(' ');
  const shape = metrics.map((m, i) => pt(i, m.value).map((x) => x.toFixed(1)).join(',')).join(' ');
  const labels = metrics.map((m, i) => { const [x, y] = pt(i, 1.2); return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${esc(m.label)}</text>`; }).join('');
  return `<svg viewBox="0 0 200 200" class="radar">${[0.33, 0.66, 1].map((k) => `<polygon points="${ring(k)}" class="rg"/>`).join('')}<polygon points="${shape}" class="rs"/>${labels}</svg>`;
}

function playerView(id) {
  const p = playerById(id);
  if (!p) return card('<p class="p-dim">선수를 찾지 못했어요.</p>');
  const s = p.stats;
  const tiles = !s ? [] : p.position === 'goalkeeper'
    ? [['출전', s.appearances], ['출전 시간', `${s.minutes}'`], ['선방', s.saves], ['실점', s.conceded], ['패스 성공률', `${s.passAccuracy}%`], ['경고', s.yellow]]
    : [['출전', s.appearances], ['출전 시간', `${s.minutes}'`], ['골', s.goals], ['도움', s.assists], ['슈팅', s.shots], ['유효슈팅', s.shotsOnTarget],
      ['키패스', s.keyPasses], ['패스 성공률', `${s.passAccuracy}%`], ['태클', s.tackles], ['드리블', s.dribbles], ['경고', s.yellow], ['퇴장', s.red]];
  const fact = (l, v) => `<div><b>${esc(v ?? '-')}</b><small>${l}</small></div>`;
  return card(`<div class="p-pl"><span class="fut-av big">${esc(p.name.slice(0, 1))}</span><div><b>#${p.number ?? '-'} ${esc(p.name)}</b>
      <small>${esc(posTitle(p.position))} · ${p.age ?? '-'}세 · ${esc(p.nationality || '')}</small></div><span class="p-rate big">${rating(s?.rating)}</span></div>`, 'p-hero')
    + card(`<div class="p-facts">${fact('키', p.heightCM ? `${p.heightCM} cm` : '-')}${fact('몸무게', p.weightKG ? `${p.weightKG} kg` : '-')}${fact('생년월일', p.birthDate)}${fact('출생지', p.birthPlace)}</div>`)
    + (p.strengths.length ? `<div class="p-tags"><small>강점</small>${p.strengths.map((t) => `<b>${esc(t)}</b>`).join('')}</div>` : '')
    + (p.radar.length ? card(`${title('능력치 레이더')}${radarSvg(p.radar)}`) : '')
    + (tiles.length ? card(`${title('시즌 기록')}<div class="p-tiles">${tiles.map(([l, v]) => `<div><b>${v}</b><small>${l}</small></div>`).join('')}</div>`) : '');
}

function leagueView() {
  if (bad(model.standings)) return card('<p class="p-dim">순위를 불러오지 못했어요.</p>');
  const rows = model.standings.map((r) => `<tr class="z-${r.zone}${r.club.id === TEAM ? ' me' : ''}"><td>${r.rank}</td>
    <td class="tl"><button data-go="club" data-id="${r.club.id}">${crest(r.club, 18)} ${esc(r.club.name)}</button></td><td>${r.played}</td><td>${r.goalDifference > 0 ? '+' : ''}${r.goalDifference}</td><td><b>${r.points}</b></td></tr>`).join('');
  const clubs = (model.clubs || []).map((c) => `<button class="p-row" data-go="club" data-id="${c.club.id}">${crest(c.club)}<span class="p-row-main"><b>${esc(c.club.name)}</b><small>${esc(c.venueName || '')}</small></span><span class="p-dim">›</span></button>`).join('');
  return card(`${title('순위')}<table class="p-table"><thead><tr><th>#</th><th class="tl">구단</th><th>경기</th><th>득실</th><th>승점</th></tr></thead><tbody>${rows}</tbody></table>`) + card(`${title('구단')}${clubs}`);
}

function clubView(id) {
  const c = (model.clubs || []).find((x) => x.club.id === id);
  const st = (model.standings || []).find((r) => r.club.id === id);
  if (!c) return card('<p class="p-dim">구단 정보가 없어요.</p>');
  const kv = (k, v) => `<div class="p-kv"><span>${k}</span><b>${esc(v ?? '-')}</b></div>`;
  return card(`<div class="p-vs">${crest(c.club, 56)}</div><h2 class="p-club">${esc(c.club.name)}</h2>`, 'p-hero')
    + card(kv('창단', c.founded) + kv('경기장', c.venueName) + kv('수용 인원', c.capacity ? `${numFmt.format(c.capacity)}명` : '-') + kv('국가', c.country) + (st ? kv('순위', `${st.rank}위 · ${st.points}점`) : ''))
    + card(`${title('선수 목록')}${id === TEAM ? (model.squad?.players || []).map((p) => `<button class="p-row" data-go="player" data-id="${p.id}"><span class="p-num">${p.number ?? ''}</span><span class="p-row-main"><b>${esc(p.name)}</b><small>${posTitle(p.position)}</small></span><span class="p-rate">${rating(p.stats?.rating)}</span></button>`).join('')
      : '<p class="p-dim">샘플 데이터에는 에버턴 스쿼드만 있어요 (앱과 동일).</p>'}`);
}

function newsView() {
  if (bad(model.news)) return card('<p class="p-dim">뉴스를 불러오지 못했어요.</p>');
  return `<p class="p-note">온디바이스 한글 번역은 실기기에서만 동작합니다. 여기서는 원문을 보여 줍니다.</p>`
    + model.news.map((n) => card(`<b>${esc(n.title)}</b><p class="p-dim">${esc(n.summary)}</p><small class="p-dim">${n.date ? dayText(n.date) : ''}</small>`)).join('');
}

function diagView() {
  const d = model.diag;
  if (bad(d)) return card('<p class="p-dim">점검 결과를 불러오지 못했어요.</p>');
  return card(d.checks.map((c) => `<div class="p-chk ${c.level}"><i></i><span><b>${esc(c.title)}</b><small>${esc(c.detail)}</small></span></div>`).join(''));
}

const VIEW_TITLE = { home: 'Everton', fixtures: '일정', league: '리그', squad: '스쿼드', news: '뉴스', match: '경기', player: '선수', club: '구단', diag: '데이터 점검' };
function current() { return nav.stack.length ? nav.stack[nav.stack.length - 1] : { view: nav.tab }; }

function renderPhone() {
  const cur = current();
  const body = { home: homeView, fixtures: fixturesView, league: leagueView, squad: squadView, news: newsView, diag: diagView,
    match: () => matchView(cur.id), player: () => playerView(cur.id), club: () => clubView(cur.id) }[cur.view]();
  const scr = $('#phoneScreen');
  if (!scr) return;
  scr.innerHTML = `<header class="p-nav">${nav.stack.length ? '<button data-back aria-label="뒤로">‹</button>' : '<span></span>'}<b>${esc(VIEW_TITLE[cur.view])}</b><span></span></header>
    <div class="p-body" id="pBody">${body}</div>
    <nav class="p-tabs">${TABS.map(([k, t, ic]) => `<button data-tab="${k}" class="${nav.tab === k ? 'on' : ''}"><i>${ic}</i>${t}</button>`).join('')}</nav>`;
}

async function go(view, id) {
  nav.stack.push({ view, id });
  renderPhone();
  if (view === 'match' && !model.details[id]) {
    model.details[id] = await api(`/ios/match/${id}`).catch((e) => ({ __error: e.message }));
    if (current().view === 'match' && current().id === id) renderPhone();
  }
}

/* ---------------- 개발 현황 ---------------- */
function statusHtml(s) {
  if (!s.available) return card('<p class="p-dim">iOS 저장소를 찾지 못했어요.</p>', 'st');
  const max = Math.max(...s.modules.map((m) => m.lines));
  const mods = s.modules.map((m) => `<div class="st-mod"><span><b>${m.name}</b><small>${esc(m.role)} · ${m.files}파일</small></span><div class="st-bar"><i style="width:${(m.lines / max) * 100}%"></i></div><em>${numFmt.format(m.lines)}</em></div>`).join('');
  const feats = s.features.map((f) => `<li class="${f.implemented ? 'ok' : 'no'}"><b>${esc(f.name)}</b><span>${esc(f.desc)}</span>
    <em>${f.implemented ? '구현됨' : `${f.present}/${f.files}`}</em>${f.tests ? '<em class="t">테스트</em>' : ''}<em class="u">실기기 미검증</em></li>`).join('');
  const commits = s.commits.map((c) => `<li><code>${esc(c.hash)}</code><span>${esc(c.subject)}</span><small>${fmtDateTime(c.at)}</small></li>`).join('');
  return `<div class="st-top">
      <div><b>${s.commits_total ?? '-'}</b><small>커밋</small></div><div><b>${numFmt.format(s.source_lines)}</b><small>소스 줄</small></div>
      <div><b>${s.tests.functions}</b><small>테스트</small></div><div><b>${s.implemented}/${s.features.length}</b><small>기능 구현</small></div></div>
    <div class="st-warn">⚠ 컴파일·실기기 미검증 — 아래 휴대폰은 같은 로직과 샘플 데이터로 만든 <b>재현</b>이며 SwiftUI 렌더링은 확인하지 못합니다.</div>
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
    const el = ev.target.closest('[data-tab],[data-go],[data-back],[data-filter]');
    if (!el) return;
    if (el.dataset.tab) { nav.tab = el.dataset.tab; nav.stack = []; renderPhone(); }
    else if (el.dataset.go) go(el.dataset.go, el.dataset.id ? Number(el.dataset.id) : undefined);
    else if (el.hasAttribute('data-back')) { nav.stack.pop(); renderPhone(); }
    else if (el.dataset.filter) { nav.fixtureFilter = el.dataset.filter; renderPhone(); }
  });
  $('#iosReload')?.addEventListener('click', () => { model.details = {}; start(); });
  $('#iosHome')?.addEventListener('click', () => { nav.tab = 'home'; nav.stack = []; renderPhone(); });
  every(1000, () => document.querySelectorAll('#phoneScreen .p-count').forEach((n) => { n.textContent = countdown(n.dataset.kick) || '곧 시작'; }));
}

export { countdown, mountIos, renderIos, resultOf };

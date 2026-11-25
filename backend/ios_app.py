"""iOS 앱(~/ios_everton)의 서비스·계산 로직을 옮긴 것. 데이터는 ESPN 공개 API 실데이터(backend/espn.py).

필드 이름은 Swift 모델(camelCase)을 따른다. ESPN 이 주지 않는 값(평점, 패스·태클 등)은 None 이며(선수 사진은 Wikidata/Commons 에서 보강)
임의의 값으로 채우지 않는다. 가져오기에 실패하면 가짜 데이터 대신 오류를 돌려준다.
"""
import json
import threading
import time
import unicodedata
import urllib.request
from pathlib import Path
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

from backend import eafc, espn, photocache, plphotos, wikidata

TEAM_ID = espn.TEAM_ID
SEASON = 2026
KST = timezone(timedelta(hours=9))
WEEKDAY_KO = "월화수목금토일"
POSITIONS = {
    "goalkeeper": {"short": "GK", "title": "골키퍼"}, "defender": {"short": "DF", "title": "수비수"},
    "midfielder": {"short": "MF", "title": "미드필더"}, "attacker": {"short": "FW", "title": "공격수"}}
EVENT_ICONS = {"goal": "⚽️", "ownGoal": "🥅", "missedPenalty": "❌", "yellow": "🟨", "red": "🟥"}
UNAVAILABLE = ["선수 평점", "패스·태클·드리블·키패스·출전 시간", "구단 창단연도·수용 인원"]   # 선수 사진은 Commons 에 있는 선수만(아래 점검 항목)
NEWS_FEED = "https://feeds.bbci.co.uk/sport/football/teams/everton/rss.xml"
NEWS_TTL = 900
_news = {"at": 0.0, "items": None}
_news_lock = threading.Lock()


def _iso_now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ---------------------------------------------------------------------------
# 도메인 규칙 (Models.swift / Formatting.swift / Metrics.swift 와 같은 규칙)

def match_result(match, team_id=TEAM_ID):
    if match["phase"] != "finished" or match["homeGoals"] is None or match["awayGoals"] is None:
        return None
    is_home = match["home"]["id"] == team_id
    mine = match["homeGoals"] if is_home else match["awayGoals"]
    theirs = match["awayGoals"] if is_home else match["homeGoals"]
    return "W" if mine > theirs else "D" if mine == theirs else "L"


def recent_results(matches, n=5):
    done = sorted((m for m in matches if m["phase"] == "finished"), key=lambda m: m["kickoff"])
    return done[-n:]


def next_match(matches, now=None):
    now_iso = (now or datetime.now(timezone.utc)).strftime("%Y-%m-%dT%H:%M:%SZ")
    cand = [m for m in matches if m["phase"] == "live" or (m["phase"] == "upcoming" and m["kickoff"] >= now_iso)]
    return min(cand, key=lambda m: m["kickoff"]) if cand else None


def _metric(label, value):
    return {"label": label, "value": min(max(value, 0.0), 1.0)}


# 지표 기준값(출전 1회당). 이 값이면 레이더 가장자리(1.0)에 닿는다.
FIELD_SCALE = {"goals": 0.6, "assists": 0.4, "shots": 3.0, "shotsOnTarget": 1.2, "foulsSuffered": 2.0}
CARD_RATE = 0.4         # 출전당 카드 점수(경고 1, 퇴장 3)가 이 값이면 규율 0
GK_SAVES_PER_APP = 4.0
GK_CONCEDED_PER_APP = 2.5
STRENGTH_MIN_APPEARANCES = 3
STRENGTH_THRESHOLD = 0.5


def radar(player, team_games=None):
    """실제 시즌 스탯(출전 1회당)으로 만든 0~1 지표. 출전 기록이 없으면 빈 배열."""
    s = player.get("stats")
    if not s or s["appearances"] <= 0:
        return []
    apps = s["appearances"]
    cards = (s["yellow"] + 3 * s["red"]) / apps
    discipline = _metric("규율", 1 - min(cards / CARD_RATE, 1))
    if player["position"] == "goalkeeper":
        faced = s["saves"] + s["conceded"]
        out = [_metric("선방률", s["saves"] / faced if faced else 0), _metric("경기당 선방", s["saves"] / apps / GK_SAVES_PER_APP),
               _metric("실점 억제", 1 - min(s["conceded"] / apps / GK_CONCEDED_PER_APP, 1)), discipline]
        if team_games:
            out.append(_metric("출전률", apps / team_games))
        return out
    return [_metric("골", s["goals"] / apps / FIELD_SCALE["goals"]), _metric("도움", s["assists"] / apps / FIELD_SCALE["assists"]),
            _metric("슈팅", s["shots"] / apps / FIELD_SCALE["shots"]),
            _metric("유효슈팅", s["shotsOnTarget"] / apps / FIELD_SCALE["shotsOnTarget"]),
            _metric("파울 획득", s["foulsSuffered"] / apps / FIELD_SCALE["foulsSuffered"]), discipline]


def strengths(player, limit=2, team_games=None):
    s = player.get("stats")
    if not s or s["appearances"] < STRENGTH_MIN_APPEARANCES:
        return []
    metrics = [m for m in radar(player, team_games) if m["value"] >= STRENGTH_THRESHOLD and m["label"] != "규율"]
    return [m["label"] for m in sorted(metrics, key=lambda m: -m["value"])[:limit]]


# 올 시즌 실적 백분위: 리그 전체(20개 구단) 같은 포지션 선수 중 출전당 값의 순위. 출전 3회 미만은 풀에서 뺀다.
SEASON_ROWS = {
    "field": [("골", "goals"), ("도움", "assists"), ("슈팅", "shots"), ("유효슈팅", "shotsOnTarget"), ("파울 획득", "foulsSuffered")],
    "goalkeeper": [("선방", "saves")],
}
_league_pool = {"at": 0.0, "data": None}


def _per_app(p, key):
    s = p["stats"]
    return s[key] / s["appearances"]


def league_pool():
    """{포지션: {키: 정렬된 출전당 값}} (포지션 = goalkeeper/defender/midfielder/attacker). 구단 로스터는 espn 캐시를 쓴다. 실패한 구단은 건너뛴다."""
    if _league_pool["data"] is not None and time.time() - _league_pool["at"] < 3600:
        return _league_pool["data"]
    pool = {pos: {k: [] for _, k in SEASON_ROWS["goalkeeper" if pos == "goalkeeper" else "field"]}
            for pos in ("goalkeeper", "defender", "midfielder", "attacker")}
    try:
        ids = [c["club"]["id"] for c in espn.clubs()]
    except Exception:
        ids = []
    for cid in ids:
        try:
            players = espn.roster(cid)["players"]
        except Exception:
            continue
        for p in players:
            if not p.get("stats") or p["stats"]["appearances"] < STRENGTH_MIN_APPEARANCES:
                continue
            if p["position"] not in pool:
                continue
            for _, key in SEASON_ROWS["goalkeeper" if p["position"] == "goalkeeper" else "field"]:
                pool[p["position"]][key].append(_per_app(p, key))
    for kind in pool.values():
        for v in kind.values():
            v.sort()
    _league_pool.update(at=time.time(), data=pool)
    return pool


def season_rows(player, pool):
    """[{label, key, total, perApp, pct}] — pct 는 리그 같은 포지션 선수 중 이 선수보다 낮거나 같은 비율(0~100). 풀이 15명 미만이면 pct=None."""
    s = player.get("stats")
    if not s or s["appearances"] <= 0:
        return []
    out = []
    for label, key in SEASON_ROWS["goalkeeper" if player["position"] == "goalkeeper" else "field"]:
        vals = pool.get(player["position"], {}).get(key, [])
        mine = _per_app(player, key)
        pct = None
        if s["appearances"] >= STRENGTH_MIN_APPEARANCES and len(vals) >= 15:
            pct = round(100 * sum(1 for v in vals if v <= mine) / len(vals))
        out.append({"label": label, "key": key, "total": s[key], "perApp": round(mine, 2), "pct": pct})
    return out


def top_contributors(players, limit=6):
    """공격 포인트(골+도움) 순, 동률이면 골 → 유효슈팅. 필드 플레이어만."""
    pool = [p for p in players if p["position"] != "goalkeeper" and p.get("stats") and p["stats"]["appearances"] > 0
            and p["stats"]["goals"] + p["stats"]["assists"] > 0]
    key = lambda p: (-(p["stats"]["goals"] + p["stats"]["assists"]), -p["stats"]["goals"], -p["stats"]["shotsOnTarget"])
    return sorted(pool, key=key)[:limit]


def fmt_day(iso):
    dt = datetime.strptime(iso, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).astimezone(KST)
    return "%d월 %d일 (%s) %02d:%02d" % (dt.month, dt.day, WEEKDAY_KO[dt.weekday()], dt.hour, dt.minute)


def data_report_checks(report):
    """Models2.swift DataReport.checks 와 같은 점검 항목."""
    label = "%d-%s" % (report["expectedSeason"], str(report["expectedSeason"] + 1)[-2:])
    out = []
    if report["seasonFound"]:
        out.append({"title": "%s 시즌" % label, "level": "ok", "detail": "출처 시즌 표기: %s" % (report["seasonName"] or "확인됨")})
    else:
        out.append({"title": "%s 시즌" % label, "level": "problem", "detail": "출처에서 해당 시즌을 찾지 못했습니다."})
    fc, sc = report["fixtureCount"], report["squadCount"]
    out.append({"title": "경기 일정", "detail": "%d경기 (정규 시즌 38경기 + 컵대회)" % fc,
                "level": "ok" if fc >= 38 else ("problem" if fc == 0 else "warning")})
    out.append({"title": "스쿼드", "detail": "%d명" % sc, "level": "ok" if sc >= 18 else ("problem" if sc == 0 else "warning")})
    if report["missingNumbers"] > 0:
        out.append({"title": "등번호", "level": "warning", "detail": "%d명의 번호가 없습니다." % report["missingNumbers"]})
    if report["nextMatchDate"]:
        out.append({"title": "다음 경기", "detail": fmt_day(report["nextMatchDate"]), "level": "ok"})
    out.append({"title": "제공되지 않는 항목", "level": "warning", "detail": " · ".join(UNAVAILABLE) + " (출처 한계, 임의 값으로 채우지 않음)"})
    for e in report["errors"]:
        out.append({"title": "오류", "detail": e, "level": "problem"})
    return out


# ---------------------------------------------------------------------------
# 서비스 (FootballService / NewsService 와 같은 이름)

def matches():
    return espn.schedule()


def match_detail(match_id):
    match = next((m for m in espn.schedule() if m["id"] == match_id), None)
    if not match:
        return None
    detail = espn.detail(match)
    for ev in detail["events"]:
        ev["icon"] = EVENT_ICONS.get(ev["kind"], "•")
    return detail


def _team_games():
    try:
        row = next((r for r in espn.standings() if r["club"]["id"] == TEAM_ID), None)
        return row["played"] if row else None
    except Exception:
        return None


def _club_name(club_id):
    try:
        return next((c["club"]["name"] for c in espn.clubs() if c["club"]["id"] == club_id), "")
    except Exception:
        return ""


def squad(club_id=TEAM_ID):
    # 감독은 ESPN 로스터의 coach 가 수년 전 값(예: 맨유 무리뉴)이라 쓰지 않고, Wikidata 의 현재 감독을 쓴다.
    data = espn.roster(club_id)
    # 신상(생년월일·키·국적)은 ESPN 이 동명이인과 섞이는 경우가 있어 Wikidata·수동 보정으로 교차 검증한다.
    players = wikidata.enrich(data["players"], club_id, _club_name(club_id))
    # 사진: 후보를 모아(수동 지정 > PL 공식 > Commons) photocache 가 실제로 내려받아 검증·저장한 것만 로컬 경로로 내보낸다.
    overrides = wikidata.load_overrides()
    manual = {int(k) for k, v in overrides.items() if "photo" in v}
    cands = {}
    for p in players:
        lst = []
        if p.get("photoURL"):
            lst.append({"url": p["photoURL"], "source": "manual" if p["id"] in manual else "commons", "credit": p.get("photoCredit")})
        cands[p["id"]] = lst
    for pid, extra in plphotos.candidates(players, club_id, keep=manual).items():
        cands[pid] = extra + cands.get(pid, [])
    data = dict(data, players=photocache.apply(players, cands))
    games = _team_games() if club_id == TEAM_ID else None
    try:
        eaid = {k: v["eaId"] for k, v in overrides.items() if isinstance(v, dict) and v.get("eaId")}
        data = dict(data, players=eafc.attach(data["players"], eaid))
    except Exception:
        data = dict(data, players=[dict(p, ratings=None) for p in data["players"]])
    pool = league_pool()
    players = [dict(p, radar=radar(p, games), strengths=strengths(p, team_games=games), season=season_rows(p, pool),
                    contribution=(p["stats"]["goals"] + p["stats"]["assists"]) if p["stats"] else 0) for p in data["players"]]
    top = [p["id"] for p in top_contributors(data["players"])]
    return {"clubID": club_id, "players": players, "topContributors": top, "coach": wikidata.head_coach(club_id, _club_name(club_id)), "season": data["season"]}


# ---------------------------------------------------------------------------
# 베스트 11 · 전술 (최근 리그 경기의 실제 선발 명단·경기 통계에서 계산)

TACTIC_MATCHES = 5
TACTIC_NOTES_FILE = Path(__file__).with_name("ios_tactics.json")
POSSESSION_HI, POSSESSION_LO = 55.0, 45.0
SHOTS_HI, CONCEDED_LO, SCORED_HI, PASS_HI = 15.0, 0.8, 2.0, 85.0


def pick_xi(samples):
    """samples(오래된 경기 → 최근 경기 순) → 주력 XI. 5경기에서 가장 많이 쓴 포메이션(동률이면 최근),
    그 포메이션 경기 중 선발 11명의 '선발 횟수' 합이 가장 큰 경기(동률이면 최근)의 실제 선발을 쓴다."""
    ok = [s for s in samples if s.get("formation") and len(s["starters"]) == 11 and all(p.get("grid") for p in s["starters"])]
    if not ok:
        return None
    starts = {}
    for s in samples:
        for p in s["starters"]:
            if p["id"] is not None:
                starts[p["id"]] = starts.get(p["id"], 0) + 1
    counts = {}
    for i, s in enumerate(ok):
        c = counts.setdefault(s["formation"], [0, i])
        c[0] += 1
        c[1] = i
    formation = max(counts, key=lambda f: tuple(counts[f]))
    cands = [(sum(starts.get(p["id"], 0) for p in s["starters"]), i, s) for i, s in enumerate(ok) if s["formation"] == formation]
    _, _, best = max(cands, key=lambda t: (t[0], t[1]))
    xi = [dict(p, starts=starts.get(p["id"], 0)) for p in best["starters"]]
    return {"formation": formation, "formationCounts": {f: c[0] for f, c in sorted(counts.items(), key=lambda kv: -kv[1][0])},
            "xi": xi, "matchID": best.get("matchID")}


def _avg(values):
    values = [v for v in values if v is not None]
    return round(sum(values) / len(values), 1) if values else None


def tactical_profile(samples):
    """경기 통계 평균과 성향 태그. 통계가 없는 항목은 None(만들어 내지 않는다)."""
    stat = lambda key: _avg(s["stats"].get(key) for s in samples)
    prof = {"matches": len(samples), "possession": stat("점유율"), "shots": stat("슈팅"), "shotsOnTarget": stat("유효슈팅"),
            "passPct": stat("패스 성공률"), "tackles": stat("태클"), "fouls": stat("파울"), "corners": stat("코너킥"),
            "scored": _avg(s["goalsFor"] for s in samples), "conceded": _avg(s["goalsAgainst"] for s in samples)}
    tags = []
    if prof["possession"] is not None:
        if prof["possession"] >= POSSESSION_HI:
            tags.append("점유 지향")
        elif prof["possession"] <= POSSESSION_LO:
            tags.append("역습·직선적")
    if prof["shots"] is not None and prof["shots"] >= SHOTS_HI:
        tags.append("슈팅 많음")
    if prof["passPct"] is not None and prof["passPct"] >= PASS_HI:
        tags.append("패스 정교")
    if prof["scored"] is not None and prof["scored"] >= SCORED_HI:
        tags.append("다득점")
    if prof["conceded"] is not None and prof["conceded"] <= CONCEDED_LO:
        tags.append("단단한 수비")
    prof["tags"] = tags
    return prof


def profile_sentences(formation, counts, prof):
    """프로필 수치만으로 만든 설명 문장(해설 파일이 없는 구단용)."""
    out = []
    if formation:
        total = sum(counts.values()) or 1
        out.append("최근 %d경기 중 %d경기에서 %s 포메이션을 썼습니다." % (total, counts.get(formation, 0), formation))
    p = prof
    if p["possession"] is not None:
        style = "공을 오래 소유하며 경기를 주도하는 편입니다." if p["possession"] >= POSSESSION_HI else (
            "점유를 내주고 빠르게 전환하는 편입니다." if p["possession"] <= POSSESSION_LO else "상대와 비슷한 균형형입니다.")
        out.append("평균 점유율 %.1f%% — %s" % (p["possession"], style))
    if p["shots"] is not None and p["shotsOnTarget"] is not None:
        out.append("경기당 슈팅 %.1f개(유효 %.1f개)를 시도합니다." % (p["shots"], p["shotsOnTarget"]))
    if p["scored"] is not None and p["conceded"] is not None:
        out.append("경기당 %.1f득점·%.1f실점입니다." % (p["scored"], p["conceded"]))
    return out


def _norm_name(s):
    return "".join(c for c in unicodedata.normalize("NFKD", s or "") if not unicodedata.combining(c)).casefold().strip()


def tactic_notes(club_id, coach, path=None):
    """직접 쓴 전술 해설. 해설을 쓴 감독이 현재 감독과 같을 때만 보여 준다(감독이 바뀌면 낡은 해설이므로 숨김)."""
    try:
        data = json.loads((path or TACTIC_NOTES_FILE).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None, False
    note = data.get(str(club_id))
    if not isinstance(note, dict):
        return None, False
    if coach and _norm_name(note.get("coach")) == _norm_name(coach):
        return note, False
    return None, bool(coach)          # 감독을 확인할 수 없으면(None) 해설도 내지 않는다


def _sample(match, club_id):
    d = espn.detail(match)
    side = "home" if match["home"]["id"] == club_id else "away"
    lu = next((x for x in d["lineups"] if x["homeAway"] == side), None)
    if not lu:
        return None
    mine, theirs = (match["homeGoals"], match["awayGoals"]) if side == "home" else (match["awayGoals"], match["homeGoals"])
    opp = match["away"] if side == "home" else match["home"]
    return {"matchID": match["id"], "kickoff": match["kickoff"], "opponent": opp["shortName"], "formation": lu["formation"],
            "starters": lu["starters"], "goalsFor": mine, "goalsAgainst": theirs,
            "stats": {s["label"]: s[side] for s in d["stats"]}}


def tactics(club_id=TEAM_ID):
    done = [m for m in espn.schedule(club_id) if m["phase"] == "finished"][-TACTIC_MATCHES:]
    samples = []
    for m in done:
        try:
            s = _sample(m, club_id)
        except Exception:
            s = None
        if s:
            samples.append(s)
    if not samples:
        raise RuntimeError("최근 경기 라인업을 찾지 못했습니다.")
    picked = pick_xi(samples)
    prof = tactical_profile(samples)
    coach = wikidata.head_coach(club_id, _club_name(club_id))
    notes, stale = tactic_notes(club_id, coach)
    formation = picked["formation"] if picked else None
    counts = picked["formationCounts"] if picked else {}
    return {"clubID": club_id, "formation": formation, "formationCounts": counts, "xi": picked["xi"] if picked else [],
            "xiMatchID": picked["matchID"] if picked else None, "coach": coach, "profile": prof,
            "summary": profile_sentences(formation, counts, prof), "notes": notes, "notesStale": stale,
            "matchesUsed": [{"id": s["matchID"], "opponent": s["opponent"], "kickoff": s["kickoff"]} for s in samples]}


def clubs():
    return espn.clubs()


def standings():
    return espn.standings()


def news():
    now = time.time()
    with _news_lock:
        if _news["items"] is not None and now - _news["at"] < NEWS_TTL:
            return _news["items"]
        stale = _news["items"]
    try:
        req = urllib.request.Request(NEWS_FEED, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=12) as res:
            items = parse_rss(res.read())
    except Exception:
        if stale is not None:
            return stale
        raise
    with _news_lock:
        _news.update(at=now, items=items)
    return items


def parse_rss(data):
    out = []
    for item in ET.fromstring(data).iter("item"):
        text = lambda tag: (item.findtext(tag) or "").strip()
        date = None
        try:
            date = parsedate_to_datetime(text("pubDate")).astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        except (TypeError, ValueError):
            pass
        thumb = next((e.get("url") for e in item if e.tag.endswith("thumbnail")), None)
        out.append({"id": text("guid") or text("link"), "title": text("title"), "summary": text("description"),
                    "link": text("link") or None, "date": date, "imageURL": thumb})
    out.sort(key=lambda n: n["date"] or "", reverse=True)
    return out[:30]


def bio_audit(players=None):
    """신상 보정 현황: 자동·수동 보정된 선수, ESPN 과 값이 달랐던 항목, 교차 확인이 안 된 선수."""
    players = players if players is not None else squad()["players"]
    fixed = [p for p in players if p.get("bioSource") in ("wikidata", "override")]
    disputed = [{"name": p["name"], "fields": sorted(p["bioDisputed"])} for p in players if p.get("bioDisputed")]
    unverified = [p["name"] for p in players if not p.get("bioVerified")]
    return {"total": len(players), "corrected": len(fixed), "disputed": disputed, "unverified": unverified,
            "pending": sum(1 for p in players if p.get("bioPending"))}


def stats_crosscheck(players=None):
    """로스터의 골·도움·경고 누계를 지난 경기 요약(keyEvents)을 직접 집계한 값과 대조한다."""
    players = players if players is not None else espn.roster()["players"]
    goals, assists, yellow = {}, {}, {}
    played = [m for m in espn.schedule() if m["phase"] == "finished"]
    for m in played:
        for ev in espn.detail(m)["events"]:
            if ev["clubID"] != TEAM_ID:
                continue
            if ev["kind"] == "goal":
                goals[ev["player"]] = goals.get(ev["player"], 0) + 1
                if ev["assist"]:
                    assists[ev["assist"]] = assists.get(ev["assist"], 0) + 1
            elif ev["kind"] == "yellow":
                yellow[ev["player"]] = yellow.get(ev["player"], 0) + 1
    bad = []
    for p in players:
        st = p.get("stats")
        if not st:
            continue
        have = (st["goals"], st["assists"], st["yellow"])
        want = (goals.get(p["name"], 0), assists.get(p["name"], 0), yellow.get(p["name"], 0))
        if have != want:
            bad.append({"name": p["name"], "roster": list(have), "events": list(want)})
    return {"matches": len(played), "mismatch": bad}


def diagnostics():
    errors, all_matches, players, season = [], [], [], ""
    try:
        all_matches = espn.schedule()
        season = espn.season_label()
    except Exception as exc:
        errors.append("일정을 불러오지 못했습니다: %s" % str(exc)[:120])
    try:
        players = espn.roster()["players"]
    except Exception as exc:
        errors.append("스쿼드를 불러오지 못했습니다: %s" % str(exc)[:120])
    nxt = next_match(all_matches)
    stamp = espn.fetched_at()
    report = {"checkedAt": _iso_now(), "expectedSeason": SEASON, "seasonFound": str(SEASON) in season, "seasonName": season,
              "source": "ESPN 공개 API", "fixtureCount": len(all_matches), "squadCount": len(players),
              "missingNumbers": sum(1 for p in players if p["number"] is None),
              "missingPhotos": len(players), "nextMatchDate": nxt["kickoff"] if nxt else None, "errors": errors,
              "fetchedAt": datetime.fromtimestamp(stamp, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if stamp else None,
              "unavailable": UNAVAILABLE}
    report["checks"] = data_report_checks(report)
    try:
        audit = bio_audit()
        report["bio"] = audit
        sq = squad()["players"]
        with_photo = [p for p in sq if p.get("photoURL")]
        by = {}
        for p in with_photo:
            by[p.get("photoSource") or "commons"] = by.get(p.get("photoSource") or "commons", 0) + 1
        report["missingPhotos"] = len(sq) - len(with_photo)
        names = {"premierleague": "프리미어리그 공식", "commons": "Wikimedia Commons"}
        report["checks"].append({"title": "선수 사진", "level": "ok" if len(with_photo) == len(sq) else "warning",
            "detail": "%d/%d명 (%s). 없는 선수는 이니셜로 표시합니다. 공식 사진은 개인 로컬 열람용입니다." % (
                len(with_photo), len(sq), " · ".join("%s %d" % (names.get(k, k), v) for k, v in by.items()) or "없음")})
        try:
            pl = plphotos.discover_clubs()
            unmapped = [c["club"]["name"] for c in espn.clubs()
                        if plphotos.club_id_for([c["club"]["name"], c["club"].get("shortName")], pl) is None]
            total = len(espn.clubs())
            report["checks"].append({"title": "타 구단 사진 지원", "level": "ok" if not unmapped else "warning",
                "detail": "%d/%d개 구단 연결%s" % (total - len(unmapped), total,
                    (" · 아직 못 찾은 구단: " + ", ".join(unmapped) + " (탐색 중이거나 PL 사이트 요청 제한 — 잠시 후 다시)") if unmapped else "")})
        except Exception:
            pass
        lvl = "ok" if not audit["disputed"] else "warning"
        names = ", ".join(d["name"] for d in audit["disputed"])
        report["checks"].append({"title": "선수 신상 교차 검증", "level": lvl,
            "detail": "%d명 중 %d명 보정%s. 교차 확인 불가 %d명(ESPN 값 그대로)." % (
                audit["total"], audit["corrected"], (" · ESPN 값이 달랐던 선수: " + names) if names else "", len(audit["unverified"]))})
        if audit["pending"]:
            report["checks"].append({"title": "신상 보정 진행 중", "level": "warning", "detail": "%d명 확인 중 — 잠시 후 점검을 다시 실행하세요." % audit["pending"]})
    except Exception as exc:
        report["checks"].append({"title": "선수 신상 교차 검증", "level": "warning", "detail": "실행하지 못했습니다: %s" % str(exc)[:100]})
    try:
        cc = stats_crosscheck(players)
        bad = cc["mismatch"]
        report["checks"].append({"title": "시즌 기록 대조", "level": "ok" if not bad else "problem",
            "detail": ("지난 %d경기 요약의 골·도움·경고와 로스터 누계가 모두 일치합니다." % cc["matches"]) if not bad
            else "%d명 불일치: %s" % (len(bad), ", ".join(b["name"] for b in bad[:5]))})
    except Exception as exc:
        report["checks"].append({"title": "시즌 기록 대조", "level": "warning", "detail": "실행하지 못했습니다: %s" % str(exc)[:100]})
    return report


def overview():
    all_matches = espn.schedule()
    recent = recent_results(all_matches)
    table = []
    try:
        table = espn.standings()
    except Exception:
        pass
    me = next((r for r in table if r["club"]["id"] == TEAM_ID), None)
    return {"teamID": TEAM_ID, "season": SEASON, "seasonName": espn.season_label(), "next": next_match(all_matches),
            "recent": [dict(m, result=match_result(m)) for m in recent], "form": [match_result(m) for m in recent],
            "standing": me, "source": "ESPN"}


def warm(passes=4, pause=15, rest=600):
    """서버 시작 뒤 20개 구단 스쿼드를 천천히 한 번씩 불러, 신상 교차 검증·사진 후보 수집·사진 다운로드를 미리 채운다.
    요청은 직렬·간격을 두어 외부 사이트(Wikidata·Commons·PL)에 부담을 주지 않는다. 몇 번 반복해 캐시를 이어서 채운다."""
    for n in range(passes):
        try:
            ids = [c["club"]["id"] for c in espn.clubs()]
        except Exception:
            ids = []
        for cid in ids:
            try:
                squad(cid)
            except Exception:
                pass
            try:
                tactics(cid)
            except Exception:
                pass
            time.sleep(pause)
        if n < passes - 1:
            time.sleep(rest)

"""iOS 앱(~/ios_everton)의 서비스 로직과 샘플 데이터를 옮긴 것.

앱이 API 키 없이 보여 주는 `Sample.swift` 와 같은 데이터를, 같은 규칙(`Metrics.swift`, `Formatting.swift`,
`Models.swift`, `Models2.swift`)으로 가공해 JSON 으로 돌려준다. 실제 기록이 아니다.
필드 이름은 Swift 모델(camelCase)을 따른다.
"""
from datetime import datetime, timedelta, timezone

TEAM_ID = 45
LEAGUE_ID = 39
SEASON = 2026
DAY = timedelta(days=1)
KST = timezone(timedelta(hours=9))
WEEKDAY_KO = "월화수목금토일"

POSITIONS = {
    "goalkeeper": {"short": "GK", "title": "골키퍼"},
    "defender": {"short": "DF", "title": "수비수"},
    "midfielder": {"short": "MF", "title": "미드필더"},
    "attacker": {"short": "FW", "title": "공격수"},
}
EVENT_ICONS = {"goal": "⚽️", "ownGoal": "🥅", "missedPenalty": "❌", "yellow": "🟨", "red": "🟥",
               "substitution": "🔁", "var_": "📺", "other": "•"}


def _iso(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def logo(club_id):
    return "https://media.api-sports.io/football/teams/%d.png" % club_id


def club(club_id, name):
    return {"id": club_id, "name": name, "logoURL": logo(club_id)}


EVERTON = club(45, "Everton")
OPPONENTS = [club(52, "Crystal Palace"), club(40, "Liverpool"), club(66, "Aston Villa"), club(47, "Tottenham"),
             club(50, "Manchester City"), club(34, "Newcastle"), club(33, "Manchester United"), club(42, "Arsenal")]


# ---------------------------------------------------------------------------
# 샘플 데이터 (Sample.swift)

def sample_matches(now=None):
    now = now or datetime.now(timezone.utc)
    scores = [(2, 1), (0, 0), (1, 2), (3, 1), (1, 0)]
    out = []
    for i, (hs, as_) in enumerate(scores):
        home = i % 2 == 0
        other = OPPONENTS[i]
        out.append({
            "id": 100 + i, "kickoff": _iso(now - DAY * 7 * (len(scores) - i)), "competition": "Premier League",
            "round": "Regular Season - %d" % (i + 1), "venue": "Hill Dickinson Stadium",
            "home": EVERTON if home else other, "away": other if home else EVERTON,
            "homeGoals": hs if home else as_, "awayGoals": as_ if home else hs,
            "phase": "finished", "statusText": "Match Finished", "elapsed": 90})
    for i in range(4):
        home = i % 2 == 1
        other = OPPONENTS[(i + 5) % len(OPPONENTS)]
        out.append({
            "id": 200 + i, "kickoff": _iso(now + DAY * (3 + 7 * i)), "competition": "Premier League",
            "round": "Regular Season - %d" % (i + 6), "venue": "Hill Dickinson Stadium",
            "home": EVERTON if home else other, "away": other if home else EVERTON,
            "homeGoals": None, "awayGoals": None, "phase": "upcoming", "statusText": "Not Started", "elapsed": None})
    return out


def _player(pid, name, number, position, age, rating, g=0, a=0):
    gk = position == "goalkeeper"
    return {
        "id": pid, "name": name, "number": number, "position": position, "age": age, "nationality": "England",
        "photoURL": None, "heightCM": None, "weightKG": None, "birthDate": None, "birthPlace": None,
        "stats": {"appearances": 10, "minutes": 860, "rating": rating, "goals": g, "assists": a,
                  "shots": 14 + g * 3, "shotsOnTarget": 6 + g, "passes": 410, "keyPasses": 9 + a,
                  "passAccuracy": 78, "tackles": 21, "dribbles": 12, "yellow": 1, "red": 0,
                  "saves": 31 if gk else 0, "conceded": 9 if gk else 0}}


PLAYERS = [
    _player(1, "J. Pickford", 1, "goalkeeper", 32, 7.1),
    _player(2, "J. Tarkowski", 6, "defender", 33, 6.9),
    _player(3, "J. Branthwaite", 32, "defender", 24, 7.0),
    _player(4, "V. Mykolenko", 16, "defender", 27, 6.8),
    _player(5, "J. Garner", 37, "midfielder", 25, 7.2, a=2),
    _player(6, "K. Dewsbury-Hall", 22, "midfielder", 27, 7.0, g=1, a=3),
    _player(7, "I. Ndiaye", 10, "attacker", 26, 7.4, g=4, a=1),
    _player(8, "T. Barry", 11, "attacker", 33, 6.7, g=3),
]

FORMATION = ["1:1", "2:1", "2:2", "2:3", "2:4", "3:1", "3:2", "3:3", "4:1", "4:2", "4:3"]


def sample_detail(match):
    stats = [("점유율", 54, 46, True), ("슈팅", 13, 9, False), ("유효슈팅", 6, 3, False),
             ("코너킥", 5, 4, False), ("파울", 10, 12, False)]
    starters = [{"id": p["id"], "name": p["name"], "number": p["number"], "position": POSITIONS[p["position"]]["short"],
                 "grid": FORMATION[i], "rating": p["stats"]["rating"], "photoURL": None} for i, p in enumerate(PLAYERS)]
    return {
        "match": match,
        "stats": [{"label": l, "home": h, "away": a, "isPercent": pct} for l, h, a, pct in stats],
        "lineups": [{"club": EVERTON, "formation": "4-3-3", "starters": starters, "substitutes": []}],
        "events": sample_events(match)}


def sample_events(match):
    h, a = match.get("homeGoals"), match.get("awayGoals")
    if h is None or a is None:
        return []
    events, eid = [], 1
    for i in range(h):
        events.append({"id": eid, "minute": 12 + i * 31, "extra": None, "clubID": match["home"]["id"],
                       "player": "샘플 선수", "assist": None, "kind": "goal"}); eid += 1
    for i in range(a):
        events.append({"id": eid, "minute": 27 + i * 33, "extra": None, "clubID": match["away"]["id"],
                       "player": "샘플 선수", "assist": None, "kind": "goal"}); eid += 1
    events.append({"id": eid, "minute": 58, "extra": None, "clubID": match["home"]["id"],
                   "player": "샘플 선수", "assist": None, "kind": "yellow"})
    events.sort(key=lambda e: e["minute"])
    for e in events:
        e["icon"] = EVENT_ICONS[e["kind"]]
    return events


def sample_standings():
    names = [(42, "Arsenal"), (50, "Manchester City"), (40, "Liverpool"), (33, "Manchester United"),
             (34, "Newcastle"), (47, "Tottenham"), (45, "Everton"), (66, "Aston Villa"), (52, "Crystal Palace")]
    rows = []
    for i, (cid, name) in enumerate(names):
        note = "Promotion - Champions League (League phase)" if i < 4 else ("Relegation - Championship" if i > 7 else None)
        rows.append({"rank": i + 1, "club": club(cid, name), "played": 12, "won": 9 - i, "drawn": 2, "lost": i,
                     "goalsFor": 24 - i, "goalsAgainst": 10 + i, "points": 29 - i * 2, "form": "WDWLW", "note": note})
    for r in rows:
        r["goalDifference"] = r["goalsFor"] - r["goalsAgainst"]
        r["zone"] = standing_zone(r["note"])
    return rows


def sample_clubs():
    data = [(45, "Everton", 1878, "Hill Dickinson Stadium", 52888), (42, "Arsenal", 1886, "Emirates Stadium", 60704),
            (40, "Liverpool", 1892, "Anfield", 61276), (50, "Manchester City", 1880, "Etihad Stadium", 53400),
            (33, "Manchester United", 1878, "Old Trafford", 74310),
            (47, "Tottenham", 1882, "Tottenham Hotspur Stadium", 62850),
            (34, "Newcastle", 1892, "St. James' Park", 52257), (66, "Aston Villa", 1874, "Villa Park", 42657)]
    return [{"club": club(cid, name), "code": None, "country": "England", "founded": founded, "venueName": venue,
             "city": None, "capacity": cap, "venueImageURL": None} for cid, name, founded, venue, cap in data]


def sample_news(now=None):
    now = now or datetime.now(timezone.utc)
    return [
        {"id": "s1", "title": "Everton make strong start to the new season",
         "summary": "The Blues have picked up momentum after a solid run of results at home.",
         "link": None, "date": _iso(now), "imageURL": None},
        {"id": "s2", "title": "Team news ahead of the weekend fixture",
         "summary": "The manager gives an update on injuries and the likely starting eleven.",
         "link": None, "date": _iso(now - DAY), "imageURL": None}]


# ---------------------------------------------------------------------------
# 도메인 규칙

def match_result(match, team_id=TEAM_ID):
    """Models.swift Match.result — 끝난 경기만 W/D/L."""
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
    now_iso = _iso(now or datetime.now(timezone.utc))
    cand = [m for m in matches if m["phase"] == "live" or (m["phase"] == "upcoming" and m["kickoff"] >= now_iso)]
    return min(cand, key=lambda m: m["kickoff"]) if cand else None


def _metric(label, value):
    return {"label": label, "value": min(max(value, 0.0), 1.0)}


def radar(player):
    """Metrics.swift PlayerMetrics.radar — 6개 지표(0~1). 스탯이 없으면 빈 배열."""
    s = player.get("stats")
    if not s:
        return []
    games = max(s["minutes"] / 90, 1)
    if player["position"] == "goalkeeper":
        faced = s["saves"] + s["conceded"]
        save_rate = s["saves"] / faced if faced > 0 else 0
        cards = s["yellow"] + 3 * s["red"]
        return [_metric("선방률", save_rate), _metric("패스", s["passAccuracy"] / 100),
                _metric("출전", s["appearances"] / 38), _metric("시간", s["minutes"] / (38 * 90)),
                _metric("페어플레이", 1 - min(cards / 6, 1)), _metric("평점", ((s["rating"] or 6) - 5) / 4)]
    return [_metric("슈팅", s["shots"] / games / 4), _metric("유효슈팅", s["shotsOnTarget"] / games / 2),
            _metric("키패스", s["keyPasses"] / games / 3), _metric("드리블", s["dribbles"] / games / 3),
            _metric("태클", s["tackles"] / games / 4), _metric("패스", s["passAccuracy"] / 100)]


def strengths(player, limit=2):
    s = player.get("stats")
    if not s or s["minutes"] < 180:
        return []
    metrics = [m for m in radar(player) if m["value"] >= 0.35]
    return [m["label"] for m in sorted(metrics, key=lambda m: -m["value"])[:limit]]


def top_rated(players, limit=6, min_appearances=3):
    rated = [p for p in players if ((p.get("stats") or {}).get("rating") or 0) > 0]
    regulars = [p for p in rated if p["stats"]["appearances"] >= min_appearances]
    pool = regulars or rated
    return sorted(pool, key=lambda p: -p["stats"]["rating"])[:limit]


def standing_zone(note):
    text = (note or "").lower()
    if "relegation" in text:
        return "relegation"
    if "champions" in text:
        return "champions"
    if "europa league" in text:
        return "europa"
    if "conference" in text:
        return "conference"
    return "none"


def fmt_day(iso):
    dt = datetime.strptime(iso, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc).astimezone(KST)
    return "%d월 %d일 (%s) %02d:%02d" % (dt.month, dt.day, WEEKDAY_KO[dt.weekday()], dt.hour, dt.minute)


def data_report_checks(report):
    """Models2.swift DataReport.checks."""
    label = "%d-%s" % (report["expectedSeason"], str(report["expectedSeason"] + 1)[-2:])
    out = []
    if report["seasonFound"]:
        years = " ~ ".join(x[:4] for x in (report["seasonStart"], report["seasonEnd"]) if x)
        out.append({"title": "%s 시즌" % label, "detail": ("API 시즌 기간 " + years) if years else "API 에서 확인됨", "level": "ok"})
    else:
        out.append({"title": "%s 시즌" % label, "level": "problem",
                    "detail": "API 에서 찾지 못했습니다. 무료 플랜의 시즌 제한이거나 아직 등록되지 않았을 수 있습니다."})
    fc, sc = report["fixtureCount"], report["squadCount"]
    out.append({"title": "경기 일정", "detail": "%d경기 (정규 시즌 38경기 + 컵대회)" % fc,
                "level": "ok" if fc >= 38 else ("problem" if fc == 0 else "warning")})
    out.append({"title": "스쿼드", "detail": "%d명" % sc,
                "level": "ok" if sc >= 18 else ("problem" if sc == 0 else "warning")})
    if report["missingNumbers"] > 0:
        out.append({"title": "등번호", "level": "warning",
                    "detail": "%d명의 번호가 없습니다 (API 반영 지연일 수 있음)." % report["missingNumbers"]})
    if report["missingPhotos"] > 0:
        out.append({"title": "선수 사진", "level": "warning", "detail": "%d명의 사진이 없습니다." % report["missingPhotos"]})
    if report["nextMatchDate"]:
        out.append({"title": "다음 경기", "detail": fmt_day(report["nextMatchDate"]), "level": "ok"})
    for e in report["errors"]:
        out.append({"title": "오류", "detail": e, "level": "problem"})
    return out


# ---------------------------------------------------------------------------
# 서비스 (FootballService / NewsService 와 같은 이름)

def matches():
    return sample_matches()


def match_detail(match_id):
    match = next((m for m in sample_matches() if m["id"] == match_id), None)
    return sample_detail(match) if match else None


def squad(club_id=TEAM_ID):
    players = [dict(p, shortName=p["name"].split(" ")[-1], radar=radar(p), strengths=strengths(p)) for p in PLAYERS]
    return {"clubID": club_id, "players": players, "topRated": [p["id"] for p in top_rated(PLAYERS)]}


def clubs():
    return sample_clubs()


def standings():
    return sample_standings()


def news():
    return sample_news()


def diagnostics():
    all_matches = sample_matches()
    nxt = next_match(all_matches)
    report = {"checkedAt": _iso(datetime.now(timezone.utc)), "expectedSeason": SEASON, "seasonFound": True,
              "seasonStart": "2026-08-15", "seasonEnd": "2027-05-30", "fixtureCount": len(all_matches),
              "squadCount": len(PLAYERS), "missingNumbers": 0,
              "missingPhotos": sum(1 for p in PLAYERS if not p["photoURL"]),
              "nextMatchDate": nxt["kickoff"] if nxt else None,
              "errors": ["샘플 데이터입니다. API 키를 설정하면 실제 점검 결과가 표시됩니다."]}
    report["checks"] = data_report_checks(report)
    return report


def overview():
    """홈 화면 한 번에: 다음 경기, 최근 5경기 폼, 평점 TOP (앱 HomeView 가 모델에서 계산하는 값)."""
    all_matches = sample_matches()
    recent = recent_results(all_matches)
    return {"teamID": TEAM_ID, "season": SEASON, "next": next_match(all_matches),
            "recent": [dict(m, result=match_result(m)) for m in recent],
            "form": [match_result(m) for m in recent], "isSample": True}

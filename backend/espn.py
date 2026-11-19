"""ESPN 공개 API(키 불필요)에서 프리미어리그 데이터를 읽어 iOS 앱 모델 모양으로 바꾼다.

비공식 API 라서 형식이 바뀔 수 있다 → 캐시, 오래된 캐시 폴백, 항목 단위 파싱 실패 무시.
ESPN 이 주지 않는 값(평점, 패스·태클·드리블, 선수 사진, 창단연도·수용 인원)은 만들지 않고 None 으로 둔다.
"""
import json
import threading
import time
import urllib.request

SITE = "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1"
V2 = "https://site.api.espn.com/apis/v2/sports/soccer/eng.1"
TEAM_ID = 368           # Everton (ESPN id)
LEAGUE_NAME = "Premier League"
TTL = {"schedule": 600, "standings": 600, "teams": 6 * 3600, "roster": 3600, "summary_done": 86400, "summary_live": 60}
_cache = {}
_lock = threading.Lock()


def _get(url, ttl):
    """JSON 을 받아 온다. 신선한 캐시가 있으면 그것을, 실패하면 오래된 캐시를 쓴다."""
    now = time.time()
    with _lock:
        hit = _cache.get(url)
    if hit and now - hit[0] < ttl:
        return hit[1]
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=12) as res:
            data = json.load(res)
    except Exception:
        if hit:
            return hit[1]
        raise
    with _lock:
        _cache[url] = (now, data)
    return data


def fetched_at(url_part=""):
    with _lock:
        stamps = [t for u, (t, _) in _cache.items() if url_part in u]
    return max(stamps) if stamps else None


# ---------------------------------------------------------------------------
# 공통 변환

POS = {"G": "goalkeeper", "D": "defender", "M": "midfielder", "F": "attacker"}


def _logo(team):
    logos = team.get("logos") or []
    return (logos[0] or {}).get("href") if logos else team.get("logo")


def club_of(team):
    return {"id": int(team["id"]), "name": team.get("displayName") or team.get("name") or "?",
            "shortName": team.get("shortDisplayName") or team.get("displayName") or "?",
            "code": team.get("abbreviation"), "logoURL": _logo(team)}


def _num(value, default=None):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _int(value):
    n = _num(value)
    return int(n) if n is not None else None


# ---------------------------------------------------------------------------
# 일정 → Match

def parse_match(event):
    comp = (event.get("competitions") or [{}])[0]
    sides = {c.get("homeAway"): c for c in comp.get("competitors", [])}
    if "home" not in sides or "away" not in sides:
        return None
    status = (comp.get("status") or event.get("status") or {}).get("type", {})
    state = status.get("state", "pre")

    def score(c):
        s = c.get("score")
        return _int(s.get("displayValue") if isinstance(s, dict) else s)

    phase = {"pre": "upcoming", "in": "live", "post": "finished"}.get(state, "other")
    hg, ag = (score(sides["home"]), score(sides["away"])) if phase != "upcoming" else (None, None)
    return {
        "id": int(event["id"]), "kickoff": event["date"].replace("Z", ":00Z") if len(event["date"]) == 17 else event["date"],
        "competition": LEAGUE_NAME, "round": "", "venue": (comp.get("venue") or {}).get("fullName"),
        "home": club_of(sides["home"]["team"]), "away": club_of(sides["away"]["team"]),
        "homeGoals": hg, "awayGoals": ag, "phase": phase,
        "statusText": status.get("description") or "", "elapsed": None}


def merge_schedule(past, upcoming):
    by_id = {}
    for payload in (past, upcoming):
        for event in (payload or {}).get("events", []):
            try:
                m = parse_match(event)
            except (KeyError, TypeError):
                m = None
            if m:
                by_id[m["id"]] = m
    return sorted(by_id.values(), key=lambda m: m["kickoff"])


def schedule(team_id=TEAM_ID):
    base = "%s/teams/%d/schedule" % (SITE, team_id)
    return merge_schedule(_get(base, TTL["schedule"]), _get(base + "?fixture=true", TTL["schedule"]))


def season_label(team_id=TEAM_ID):
    try:
        return (_get("%s/teams/%d/schedule" % (SITE, team_id), TTL["schedule"]).get("season") or {}).get("displayName") or ""
    except Exception:
        return ""


# ---------------------------------------------------------------------------
# 로스터 → Player

STAT_MAP = {"appearances": "appearances", "subIns": "subIns", "totalGoals": "goals", "goalAssists": "assists",
            "totalShots": "shots", "shotsOnTarget": "shotsOnTarget", "foulsCommitted": "foulsCommitted",
            "foulsSuffered": "foulsSuffered", "offsides": "offsides", "yellowCards": "yellow", "redCards": "red",
            "ownGoals": "ownGoals", "saves": "saves", "goalsConceded": "conceded", "shotsFaced": "shotsFaced"}


def parse_stats(athlete):
    cats = ((athlete.get("statistics") or {}).get("splits") or {}).get("categories") or []
    flat = {s["name"]: s.get("value") for c in cats for s in c.get("stats", []) if "name" in s}
    if not flat:
        return None
    return {mine: int(_num(flat.get(theirs), 0) or 0) for theirs, mine in STAT_MAP.items()}


def parse_player(a):
    pos = POS.get(((a.get("position") or {}).get("abbreviation") or "F")[:1].upper(), "attacker")
    height, weight = _num(a.get("height")), _num(a.get("weight"))
    born = (a.get("dateOfBirth") or "")[:10] or None
    place = a.get("birthPlace") or {}
    birth_place = ", ".join(x for x in (place.get("city"), place.get("state"), place.get("country")) if x) or None
    jersey = _int(a.get("jersey"))
    name = a.get("displayName") or a.get("fullName") or "?"
    return {
        "id": int(a["id"]), "name": name, "shortName": a.get("shortName") or name,
        "number": jersey, "position": pos, "age": _int(a.get("age")),
        "nationality": a.get("citizenship"), "flagURL": (a.get("flag") or {}).get("href"), "photoURL": None,
        "heightCM": round(height * 2.54) if height else None, "weightKG": round(weight * 0.45359) if weight else None,
        "birthDate": born, "birthPlace": birth_place, "stats": parse_stats(a)}


def parse_roster(payload):
    players = []
    for a in payload.get("athletes", []):
        try:
            players.append(parse_player(a))
        except (KeyError, TypeError, ValueError):
            continue
    order = {"goalkeeper": 0, "defender": 1, "midfielder": 2, "attacker": 3}
    players.sort(key=lambda p: (order[p["position"]], p["number"] if p["number"] is not None else 999))
    coach = payload.get("coach") or []
    return {"players": players, "coach": " ".join(x for x in (coach[0].get("firstName"), coach[0].get("lastName")) if x) if coach else None,
            "season": (payload.get("season") or {}).get("displayName") or ""}


def roster(team_id=TEAM_ID):
    return parse_roster(_get("%s/teams/%d/roster" % (SITE, team_id), TTL["roster"]))


# ---------------------------------------------------------------------------
# 구단·순위

def parse_teams(payload):
    teams = payload["sports"][0]["leagues"][0]["teams"]
    out = []
    for t in teams:
        team = t["team"]
        info = club_of(team)
        info["color"] = team.get("color")
        out.append({"club": {k: info[k] for k in ("id", "name", "shortName", "code", "logoURL")}, "color": info["color"],
                    "country": "England", "founded": None, "venueName": None, "city": None, "capacity": None})
    return sorted(out, key=lambda c: c["club"]["name"])


def clubs():
    return parse_teams(_get(SITE + "/teams", TTL["teams"]))


def standing_zone(note):
    text = (note or "").lower()
    if "relegation" in text:
        return "relegation"
    if "champions" in text:
        return "champions"
    if "europa" in text:
        return "europa"
    if "conference" in text:
        return "conference"
    return "none"


def parse_standings(payload):
    entries = payload["children"][0]["standings"]["entries"]
    rows = []
    for e in entries:
        s = {x["name"]: x.get("value") for x in e.get("stats", [])}
        note = (e.get("note") or {}).get("description")
        gf, ga = int(s.get("pointsFor") or 0), int(s.get("pointsAgainst") or 0)
        rows.append({"rank": int(s.get("rank") or 0), "club": club_of(e["team"]), "played": int(s.get("gamesPlayed") or 0),
                     "won": int(s.get("wins") or 0), "drawn": int(s.get("ties") or 0), "lost": int(s.get("losses") or 0),
                     "goalsFor": gf, "goalsAgainst": ga, "goalDifference": gf - ga, "points": int(s.get("points") or 0),
                     "note": note, "zone": standing_zone(note)})
    rows.sort(key=lambda r: r["rank"] or 99)
    return rows


def standings():
    return parse_standings(_get(V2 + "/standings", TTL["standings"]))


# ---------------------------------------------------------------------------
# 경기 요약 → MatchDetail

def _pct_scaled(v):
    return v * 100 if v is not None and v <= 1 else v


STAT_LINES = [("possessionPct", "점유율", True), ("totalShots", "슈팅", False), ("shotsOnTarget", "유효슈팅", False),
              ("wonCorners", "코너킥", False), ("foulsCommitted", "파울", False), ("offsides", "오프사이드", False),
              ("passPct", "패스 성공률", True), ("totalTackles", "태클", False), ("yellowCards", "경고", False),
              ("saves", "선방", False)]


def parse_team_stats(payload, home_id, away_id):
    by_team = {}
    for t in (payload.get("boxscore") or {}).get("teams", []):
        by_team[int(t["team"]["id"])] = {s["name"]: _num(s.get("displayValue")) for s in t.get("statistics", [])}
    h, a = by_team.get(home_id, {}), by_team.get(away_id, {})
    lines = []
    for key, label, pct in STAT_LINES:
        if key in h and key in a and h[key] is not None and a[key] is not None:
            hv, av = (_pct_scaled(h[key]), _pct_scaled(a[key])) if key == "passPct" else (h[key], a[key])
            lines.append({"label": label, "home": round(hv, 1) if pct else int(hv), "away": round(av, 1) if pct else int(av), "isPercent": pct})
    return lines


# 포지션 약어 → (세로 깊이, 가로 위치). 포메이션 숫자(4-2-3-1)로 줄을 나누고 줄 안은 가로 위치로 정렬한다.
def _depth(abbr):
    a = (abbr or "").upper()
    if a.startswith("G"):
        return 0.0
    if a in ("CD", "CD-L", "CD-R", "CB", "SW", "LB", "RB", "LWB", "RWB", "WB", "D"):
        return 1.0
    if a in ("DM", "CDM", "DM-L", "DM-R"):
        return 1.8
    if a in ("CM", "CM-L", "CM-R", "LM", "RM", "M"):
        return 2.4
    if a.startswith("AM") or a in ("LW", "RW", "W"):
        return 3.0
    return 4.0


def _side(abbr):
    a = (abbr or "").upper()
    if a in ("LB", "LWB", "LM", "LW"):
        return 0
    if a.endswith("-L"):
        return 1
    if a.endswith("-R"):
        return 3
    if a in ("RB", "RWB", "RM", "RW"):
        return 4
    return 2


def lay_out(formation, starters):
    """선발 11명 → {formationPlace: 'row:col'}. 1행은 골키퍼."""
    rows = [1]
    try:
        rows += [int(x) for x in (formation or "").split("-")]
    except ValueError:
        rows = []
    ordered = sorted(starters, key=lambda s: (_depth(s["position"]), _side(s["position"]), s["place"]))
    if sum(rows) != len(ordered):          # 포메이션 문자열을 믿을 수 없으면 깊이로 묶는다
        rows, last = [], None
        for s in ordered:
            d = _depth(s["position"])
            if d != last:
                rows.append(0)
                last = d
            rows[-1] += 1
    grid, i = {}, 0
    for r, n in enumerate(rows, start=1):
        for c in range(1, n + 1):
            grid[ordered[i]["place"]] = "%d:%d" % (r, c)
            i += 1
    return grid


def parse_lineups(payload):
    out = []
    for r in payload.get("rosters") or []:
        starters, subs = [], []
        for x in r.get("roster", []):
            ath = x.get("athlete") or {}
            entry = {"id": _int(ath.get("id")), "name": ath.get("displayName") or ath.get("fullName") or "?",
                     "number": _int(x.get("jersey")), "position": ((x.get("position") or {}).get("abbreviation")), "grid": None,
                     "rating": None, "photoURL": None, "place": _int(x.get("formationPlace")) or 0, "subbedOut": bool(x.get("subbedOut")),
                     "subbedIn": bool(x.get("subbedIn"))}
            (starters if x.get("starter") else subs).append(entry)
        grid = lay_out(r.get("formation"), starters) if len(starters) == 11 else {}
        for s in starters:
            s["grid"] = grid.get(s["place"])
        for e in starters + subs:
            e.pop("place", None)
        out.append({"homeAway": r.get("homeAway"), "club": club_of(r["team"]) if r.get("team") else None,
                    "formation": r.get("formation"), "starters": starters, "substitutes": subs})
    return out


def _minute(clock):
    text = (clock or "").replace("'", "")
    base, _, extra = text.partition("+")
    return _int(base) or 0, _int(extra)


def parse_events(payload):
    events = []
    for e in payload.get("keyEvents") or []:
        kind_text = ((e.get("type") or {}).get("type") or "").lower()
        label = ((e.get("type") or {}).get("text") or "").lower()
        if "own" in label and "goal" in label:
            kind = "ownGoal"
        elif kind_text.startswith("goal") or "penalty - scored" in label or "penalty---scored" in kind_text:
            kind = "goal"
        elif "yellow" in label:
            kind = "yellow"
        elif "red" in label:
            kind = "red"
        elif "missed" in label and "penalty" in label:
            kind = "missedPenalty"
        else:
            continue
        minute, extra = _minute((e.get("clock") or {}).get("displayValue"))
        people = [(p.get("athlete") or {}).get("displayName") for p in e.get("participants") or []]
        events.append({"id": _int(e.get("id")) or len(events), "minute": minute, "extra": extra,
                       "clubID": _int((e.get("team") or {}).get("id")) or 0, "player": people[0] if people else "-",
                       "assist": people[1] if len(people) > 1 and kind == "goal" else None, "kind": kind})
    events.sort(key=lambda x: (x["minute"], x["extra"] or 0))
    return events


def detail(match):
    live = match["phase"] == "live"
    payload = _get("%s/summary?event=%d" % (SITE, match["id"]), TTL["summary_live"] if live else TTL["summary_done"])
    lineups = parse_lineups(payload)
    return {"match": match, "stats": parse_team_stats(payload, match["home"]["id"], match["away"]["id"]),
            "lineups": lineups, "events": parse_events(payload)}

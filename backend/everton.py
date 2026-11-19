"""에버턴 다음 경기·최근 결과 (ESPN 공개 일정 API, 키 불필요). 팀 ID 만 외부로 나갑니다."""
import json
import threading
import time
import urllib.request

EVERTON_TTL = 600
TEAM_ID = "368"
BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/teams/%s/schedule" % TEAM_ID
_cache = {"at": 0.0, "data": None}
_lock = threading.Lock()


def _fetch(query=""):
    req = urllib.request.Request(BASE + query, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.load(res)


def _score(comp):
    s = comp.get("score")
    raw = s.get("displayValue") if isinstance(s, dict) else s
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _logo(team):
    logos = team.get("logos") or []
    return (logos[0] or {}).get("href") if logos else team.get("logo")


def parse_match(event):
    """일정 항목 하나를 에버턴 기준 경기 정보로 바꾼다. 에버턴이 없으면 None."""
    comp = (event.get("competitions") or [{}])[0]
    mine = next((c for c in comp.get("competitors", []) if str(c.get("team", {}).get("id")) == TEAM_ID), None)
    other = next((c for c in comp.get("competitors", []) if c is not mine), None)
    if not mine or not other:
        return None
    team = other.get("team", {})
    state = (comp.get("status") or event.get("status") or {}).get("type", {}).get("state", "pre")
    ours, theirs = _score(mine), _score(other)
    result = None
    if state == "post" and ours is not None and theirs is not None:
        result = "W" if ours > theirs else "L" if ours < theirs else "D"
    return {
        "kickoff": event.get("date"), "state": state,
        "home": mine.get("homeAway") == "home",
        "opponent": team.get("shortDisplayName") or team.get("displayName") or "?",
        "opponent_logo": _logo(team),
        "score": [ours, theirs] if ours is not None and theirs is not None else None,
        "result": result,
    }


def parse_everton(past, upcoming):
    """과거 일정(결과)과 예정 일정을 합쳐 다음 경기·진행 중 경기·최근 5경기를 만든다."""
    matches = {}
    for payload in (past, upcoming):
        for event in (payload or {}).get("events", []):
            m = parse_match(event)
            if m and m["kickoff"]:
                matches[m["kickoff"]] = m
    ordered = [matches[k] for k in sorted(matches)]
    done = [m for m in ordered if m["state"] == "post"]
    live = next((m for m in ordered if m["state"] == "in"), None)
    nxt = next((m for m in ordered if m["state"] == "pre"), None)
    return {"next": nxt, "live": live, "recent": done[-5:], "stale": False}


def everton_overview():
    now = time.time()
    with _lock:
        hit = dict(_cache)
    if hit["data"] and now - hit["at"] < EVERTON_TTL:
        return hit["data"]
    try:
        data = parse_everton(_fetch(), _fetch("?fixture=true"))
    except Exception:
        if hit["data"]:
            return dict(hit["data"], stale=True)
        return {"error": True, "next": None, "live": None, "recent": []}
    with _lock:
        _cache.update(at=now, data=data)
    return data

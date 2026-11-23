"""iOS 앱(~/ios_everton)의 서비스·계산 로직을 옮긴 것. 데이터는 ESPN 공개 API 실데이터(backend/espn.py).

필드 이름은 Swift 모델(camelCase)을 따른다. ESPN 이 주지 않는 값(평점, 패스·태클 등)은 None 이며(선수 사진은 Wikidata/Commons 에서 보강)
임의의 값으로 채우지 않는다. 가져오기에 실패하면 가짜 데이터 대신 오류를 돌려준다.
"""
import threading
import time
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

from backend import espn, photocache, plphotos, wikidata

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
    players = [dict(p, radar=radar(p, games), strengths=strengths(p, team_games=games),
                    contribution=(p["stats"]["goals"] + p["stats"]["assists"]) if p["stats"] else 0) for p in data["players"]]
    top = [p["id"] for p in top_contributors(data["players"])]
    return {"clubID": club_id, "players": players, "topContributors": top, "coach": wikidata.head_coach(club_id, _club_name(club_id)), "season": data["season"]}


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
            time.sleep(pause)
        if n < passes - 1:
            time.sleep(rest)

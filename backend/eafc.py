"""EA SPORTS FC 공식 선수 평가(drop-api.ea.com, 키 불필요)를 FM 식 능력치로 바꾼다.

원칙
- 값은 EA 원본(1~99)만 쓴다. FM 식 1~20 은 원본에서 `to20` 규칙으로 바꾼 표시용이며 원본도 함께 내보낸다.
- 선수 매칭은 (이름 정규화 일치 + 생년월일 일치)일 때만 인정한다. 애매하면 매칭하지 않고 "평가 없음"으로 둔다.
- 하루 디스크 캐시. 받기에 실패하면 마지막 성공값을 쓰고 받은 날짜(fetchedAt)를 그대로 보여 준다.
"""
import json
import os
import threading
import time
import unicodedata
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

API = "https://drop-api.ea.com/rating/ea-sports-fc"
TTL = 24 * 3600
DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "eafc")
_lock = threading.Lock()

# 능력치 그룹 (FM 의 기술·정신·신체). (EA 키, 한글 이름)
GROUPS = {
    "technical": ("기술", [("finishing", "결정력"), ("longShots", "중거리 슛"), ("shotPower", "슈팅 파워"), ("volleys", "발리"),
                         ("penalties", "페널티"), ("shortPassing", "짧은 패스"), ("longPassing", "긴 패스"), ("crossing", "크로스"),
                         ("curve", "커브"), ("freeKickAccuracy", "프리킥"), ("dribbling", "드리블"), ("ballControl", "볼 컨트롤"),
                         ("headingAccuracy", "헤딩"), ("standingTackle", "스탠딩 태클"), ("slidingTackle", "슬라이딩 태클")]),
    "mental": ("정신", [("composure", "침착성"), ("reactions", "반응"), ("positioning", "위치 선정"), ("vision", "시야"),
                      ("aggression", "적극성"), ("interceptions", "가로채기"), ("defensiveAwareness", "수비 인식")]),
    "physical": ("신체", [("acceleration", "가속"), ("sprintSpeed", "주력"), ("agility", "민첩성"), ("balance", "균형"),
                        ("jumping", "점프"), ("stamina", "체력"), ("strength", "몸싸움")]),
}
GK_GROUPS = {
    "goalkeeping": ("골키퍼", [("gkDiving", "다이빙"), ("gkHandling", "핸들링"), ("gkKicking", "킥"), ("gkPositioning", "위치 선정"),
                            ("gkReflexes", "반응")]),
    "mental": ("정신", [("composure", "침착성"), ("reactions", "반응"), ("aggression", "적극성"), ("shortPassing", "짧은 패스"),
                      ("longPassing", "긴 패스")]),
    "physical": GROUPS["physical"],
}

# EA 포지션 → 피치 좌표(x 0=왼쪽 · 1=오른쪽, y 0=상대 골문 · 1=우리 골문). 위에서 본 그림의 점 위치.
POS_XY = {
    "GK": (.5, .93), "RB": (.85, .72), "RWB": (.88, .6), "CB": (.5, .78), "LB": (.15, .72), "LWB": (.12, .6),
    "CDM": (.5, .62), "CM": (.5, .5), "CAM": (.5, .38), "RM": (.86, .48), "LM": (.14, .48),
    "RW": (.84, .28), "LW": (.16, .28), "CF": (.5, .22), "ST": (.5, .12),
}
POS_KO = {"GK": "골키퍼", "RB": "우측 풀백", "RWB": "우측 윙백", "CB": "센터백", "LB": "좌측 풀백", "LWB": "좌측 윙백", "CDM": "수비형 미드필더",
          "CM": "중앙 미드필더", "CAM": "공격형 미드필더", "RM": "우측 미드필더", "LM": "좌측 미드필더", "RW": "우측 윙어",
          "LW": "좌측 윙어", "CF": "세컨드 스트라이커", "ST": "스트라이커"}


def to20(v):
    """EA 1~99 → FM 식 1~20 (표시용). 원본은 항상 같이 보낸다."""
    return max(1, min(20, int(round(v / 5.0))))


_FOLD = str.maketrans({"ø": "o", "Ø": "O", "đ": "d", "Đ": "D", "ł": "l", "Ł": "L", "æ": "ae", "Æ": "AE", "ß": "ss", "ı": "i"})


def norm(s):
    return "".join(c for c in unicodedata.normalize("NFKD", (s or "").translate(_FOLD)) if not unicodedata.combining(c)).casefold().replace("-", " ").strip()


def _born(s):
    """EA '3/6/2000 12:00:00 AM' 또는 ISO → 'YYYY-MM-DD'."""
    if not s:
        return None
    s = str(s)
    for fmt in ("%m/%d/%Y %I:%M:%S %p", "%Y-%m-%d"):
        try:
            return datetime.strptime(s[:len(s)] if fmt.startswith("%m") else s[:10], fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _path(key):
    return os.path.join(DIR, key + ".json")


def _fetch(query):
    url = API + "?" + urllib.parse.urlencode(dict(query, locale="en", limit=50))
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as res:
        return json.load(res)["items"]


def search(term):
    """이름 검색 결과(항목 목록). 하루 디스크 캐시, 실패하면 오래된 캐시. 반환: (items, fetchedAt epoch) 또는 (None, None)."""
    key = "q_" + "".join(c if c.isalnum() else "_" for c in norm(term))
    path = _path(key)
    cached = None
    try:
        with open(path, encoding="utf-8") as fh:
            cached = json.load(fh)
    except (OSError, ValueError):
        pass
    if cached and time.time() - cached["at"] < TTL:
        return cached["items"], cached["at"]
    try:
        items = [slim(i) for i in _fetch({"search": term})]
    except Exception:
        return (cached["items"], cached["at"]) if cached else (None, None)
    with _lock:
        os.makedirs(DIR, exist_ok=True)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump({"at": time.time(), "items": items}, fh, ensure_ascii=False)
        os.replace(tmp, path)
    return items, time.time()


def slim(i):
    """EA 응답에서 필요한 값만 남긴다."""
    stats = {k: v["value"] for k, v in (i.get("stats") or {}).items() if isinstance(v, dict) and "value" in v}
    return {
        "id": i["id"], "first": i.get("firstName"), "last": i.get("lastName"), "common": i.get("commonName"),
        "born": _born(i.get("birthdate")), "overall": i.get("overallRating"), "team": (i.get("team") or {}).get("label"),
        "position": (i.get("position") or {}).get("shortLabel"),
        "alt": [p["shortLabel"] for p in i.get("alternatePositions") or [] if p.get("shortLabel")],
        "foot": "right" if i.get("preferredFoot") == 1 else "left" if i.get("preferredFoot") == 2 else None,
        "weakFoot": i.get("weakFootAbility"), "skillMoves": i.get("skillMoves"), "stats": stats,
        "abilities": [{"label": a.get("label"), "description": a.get("description"), "kind": (a.get("type") or {}).get("id")}
                      for a in i.get("playerAbilities") or []],
    }


def is_match(player, cand):
    """ESPN 선수와 EA 후보가 같은 사람인가. 생년월일이 같고 성이 맞아야 한다. 생년월일을 모르면 이름 전체가 같을 때만."""
    name = norm(player.get("name"))
    ea_last = norm(cand.get("last"))
    ea_full = norm(" ".join(x for x in (cand.get("first"), cand.get("last")) if x))
    ea_common = norm(cand.get("common"))
    last_ok = bool(ea_last) and (name.endswith(ea_last) or ea_last in name.split() or (ea_common and ea_common in name))
    born = player.get("birthDate")
    if born and cand.get("born"):
        if str(born)[:10] == cand["born"]:
            return last_ok or name == ea_full
        # 시간대 때문에 하루 어긋나는 경우만 인정: 이름 전체가 같을 때에 한한다
        try:
            off = abs((datetime.strptime(str(born)[:10], "%Y-%m-%d") - datetime.strptime(cand["born"], "%Y-%m-%d")).days)
        except ValueError:
            return False
        return off <= 1 and name == ea_full
    return name == ea_full or (bool(ea_common) and name == ea_common)


def find(player, overrides=None):
    """선수 1명의 EA 평가. 반환: (후보 dict, fetchedAt) 또는 (None, fetchedAt/None). 후보가 둘 이상이면 None.
    검색어는 성 → 이름 순으로 시도한다(악센트·ø 등은 풀어서)."""
    words = norm(player.get("name")).split()
    if not words:
        return None, None
    want = (overrides or {}).get(str(player.get("id")))
    at = None
    for term in dict.fromkeys([words[-1], words[0]]):
        items, at = search(term)
        if items is None:
            continue
        if want:
            hit = [c for c in items if c["id"] == want]
            if hit:
                return hit[0], at
            continue
        hits = [c for c in items if is_match(player, c)]
        if len(hits) > 1:          # 같은 성·같은 생일(쌍둥이 등)이면 이름(first)까지 맞는 후보로 좁힌다
            hits = [c for c in hits if norm(c.get("first")) in words or norm(c.get("common")) == norm(player.get("name"))]
        if len(hits) == 1:
            return hits[0], at
    return None, at


def build(cand, at, position):
    """화면에 내보낼 ratings 객체."""
    gk = position == "goalkeeper"
    groups = []
    for gid, (title, rows) in (GK_GROUPS if gk else GROUPS).items():
        attrs = []
        for key, label in rows:
            v = cand["stats"].get(key)
            if v is not None:
                attrs.append({"key": key, "label": label, "raw": v, "fm": to20(v)})
        groups.append({"id": gid, "title": title, "attrs": attrs})
    ranked = sorted((a for g in groups for a in g["attrs"]), key=lambda a: -a["raw"])
    top = [a["key"] for a in ranked[:3]]
    positions = [{"code": c, "label": POS_KO.get(c, c), "main": i == 0, "x": POS_XY[c][0], "y": POS_XY[c][1]}
                 for i, c in enumerate([cand["position"]] + cand["alt"]) if c in POS_XY]
    return {"eaId": cand["id"], "overall": cand["overall"], "groups": groups, "top": top, "positions": positions,
            "foot": cand["foot"], "weakFoot": cand["weakFoot"], "skillMoves": cand["skillMoves"], "abilities": cand["abilities"],
            "eaTeam": cand["team"],
            "fetchedAt": datetime.fromtimestamp(at, timezone.utc).strftime("%Y-%m-%d")}


def attach(players, overrides=None):
    """players 각 항목에 ratings(없으면 None)를 붙여 돌려준다. 이름 검색은 병렬로."""
    def one(p):
        try:
            cand, at = find(p, overrides)
        except Exception:
            cand, at = None, None
        return dict(p, ratings=build(cand, at, p["position"]) if cand else None)
    with ThreadPoolExecutor(max_workers=6) as pool:
        return list(pool.map(one, players))

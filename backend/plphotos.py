"""프리미어리그 공식 사이트의 선수 사진(개인 로컬 열람용).

비공개 API 는 쓰지 않는다. 브라우저가 받는 것과 같은 공개 선수단 HTML 페이지에서 선수 ID 를 읽고,
사진은 공개 이미지 서버(110x140)에서 그대로 불러온다. 배포용 앱·공개 서비스에는 쓰지 말 것:
PL_PHOTOS=0 환경변수로 끌 수 있다. 실패하면 호출한 쪽이 Commons 사진·이니셜로 폴백한다.
"""
import json
import os
import re
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ENABLED = os.environ.get("PL_PHOTOS", "1") != "0"
UA = "Mozilla/5.0 (compatible; fm-dashboard/1.0)"
SITE = "https://www.premierleague.com"
IMG = "https://resources.premierleague.com/premierleague25/photos/players/110x140/%s.png"
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
CLUB_FILE = os.path.join(DATA, "pl_clubs.json")
CLUB_TTL = 14 * 86400
MAX_CLUB_ID = 80
# 이름 정규화 뒤 같은 구단으로 보는 별칭 (ESPN 표기 ↔ PL 표기)
ALIASES = {"wolves": "wolverhampton wanderers", "spurs": "tottenham hotspur", "brighton": "brighton and hove albion",
           "man utd": "manchester united", "man city": "manchester city", "newcastle": "newcastle united",
           "west ham": "west ham united", "leeds": "leeds united", "forest": "nottingham forest"}
TITLE = re.compile(r"<title>\s*(.*?)\s+Squad Information", re.S)
TTL = 24 * 3600
_cache = {}
_lock = threading.Lock()
LINK = re.compile(r"/en/players/(\d+)/([a-z0-9-]+)/overview")


def parse_squad(html):
    """선수단 HTML → [{'id': '111234', 'slug': 'jordan-pickford'}] (등장 순서, 중복 제거)."""
    seen, out = set(), []
    for pid, slug in LINK.findall(html or ""):
        if pid not in seen:
            seen.add(pid)
            out.append({"id": pid, "slug": slug})
    return out


def key(text):
    """이름/slug 비교용 키: ASCII 알파벳만 남긴다(Nørgaard/Röhl 은 slug 에서도 같은 글자가 빠진다)."""
    return re.sub(r"[^a-z]", "", (text or "").lower())


def match(name, entries):
    """ESPN 선수명과 일치하는 PL 항목(정확히 1개)만 돌려준다."""
    want = key(name)
    hits = [e for e in entries if key(e["slug"].replace("-", " ")) == want]
    if len(hits) == 1:
        return hits[0]
    if hits:
        return None
    # 성 + 이름 첫 글자가 유일하게 맞을 때만 허용
    parts = [p for p in re.split(r"[\s-]+", name.strip()) if p]
    if len(parts) < 2:
        return None
    last, first = key(parts[-1]), key(parts[0])[:1]
    cand = [e for e in entries if key(e["slug"].split("-")[-1]) == last and key(e["slug"])[:1] == first]
    return cand[0] if len(cand) == 1 else None


def _fetch(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=12) as res:
        return res.read(), res.headers.get("Content-Type", "")


def club_name(html):
    """선수단 HTML 의 <title> 에서 PL 구단명을 읽는다 (없으면 None)."""
    m = TITLE.search(html or "")
    return " ".join(m.group(1).split()) if m else None


def norm_club(name):
    t = re.sub(r"[^a-z0-9& ]", " ", (name or "").lower().replace("&", " and "))
    words = [w for w in t.split() if w not in ("afc", "fc", "the")]
    t = " ".join(words)
    return ALIASES.get(t, t)


SEED = {1: "Manchester United", 2: "Leeds United", 3: "Arsenal", 4: "Newcastle United", 6: "Tottenham Hotspur",
        7: "Aston Villa", 11: "Everton", 14: "Liverpool", 31: "Crystal Palace", 36: "Brighton and Hove Albion",
        39: "Wolverhampton Wanderers"}      # 직접 확인한 값. 나머지는 탐색으로 채운다
SPACING = 1.2
_scan = {"running": False, "cooldown": 0.0}


def _load_clubs():
    try:
        with open(CLUB_FILE, encoding="utf-8") as f:
            raw = json.load(f)
        return {int(k): v for k, v in raw.get("clubs", {}).items()}, raw.get("next", 1), raw.get("at", 0)
    except Exception:
        return {}, 1, 0


def _save_clubs(clubs, nxt, at):
    try:
        os.makedirs(DATA, exist_ok=True)
        with open(CLUB_FILE, "w", encoding="utf-8") as f:
            json.dump({"clubs": clubs, "next": nxt, "at": at}, f, ensure_ascii=False)
    except Exception:
        pass


def _scan_clubs():
    """id 1..80 을 직렬로 훑어 구단명을 모은다. 429 가 오면 즉시 멈추고 진행 상황을 저장해 다음에 이어서 한다."""
    try:
        clubs, nxt, _ = _load_clubs()
        if nxt > MAX_CLUB_ID:
            nxt, clubs = 1, dict(clubs)
        while nxt <= MAX_CLUB_ID:
            try:
                body, _ = _fetch("%s/en/clubs/%d/x/squad" % (SITE, nxt))
                name = club_name(body.decode("utf-8", "replace"))
                if name:
                    clubs[nxt] = name
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    _scan["cooldown"] = time.time() + 600
                    _save_clubs(clubs, nxt, 0)
                    return
            except Exception:
                pass
            nxt += 1
            _save_clubs(clubs, nxt, 0)
            time.sleep(SPACING)
        _save_clubs(clubs, nxt, time.time())
    finally:
        _scan["running"] = False


def discover_clubs():
    """{PL 구단 id: 구단명}. 즉시 돌려주고(시드+저장된 탐색 결과), 오래됐거나 미완이면 백그라운드에서 이어서 탐색한다."""
    clubs, nxt, at = _load_clubs()
    merged = dict(SEED)
    merged.update(clubs)
    fresh = at and time.time() - at < CLUB_TTL
    if not fresh and not _scan["running"] and time.time() >= _scan["cooldown"]:
        _scan["running"] = True
        threading.Thread(target=_scan_clubs, daemon=True).start()
    return merged


def club_id_for(names, clubs):
    """ESPN 구단명(들)과 정규화 이름이 정확히 일치하는 PL 구단 id (유일할 때만)."""
    want = {norm_club(n) for n in names if n}
    hits = [cid for cid, name in clubs.items() if norm_club(name) in want]
    return hits[0] if len(hits) == 1 else None


def _espn_names(espn_team_id):
    from backend import espn
    try:
        for c in espn.clubs():
            if c["club"]["id"] == espn_team_id:
                return [c["club"].get("name"), c["club"].get("shortName")]
    except Exception:
        pass
    return []


def squad_entries(espn_team_id):
    if not ENABLED:
        return []
    now = time.time()
    with _lock:
        hit = _cache.get(espn_team_id)
    if hit and now - hit[0] < TTL:
        return hit[1]
    cid = club_id_for(_espn_names(espn_team_id), discover_clubs())
    if not cid:
        return hit[1] if hit else []
    try:
        body, _ = _fetch("%s/en/clubs/%d/x/squad" % (SITE, cid))
        entries = parse_squad(body.decode("utf-8", "replace"))
    except Exception:
        return hit[1] if hit else []
    with _lock:
        _cache[espn_team_id] = (now, entries)
    return entries


def attach(players, espn_team_id, keep=()):
    """선수 dict 목록에 PL 공식 사진을 붙인다(Commons 사진보다 우선). keep 에 든 선수 id(수동 지정)는 건드리지 않는다.
    이미지 응답은 선수별로 하루 한 번만 검증(병렬)."""
    entries = squad_entries(espn_team_id)
    if not entries:
        return players
    found = {p["id"]: match(p["name"], entries) for p in players if p["id"] not in keep}
    todo = [e["id"] for e in found.values() if e]
    with ThreadPoolExecutor(max_workers=8) as pool:
        ok = dict(zip(todo, pool.map(_image_ok, todo)))
    out = []
    for p in players:
        e = found.get(p["id"])
        if e and ok.get(e["id"]):
            p = dict(p, photoURL=IMG % e["id"], photoSource="premierleague",
                     photoCredit={"author": "Premier League", "license": "공식 사이트 이미지(개인 열람용)", "licenseURL": None,
                                  "pageURL": "%s/en/players/%s/%s/overview" % (SITE, e["id"], e["slug"])})
        out.append(p)
    return out


_img_ok = {}


def _image_ok(pid):
    """200 + PNG 이고 '사진 없음' 자리표시 이미지(약 6KB)가 아닐 때만 True. 결과는 하루 캐시."""
    now = time.time()
    hit = _img_ok.get(pid)
    if hit and now - hit[0] < TTL:
        return hit[1]
    try:
        body, ctype = _fetch(IMG % pid)
        ok = "image/png" in ctype and len(body) > 20000
    except Exception:
        ok = hit[1] if hit else False
    _img_ok[pid] = (now, ok)
    return ok

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
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ENABLED = os.environ.get("PL_PHOTOS", "1") != "0"
UA = "Mozilla/5.0 (compatible; fm-dashboard/1.0)"
SITE = "https://www.premierleague.com"
IMG = "https://resources.premierleague.com/premierleague25/photos/players/110x140/%s.png"
CLUBS = {368: (11, "everton")}          # ESPN 구단 id → (PL 구단 id, slug). 다른 구단은 PL 선수단 페이지 매핑이 없어 사진 없음
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


def squad_entries(espn_team_id):
    mapping = CLUBS.get(espn_team_id)
    if not ENABLED or not mapping:
        return []
    now = time.time()
    with _lock:
        hit = _cache.get(espn_team_id)
    if hit and now - hit[0] < TTL:
        return hit[1]
    try:
        body, _ = _fetch("%s/en/clubs/%d/%s/squad" % (SITE, mapping[0], mapping[1]))
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

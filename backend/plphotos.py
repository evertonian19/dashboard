"""프리미어리그 공식 사이트의 선수 사진 후보(개인 로컬 열람용).

비공개 API 는 쓰지 않는다. 브라우저가 받는 것과 같은 공개 선수단 HTML 에서 선수 ID(= Opta id)를 읽고,
사진은 공개 이미지 서버에서 가져온다. 이 모듈은 '후보 URL'만 만들고, 실제 다운로드·검증·저장은 photocache 가 한다.

PL 사이트는 요청이 몰리면 429 를 준다. 그래서 선수단 HTML 은 디스크에 오래 보관하고(만료돼도 실패하면 계속 사용),
네트워크 요청은 응답 경로가 아니라 백그라운드 워커 하나가 5초 간격으로만 보내며, 429 가 오면 30분 쉰다.
PL_PHOTOS=0 환경변수로 끌 수 있다.
"""
import json
import os
import re
import threading
import time
import urllib.error
import urllib.request

ENABLED = os.environ.get("PL_PHOTOS", "1") != "0"
UA = "Mozilla/5.0 (compatible; fm-dashboard/1.0)"
SITE = "https://www.premierleague.com"
IMG_HI = "https://resources.premierleague.com/premierleague/photos/players/250x250/p%s.png"
IMG_LO = "https://resources.premierleague.com/premierleague25/photos/players/110x140/%s.png"
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
CLUB_FILE = os.path.join(DATA, "pl_clubs.json")
SQUAD_FILE = os.path.join(DATA, "pl_squads.json")
CLUB_TTL = 14 * 86400
SQUAD_TTL = 7 * 86400
MAX_CLUB_ID = 80
SPACING = 5.0
COOLDOWN = 1800
# 이름 정규화 뒤 같은 구단으로 보는 별칭 (ESPN 표기 ↔ PL 표기)
ALIASES = {"wolves": "wolverhampton wanderers", "spurs": "tottenham hotspur", "brighton": "brighton and hove albion",
           "man utd": "manchester united", "man city": "manchester city", "newcastle": "newcastle united",
           "west ham": "west ham united", "leeds": "leeds united", "forest": "nottingham forest"}
TITLE = re.compile(r"<title>\s*(.*?)\s+Squad Information", re.S)
LINK = re.compile(r"/en/players/(\d+)/([a-z0-9-]+)/overview")
# 직접 확인한 PL 구단 id(= Opta id). 나머지는 아래 PRIORITY 를 title 로 검증한 뒤에만 채택한다.
SEED = {1: "Manchester United", 2: "Leeds United", 3: "Arsenal", 4: "Newcastle United", 6: "Tottenham Hotspur",
        7: "Aston Villa", 11: "Everton", 14: "Liverpool", 31: "Crystal Palace", 36: "Brighton and Hove Albion",
        39: "Wolverhampton Wanderers"}
PRIORITY = [8, 43, 34, 94, 91, 17, 56, 21, 90, 20, 13, 40]      # 추정 후보: 요청해서 title 이 맞을 때만 매핑에 들어간다

_lock = threading.Lock()
_state = {"cooldown": 0.0, "last": 0.0, "worker": None, "want": set()}


# ---------------------------------------------------------------- 파싱·매칭 (순수 함수)
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
    parts = [p for p in re.split(r"[\s-]+", name.strip()) if p]
    if len(parts) < 2:
        return None
    last, first = key(parts[-1]), key(parts[0])[:1]
    cand = [e for e in entries if key(e["slug"].split("-")[-1]) == last and key(e["slug"])[:1] == first]
    return cand[0] if len(cand) == 1 else None


def club_name(html):
    """선수단 HTML 의 <title> 에서 PL 구단명을 읽는다 (없으면 None)."""
    m = TITLE.search(html or "")
    return " ".join(m.group(1).split()) if m else None


def norm_club(name):
    t = re.sub(r"[^a-z0-9& ]", " ", (name or "").lower().replace("&", " and "))
    words = [w for w in t.split() if w not in ("afc", "fc", "the")]
    t = " ".join(words)
    return ALIASES.get(t, t)


def club_id_for(names, clubs):
    """ESPN 구단명(들)과 정규화 이름이 정확히 일치하는 PL 구단 id (유일할 때만)."""
    want = {norm_club(n) for n in names if n}
    hits = [cid for cid, name in clubs.items() if norm_club(name) in want]
    return hits[0] if len(hits) == 1 else None


def candidates_for(players, entries, keep=()):
    """{선수 id: [PL 사진 후보(고해상도, 저해상도)]}. keep(수동 지정) 선수는 제외."""
    out = {}
    for p in players:
        if p["id"] in keep:
            continue
        e = match(p["name"], entries)
        if not e:
            continue
        credit = {"author": "Premier League", "license": "공식 사이트 이미지(개인 열람용)", "licenseURL": None,
                  "pageURL": "%s/en/players/%s/%s/overview" % (SITE, e["id"], e["slug"])}
        out[p["id"]] = [{"url": IMG_HI % e["id"], "source": "premierleague", "credit": credit},
                        {"url": IMG_LO % e["id"], "source": "premierleague", "credit": credit}]
    return out


# ---------------------------------------------------------------- 디스크 저장
def _read(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _write(path, obj):
    try:
        os.makedirs(DATA, exist_ok=True)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False)
        os.replace(tmp, path)
    except Exception:
        pass


def _clubs_state():
    raw = _read(CLUB_FILE)
    return ({int(k): v for k, v in raw.get("clubs", {}).items()}, set(raw.get("tried", [])), raw.get("at", 0))


# ---------------------------------------------------------------- PL 요청 (워커 전용, 5초 간격·429 쿨다운)
def _pl_get(path):
    """429 면 쿨다운을 걸고 예외를 던진다. 호출은 워커 스레드에서만."""
    now = time.time()
    if now < _state["cooldown"]:
        raise RuntimeError("cooldown")
    wait = _state["last"] + SPACING - now
    if wait > 0:
        time.sleep(wait)
    _state["last"] = time.time()
    req = urllib.request.Request(SITE + path, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=15) as res:
            return res.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        if e.code == 429:
            _state["cooldown"] = time.time() + COOLDOWN
        raise


def _work():
    try:
        while time.time() >= _state["cooldown"]:
            clubs, tried, at = _clubs_state()
            # 1) 필요한 구단 선수단 HTML (만료됐거나 없을 때)
            squads = _read(SQUAD_FILE)
            todo = [c for c in list(_state["want"]) if time.time() - squads.get(str(c), {}).get("at", 0) > SQUAD_TTL]
            if todo:
                cid = todo[0]
                try:
                    html = _pl_get("/en/clubs/%d/x/squad" % cid)
                    entries = parse_squad(html)
                    if entries:
                        squads[str(cid)] = {"at": time.time(), "entries": entries}
                        _write(SQUAD_FILE, squads)
                    _state["want"].discard(cid)
                except urllib.error.HTTPError as e:
                    if e.code == 429:
                        return
                    _state["want"].discard(cid)
                except Exception:
                    _state["want"].discard(cid)
                continue
            # 2) 구단 id 탐색: 추정 후보 먼저, 이어서 1..80 (이미 시도한 id 는 건너뜀)
            order = [i for i in PRIORITY + list(range(1, MAX_CLUB_ID + 1)) if i not in tried and i not in SEED]
            order = list(dict.fromkeys(order))
            if not order:
                return
            cid = order[0]
            try:
                html = _pl_get("/en/clubs/%d/x/squad" % cid)
                name = club_name(html)
                if name:
                    clubs[cid] = name
                    squads = _read(SQUAD_FILE)
                    entries = parse_squad(html)
                    if entries:
                        squads[str(cid)] = {"at": time.time(), "entries": entries}
                        _write(SQUAD_FILE, squads)
            except urllib.error.HTTPError as e:
                if e.code == 429:
                    return
            except Exception:
                pass
            tried.add(cid)
            _write(CLUB_FILE, {"clubs": clubs, "tried": sorted(tried),
                               "at": time.time() if len(tried | set(SEED)) >= MAX_CLUB_ID else 0})
    finally:
        with _lock:
            _state["worker"] = None


def ensure_worker():
    if not ENABLED:
        return
    with _lock:
        if _state["worker"] is not None or time.time() < _state["cooldown"]:
            return
        t = threading.Thread(target=_work, daemon=True)
        _state["worker"] = t
        t.start()


# ---------------------------------------------------------------- 응답 경로 (네트워크 없음)
def discover_clubs():
    """{PL 구단 id: 구단명}: 시드 + 저장된 탐색 결과. 비어 있는 부분은 백그라운드 워커가 채운다."""
    clubs, tried, at = _clubs_state()
    merged = dict(SEED)
    merged.update(clubs)
    if len(tried | set(SEED)) < MAX_CLUB_ID:
        ensure_worker()
    return merged


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
    """저장된 선수단(없거나 만료면 워커에 요청하고, 있으면 만료됐어도 그대로 쓴다). 응답 경로에서 네트워크를 쓰지 않는다."""
    if not ENABLED:
        return []
    cid = club_id_for(_espn_names(espn_team_id), discover_clubs())
    if not cid:
        return []
    saved = _read(SQUAD_FILE).get(str(cid)) or {}
    if time.time() - saved.get("at", 0) > SQUAD_TTL:
        _state["want"].add(cid)
        ensure_worker()
    return saved.get("entries", [])


def candidates(players, espn_team_id, keep=()):
    return candidates_for(players, squad_entries(espn_team_id), keep) if ENABLED else {}

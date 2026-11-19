"""선수 신상(생년월일·키·국적·출생지)을 Wikidata 로 교차 검증·보정한다 (키 불필요, 공개 API).

ESPN 로스터는 동명이인 프로필이 섞여 신상이 틀린 경우가 있다(예: Thierno Barry 가 기니 선수 정보로 나옴).
같은 구단에 현재 소속(P54, 종료일 없음)으로 등록된 Wikidata 항목만 후보로 삼기 때문에 동명이인이 걸러진다.
후보가 정확히 1명일 때만 보정하고, 애매하면 ESPN 값을 그대로 두고 '미검증'으로 표시한다.
수동 보정 파일(data/ios_player_overrides.json)이 최종 권위다.
"""
import json
import os
import re
import threading
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone

API = "https://www.wikidata.org/w/api.php"
UA = "Mozilla/5.0 (compatible; fm-dashboard/1.0)"
HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("DASH_DATA_DIR") or os.path.join(os.path.dirname(HERE), "data")
CACHE_FILE = os.path.join(DATA_DIR, "wikidata_cache.json")
OVERRIDE_FILE = os.path.join(HERE, "ios_player_overrides.json")   # 저장소에 포함(수동 보정은 버전 관리)
TTL = 7 * 86400
FOOTBALLER = "Q937857"
EVERTON_ESPN_ID = 368
KNOWN_TEAMS = {368: "Q5794"}          # ESPN 구단 id → Wikidata QID (Everton F.C.). 그 외는 이름으로 찾아 캐시
CM_UNITS = {"Q174728": 1.0, "Q11573": 100.0}   # centimetre, metre
HOME_NATIONS = {"england", "scotland", "wales", "northern ireland"}
_lock = threading.Lock()
_mem = None


# ---------------------------------------------------------------------------
# 캐시 (디스크 + 메모리)

def _load():
    global _mem
    with _lock:
        if _mem is None:
            try:
                with open(CACHE_FILE, encoding="utf-8") as fh:
                    _mem = json.load(fh)
            except (OSError, ValueError):
                _mem = {}
        return _mem


def _save():
    with _lock:
        snap = dict(_mem or {})
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        tmp = CACHE_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(snap, fh, ensure_ascii=False)
        os.replace(tmp, CACHE_FILE)
    except OSError:
        pass


def _cached(key, fetch, ttl=TTL):
    """신선한 캐시 → 없으면 fetch() → 실패하면 오래된 캐시 → 없으면 예외."""
    mem = _load()
    hit = mem.get(key)
    now = time.time()
    if hit and now - hit["at"] < ttl:
        return hit["v"]
    try:
        value = fetch()
    except Exception:
        if hit:
            return hit["v"]
        raise
    with _lock:
        mem[key] = {"at": now, "v": value}
    return value


_net_lock = threading.Lock()
_state = {"last": 0.0, "blocked_until": 0.0}
_local = threading.local()
SPACING = 1.0                          # 요청 간격(초). Wikidata 는 빠른 연속 호출에 429 를 준다


class NetOff(Exception):
    """캐시만 쓰는 모드(또는 429 쿨다운 중)라 네트워크를 쓰지 않는다."""


def _api(**params):
    if getattr(_local, "offline", False):
        raise NetOff()
    params.update(format="json", formatversion="2")
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params), headers={"User-Agent": UA})
    with _net_lock:                    # 직렬 호출 + 간격 유지
        now = time.time()
        if now < _state["blocked_until"]:
            raise NetOff()
        time.sleep(max(0.0, _state["last"] + SPACING - now))
        try:
            with urllib.request.urlopen(req, timeout=10) as res:
                return json.load(res)
        except urllib.error.HTTPError as exc:
            if exc.code == 429:
                try:
                    wait = int(exc.headers.get("Retry-After") or 90)
                except ValueError:
                    wait = 90
                _state["blocked_until"] = time.time() + min(max(wait, 30), 600)
            raise
        finally:
            _state["last"] = time.time()


# ---------------------------------------------------------------------------
# 이름 · 후보 검색

def norm(name):
    text = unicodedata.normalize("NFKD", name or "")
    text = "".join(c for c in text if not unicodedata.combining(c)).lower().replace("'", "")
    return " ".join(re.sub(r"[^a-z0-9]+", " ", text).split())


def _search(term):
    data = _api(action="wbsearchentities", search=term, language="en", type="item", limit=10)
    return [{"id": x["id"], "label": x.get("label", ""), "desc": x.get("description", "")} for x in data.get("search", [])]


def candidates(name):
    """이름으로 찾은 '축구 선수 같은' 항목 id 목록 (구단 소속은 이후 단계에서 확인)."""
    found = _cached("search:" + norm(name), lambda: _search(name))
    return [c["id"] for c in found if "foot" in c["desc"].lower() or c["desc"] == ""]


def _entities(ids):
    ids = sorted(set(ids))
    out = {}
    for i in range(0, len(ids), 40):
        chunk = ids[i:i + 40]
        data = _api(action="wbgetentities", ids="|".join(chunk), props="claims|labels|aliases", languages="en")
        out.update(data.get("entities", {}))
    return out


def entities(ids):
    """id → 엔티티. 개별로 캐시해서 다음 호출은 네트워크 없이 끝난다."""
    mem = _load()
    now = time.time()
    missing = [i for i in set(ids) if not (mem.get("ent:" + i) and now - mem["ent:" + i]["at"] < TTL)]
    if missing:
        try:
            for qid, ent in _entities(missing).items():
                slim = _slim(ent)
                with _lock:
                    mem["ent:" + qid] = {"at": now, "v": slim}
        except Exception:
            pass                       # 실패해도 캐시에 있는 것만으로 진행(오래된 값 포함)
    return {i: mem["ent:" + i]["v"] for i in ids if ("ent:" + i) in mem}


def _claim_ids(ent, prop):
    out = []
    for c in ent.get("claims", {}).get(prop, []):
        v = ((c.get("mainsnak") or {}).get("datavalue") or {}).get("value")
        if isinstance(v, dict) and v.get("id"):
            out.append((v["id"], c))
    return out


def _slim(ent):
    """필요한 값만 남긴 엔티티(캐시 크기 절약)."""
    claims = ent.get("claims", {})
    teams = []
    for qid, c in _claim_ids(ent, "P54"):
        ended = bool((c.get("qualifiers") or {}).get("P582"))
        teams.append([qid, ended])

    def first_value(prop):
        for c in claims.get(prop, []):
            v = ((c.get("mainsnak") or {}).get("datavalue") or {}).get("value")
            if v is not None:
                return v
        return None

    dob = first_value("P569")
    height = first_value("P2048")
    return {"label": ((ent.get("labels") or {}).get("en") or {}).get("value", ""),
            "aliases": [a.get("value", "") for a in (ent.get("aliases") or {}).get("en", [])],
            "teams": teams,
            "dob": dob.get("time") if isinstance(dob, dict) and dob.get("precision", 0) >= 11 else None,
            "height": [height.get("amount"), (height.get("unit") or "").rsplit("/", 1)[-1]] if isinstance(height, dict) else None,
            "citizen": [q for q, _ in _claim_ids(ent, "P27")], "birthplace": [q for q, _ in _claim_ids(ent, "P19")][:1],
            "iso": first_value("P298")}   # 국가의 ISO 3자리 코드(ESPN 국기 파일명)


# ---------------------------------------------------------------------------
# 구단 QID · 값 해석

def team_qid(espn_id, club_name):
    if espn_id in KNOWN_TEAMS:
        return KNOWN_TEAMS[espn_id]

    def lookup():
        for c in _search(club_name):
            d = c["desc"].lower()
            if "football club" in d and "england" in d and not any(w in d for w in ("women", "reserves", "under-", "academy")):
                return c["id"]
        return None
    try:
        return _cached("team:%s" % espn_id, lookup, ttl=30 * 86400)
    except Exception:
        return None


def _parse_dob(text):
    m = re.match(r"^\+?(\d{4})-(\d{2})-(\d{2})", text or "")
    if not m or m.group(2) == "00" or m.group(3) == "00":
        return None
    return "%s-%s-%s" % m.groups()


def _parse_height(h):
    if not h or not h[0]:
        return None
    try:
        return round(float(h[0]) * CM_UNITS.get(h[1], 0) / 1.0) or None
    except ValueError:
        return None


def age_on(born, today=None):
    try:
        y, m, d = (int(x) for x in born.split("-"))
    except (AttributeError, ValueError):
        return None
    t = today or datetime.now(timezone.utc).date()
    return t.year - y - ((t.month, t.day) < (m, d))


def _sane(height, born, today=None):
    age = age_on(born, today) if born else None
    return (height is None or 150 <= height <= 215) and (age is None or 15 <= age <= 45)


def _current_member(ent, qid):
    return any(t == qid and not ended for t, ended in ent["teams"])


def _name_match(espn_name, ent):
    want = norm(espn_name)
    return want and want in {norm(ent["label"])} | {norm(a) for a in ent["aliases"]}


def match_player(player, team, ents):
    """같은 구단 소속 + 이름 일치 후보가 정확히 1명이면 그 엔티티, 아니면 None."""
    hits = [e for e in ents if team and _current_member(e, team) and _name_match(player["name"], e)]
    return hits[0] if len(hits) == 1 else None


def facts(ent, labels):
    born = _parse_dob(ent.get("dob"))
    height = _parse_height(ent.get("height"))
    if not _sane(height, born):
        return None
    countries = [labels.get(q, {}).get("label") for q in ent.get("citizen", [])]
    countries = [c for c in countries if c]
    if ent.get("citizen") and not countries:
        return None                    # 국적 이름을 아직 못 받았다 → 반쪽짜리 보정을 하지 않고 다음 시도로 미룬다
    place = labels.get(ent["birthplace"][0], {}).get("label") if ent.get("birthplace") else None
    iso = next((labels[q].get("iso") for q in ent.get("citizen", []) if q in labels and labels[q].get("iso")), None)
    return {"birthDate": born, "heightCM": height, "nationality": countries[0] if countries else None,
            "birthPlace": place, "iso": iso}


# ---------------------------------------------------------------------------
# 수동 보정

def load_overrides():
    try:
        with open(OVERRIDE_FILE, encoding="utf-8") as fh:
            return {str(k): v for k, v in json.load(fh).items() if not str(k).startswith("_")}
    except (OSError, ValueError):
        return {}


# ---------------------------------------------------------------------------
# 적용

def _flag_for(iso):
    return "https://a.espncdn.com/i/teamlogos/countries/500/%s.png" % iso.lower() if iso else None


def _differs(field, mine, theirs):
    if mine in (None, "") or theirs in (None, ""):
        return False
    if field == "heightCM":
        return abs(mine - theirs) > 3
    if field == "nationality":
        a, b = norm(mine), norm(theirs)
        if b == "united kingdom" and a in HOME_NATIONS:
            return False
        return a != b
    return mine != theirs


def apply_facts(player, found, source, today=None):
    """player(dict) 에 found 값을 덮어쓰고 ESPN 과 달랐던 항목을 bioDisputed 로 남긴다."""
    out = dict(player)
    disputed = {}
    for field in ("birthDate", "heightCM", "nationality", "birthPlace"):
        new = found.get(field)
        if new in (None, ""):
            continue
        if field == "nationality" and norm(new) == "united kingdom" and norm(player.get("nationality") or "") in HOME_NATIONS:
            continue                                    # England/Scotland/Wales 는 UK 보다 구체적이므로 ESPN 값 유지
        if _differs(field, player.get(field), new):
            disputed[field] = player.get(field)
        out[field] = new
    if out.get("birthDate"):
        out["age"] = age_on(out["birthDate"], today)
    if "nationality" in disputed or "birthDate" in disputed:
        out["weightKG"] = None                          # 다른 사람 프로필이 섞였다면 몸무게도 신뢰할 수 없다
        out["flagURL"] = _flag_for(found.get("iso")) if "nationality" in disputed else player.get("flagURL")
    out["bioSource"] = source
    out["bioDisputed"] = disputed
    return out


_jobs = {}


def _build(plain, espn_team_id, club_name, overrides, today):
    """네트워크(또는 캐시)로 보정 값을 모아 {선수 id: facts} 를 만든다."""
    team = team_qid(espn_team_id, club_name)
    if not team:
        return {}
    cand = {p["id"]: candidates(p["name"]) for p in plain}
    ents = entities([i for ids in cand.values() for i in ids])
    matched, wanted = {}, set()
    for p in plain:
        e = match_player(p, team, [ents[i] for i in cand[p["id"]] if i in ents])
        if e:
            matched[p["id"]] = e
            wanted.update(e.get("citizen", []) + e.get("birthplace", []))
    labels = entities(list(wanted)) if wanted else {}
    result = {}
    for pid, e in matched.items():
        f = facts(e, labels)
        if f:
            result[pid] = f
    # 소속 확인이 안 된 선수(Wikidata 의 소속 정보가 낡은 경우)는 생년월일이 ESPN 과 같은 후보가 있으면 '교차 확인됨',
    # 이름이 같은 후보가 있는데 어느 것도 생년월일이 다르면 '의심'으로만 표시하고 값은 바꾸지 않는다.
    verified, suspect = set(), set()
    for p in plain:
        if p["id"] in result:
            continue
        named = [ents[i] for i in cand[p["id"]] if i in ents and _name_match(p["name"], ents[i])]
        dobs = {_parse_dob(e.get("dob")) for e in named} - {None}
        if p.get("birthDate") and p["birthDate"] in dobs:
            verified.add(p["id"])
        elif dobs:
            suspect.add(p["id"])
    _build.last = (verified, suspect)
    return result


def _finish(plain, matched, overrides, today, extra=None):
    verified, suspect = extra or (set(), set())
    out = []
    for p in plain:
        q = p
        q["bioVerified"] = p["id"] in verified or p["id"] in matched
        q["bioSuspect"] = p["id"] in suspect
        if p["id"] in matched:
            q = apply_facts(p, matched[p["id"]], "wikidata", today)
        ov = overrides.get(str(p["id"]))
        if ov:
            q = apply_facts(q, {k: ov[k] for k in ("birthDate", "heightCM", "nationality", "birthPlace", "iso") if ov.get(k) is not None}, "override", today)
            if "weightKG" in ov:
                q["weightKG"] = ov["weightKG"]
            if ov.get("iso"):
                q["flagURL"] = _flag_for(ov["iso"])
            q["bioDisputed"] = {**p_disputes(p, q), **q["bioDisputed"]}
        out.append(q)
    return out


def enrich(players, espn_team_id, club_name, today=None, block=False):
    """로스터 선수 dict 목록 → 보정된 목록.

    기본은 캐시로 즉시 응답하고, 캐시에 없는 값은 백그라운드 스레드가 채운다(다음 요청부터 반영, bioPending=True).
    block=True 면 끝까지 기다린다(감사·테스트용). 어떤 경우에도 예외 없이 ESPN 값은 돌려준다."""
    overrides = load_overrides()
    plain = [dict(p, bioSource="espn", bioDisputed={}, bioPending=False, bioVerified=False, bioSuspect=False) for p in players]

    def run(offline):
        _local.offline = offline
        try:
            return _build(plain, espn_team_id, club_name, overrides, today)
        except Exception:
            return {}
        finally:
            _local.offline = False

    if block:
        _build.last = (set(), set())
        matched = run(False)
        _save()
        return _finish(plain, matched, overrides, today, _build.last)

    _build.last = (set(), set())
    matched = run(True)                                # 캐시만
    extra = _build.last
    complete = len(matched) >= sum(1 for p in plain if p["id"] in matched) and all(
        ("search:" + norm(p["name"])) in _load() for p in plain)
    if not complete and espn_team_id not in _jobs:
        def job():
            try:
                run(False)
                _save()
            finally:
                _jobs.pop(espn_team_id, None)
        _jobs[espn_team_id] = threading.Thread(target=job, daemon=True)
        _jobs[espn_team_id].start()
    out = _finish(plain, matched, overrides, today, extra)
    if not complete:
        for q in out:
            q["bioPending"] = q["bioSource"] == "espn"
    return out


def p_disputes(espn_player, final):
    d = {}
    for field in ("birthDate", "heightCM", "nationality", "birthPlace"):
        if _differs(field, espn_player.get(field), final.get(field)):
            d[field] = espn_player.get(field)
    return d

"""선수 사진을 후보 URL 에서 실제로 내려받아 검증하고 data/photos 에 저장한다 (개인 로컬 열람용).

브라우저는 원격 이미지 서버가 아니라 이 서버(/api/ios/photo/<id>)에서만 사진을 받는다.
그래서 핫링크 차단·레퍼러·429·서버 재시작과 상관없이, 한 번 검증된 사진은 계속 나온다.
검증: HTTP 200 + 매직바이트(PNG/JPEG/WEBP) + 최소 크기(자리표시 이미지·오류 페이지 거부).
"""
import json
import os
import threading
import time
import urllib.request
from urllib.parse import urlparse

DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "photos")
INDEX = os.path.join(DIR, "index.json")
UA = "Mozilla/5.0 (compatible; fm-dashboard/1.0)"
MIN_BYTES = 8000
MAX_BYTES = 4_000_000
NEG_TTL = 6 * 3600
RANK = {"manual": 0, "premierleague": 1, "commons": 2}
MIME = {"png": "image/png", "jpg": "image/jpeg", "webp": "image/webp"}

_lock = threading.Lock()
_pending = {}          # 선수 id → 후보 목록 (처리 대기)
_worker = {"t": None}
_neg = {}              # 선수 id → 마지막 실패 시각 (재시도 폭주 방지, 메모리)
_last_host = {}


def sniff(body):
    """이미지 확장자(png/jpg/webp) 또는 None. 크기가 작거나 이미지가 아니면 None."""
    if not body or len(body) < MIN_BYTES:
        return None
    if body.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if body.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if body[:4] == b"RIFF" and body[8:12] == b"WEBP":
        return "webp"
    return None


def _index():
    try:
        with open(INDEX, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _save(index):
    os.makedirs(DIR, exist_ok=True)
    tmp = INDEX + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False)
    os.replace(tmp, INDEX)


def entry(pid):
    e = _index().get(str(pid))
    if e and os.path.exists(os.path.join(DIR, e["file"])):
        return e
    return None


def path_for(pid):
    """(파일 경로, Content-Type) 또는 None."""
    e = entry(pid)
    if not e:
        return None
    return os.path.join(DIR, e["file"]), MIME.get(e["file"].rsplit(".", 1)[-1], "application/octet-stream")


def _download(url):
    host = urlparse(url).netloc
    wait = _last_host.get(host, 0) + 0.4 - time.time()
    if wait > 0:
        time.sleep(wait)
    _last_host[host] = time.time()
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=15) as res:
        if res.status != 200:
            return None
        return res.read(MAX_BYTES + 1)[:MAX_BYTES]


def fill(pid, cands):
    """후보를 순서대로 시도해 처음 검증을 통과한 것을 저장한다. 성공 여부."""
    for c in cands:
        try:
            body = _download(c["url"])
        except Exception:
            continue
        ext = sniff(body)
        if not ext:
            continue
        os.makedirs(DIR, exist_ok=True)
        name = "%s.%s" % (pid, ext)
        tmp = os.path.join(DIR, name + ".tmp")
        with open(tmp, "wb") as f:
            f.write(body)
        os.replace(tmp, os.path.join(DIR, name))
        with _lock:
            index = _index()
            old = index.get(str(pid))
            if old and old["file"] != name:
                try:
                    os.remove(os.path.join(DIR, old["file"]))
                except OSError:
                    pass
            index[str(pid)] = {"file": name, "source": c["source"], "credit": c.get("credit"), "url": c["url"], "at": time.time()}
            _save(index)
        return True
    _neg[pid] = time.time()
    return False


def _run():
    try:
        while True:
            with _lock:
                if not _pending:
                    return
                pid, cands = next(iter(_pending.items()))
                del _pending[pid]
            fill(pid, cands)
    finally:
        with _lock:
            _worker["t"] = None
            if _pending and _worker["t"] is None:
                t = threading.Thread(target=_run, daemon=True)
                _worker["t"] = t
                t.start()


def schedule(pid, cands):
    if not cands or time.time() - _neg.get(pid, 0) < NEG_TTL:
        return
    with _lock:
        _pending[pid] = cands
        if _worker["t"] is None:
            t = threading.Thread(target=_run, daemon=True)
            _worker["t"] = t
            t.start()


def apply(players, cands_by_id):
    """선수 dict 목록에 로컬 사진을 붙인다. 저장된 사진이 있으면 photoURL 을 로컬 경로로,
    없으면 이니셜로 두고 백그라운드에서 받아 온다(photoPending). 더 좋은 출처 후보가 생기면 업그레이드한다."""
    out = []
    for p in players:
        cands = cands_by_id.get(p["id"], [])
        e = entry(p["id"])
        q = dict(p, photoURL=None, photoCredit=None, photoSource=None, photoPending=False)
        if e:
            q.update(photoURL="/api/ios/photo/%d?v=%d" % (p["id"], int(e["at"])), photoSource=e["source"], photoCredit=e.get("credit"))
            better = [c for c in cands if RANK.get(c["source"], 9) < RANK.get(e["source"], 9)]
            if better:
                schedule(p["id"], better)
        elif cands:
            q["photoPending"] = time.time() - _neg.get(p["id"], 0) >= NEG_TTL
            schedule(p["id"], cands)
        out.append(q)
    return out

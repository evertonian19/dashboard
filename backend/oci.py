"""OCI: node-pool retry progress and this month's cost."""
import json
import os
import re
import shutil
import subprocess
from datetime import datetime, timedelta, timezone

from backend.db import now_iso


# ---------------------------------------------------------------------------
# OCI: progress of the node-pool retry loop (~/oci-oke) and this month's cost.
OCI_DIR = os.environ.get("OCI_DIR", os.path.expanduser("~/oci-oke"))
OCI_COST_TTL = 3600
_oci_cost = {"checked_at": None, "amount": None, "currency": None, "error": None}


LINE = re.compile(r"\[(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\] (.*)")


def classify_reason(text):
    """로그의 실패 사유를 짧은 한글 분류로 바꾼다."""
    low = (text or "").lower()
    if "capacity" in low:
        return "용량 부족"
    if "exceeded max retry count" in low or "work request expired" in low:
        return "자리 없음 (작업 시간 초과)"
    if "toomanyrequests" in low:
        return "요청 제한"
    if low:
        return "기타 오류"
    return ""


def parse_retry_log(lines, now=None):
    """retry.log 줄들을 시도 단위로 묶어 상세 현황을 만든다 (순수 함수)."""
    now = now or datetime.now()
    interval = None
    attempts = []          # 끝난 시도: {at, ok, spec, reason}
    cur = None             # 진행 중인 시도: {n, spec, since}
    first_at = None
    success_text = None
    for line in lines:
        m = LINE.match(line)
        if not m:
            continue
        stamp, text = m.groups()
        first_at = first_at or stamp
        iv = re.search(r"retry every (\d+)s", text)
        if iv:
            interval = int(iv.group(1))
        st = re.match(r"attempt (\d+): (?:spec (\d+)/(\d+) )?terraform apply", text)
        if st:
            cur = {"n": int(st.group(1)), "since": stamp,
                   "spec": f"{st.group(2)}/{st.group(3)}" if st.group(2) else None}
            continue
        fin = re.match(r"attempt (\d+): apply rc=(\d+), nodes active=(\d+)", text)
        if fin:
            ok = fin.group(2) == "0" and int(fin.group(3)) > 0
            attempts.append({"at": stamp, "n": int(fin.group(1)), "ok": ok,
                             "spec": cur["spec"] if cur else None, "reason": "" if ok else None})
            cur = None
            continue
        rt = re.match(r"(?:retryable|FATAL[^:]*): (.*)", text)
        if rt and attempts and attempts[-1]["reason"] is None:
            attempts[-1]["reason"] = classify_reason(rt.group(1)) or "기타 오류"
        if text.startswith("SUCCESS"):
            success_text = text
    for a in attempts:
        a["reason"] = a["reason"] or ""
    by_spec = {}
    for a in attempts:
        if a["spec"]:
            by_spec[a["spec"]] = by_spec.get(a["spec"], 0) + 1
    last = attempts[-1] if attempts else None
    out = {
        "total_attempts": len(attempts), "interval": interval, "started_at": first_at.replace(" ", "T") if first_at else None,
        "elapsed": int((now - datetime.strptime(first_at, "%Y-%m-%d %H:%M:%S")).total_seconds()) if first_at else None,
        "in_progress": bool(cur), "current_spec": (cur or last or {}).get("spec") if (cur or last) else None,
        "current_since": cur["since"].replace(" ", "T") if cur else None,
        "next_at": None, "reason": last["reason"] if last and not last["ok"] else "",
        "by_spec": by_spec, "recent": [{k: a[k] for k in ("at", "ok", "spec", "reason")} for a in attempts[-10:]],
        "today_attempts": sum(1 for a in attempts if a["at"][:10] == now.strftime("%Y-%m-%d")),
        "success_text": success_text,
    }
    if last and not cur and interval:
        out["next_at"] = (datetime.strptime(last["at"], "%Y-%m-%d %H:%M:%S") + timedelta(seconds=interval)).strftime("%Y-%m-%dT%H:%M:%S")
    return out


def oci_status():
    out = {"available": False, "running": False, "attempt": None, "last_at": None,
           "last_result": None, "success": False, "cost": dict(_oci_cost)}
    log = os.path.join(OCI_DIR, "retry.log")
    try:
        with open(log, "rb") as fh:
            lines = fh.read().decode("utf-8", "replace").splitlines()
    except OSError:
        return out
    out["available"] = True
    try:
        with open(os.path.join(OCI_DIR, "retry.pid")) as fh:
            pid = int(fh.read().strip())
        with open(f"/proc/{pid}/cmdline", "rb") as fh:
            out["running"] = b"retry-nodepool" in fh.read()
    except (OSError, ValueError):
        pass
    detail = parse_retry_log(lines)
    out.update(detail)
    for line in reversed(lines):
        m = LINE.match(line)
        if not m:
            continue
        stamp, text = m.groups()
        out["last_at"] = out["last_at"] or stamp.replace(" ", "T")
        if text.startswith("SUCCESS"):
            out["success"] = True
            ok = re.search(r"SUCCESS after (\d+) attempt\(s\): (\d+) nodes", text)
            out["last_result"] = out["last_result"] or (
                f"성공 · 노드 {ok.group(2)}개 생성 완료 ({ok.group(1)}번째 시도)" if ok else "성공")
        attempt = re.match(r"attempt (\d+): apply rc=(\d+), nodes active=(\d+)", text)
        if attempt:
            out["attempt"] = int(attempt.group(1))
            if not out["last_result"]:
                out["last_result"] = "성공" if attempt.group(2) == "0" else "실패 (자리 없음, 재시도 중)"
            break
    return out


def refresh_oci_cost():
    try:
        with open(os.path.expanduser("~/.oci/config")) as fh:
            tenancy = re.search(r"^tenancy\s*=\s*(\S+)", fh.read(), re.M).group(1)
        now = datetime.now(timezone.utc)
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        fmt = "%Y-%m-%dT%H:%M:%SZ"
        res = subprocess.run(
            [shutil.which("oci") or os.path.expanduser("~/bin/oci"), "usage-api", "usage-summary",
             "request-summarized-usages", "--tenant-id", tenancy, "--granularity", "MONTHLY",
             "--query-type", "COST", "--time-usage-started", start.strftime(fmt),
             "--time-usage-ended", end.strftime(fmt)],
            capture_output=True, text=True, timeout=90,
            env={**os.environ, "SUPPRESS_LABEL_WARNING": "True"})
        if res.returncode != 0:
            raise RuntimeError((res.stderr or res.stdout).strip().splitlines()[-1][:200])
        items = (json.loads(res.stdout or "{}").get("data") or {}).get("items") or []
        amount = sum(float(i.get("computed-amount") or 0) for i in items)
        currency = next((i.get("currency") for i in items if i.get("currency")), "")
        _oci_cost.update(amount=round(amount, 2), currency=(currency or "").strip(), error=None)
    except Exception as exc:
        _oci_cost.update(error=str(exc)[:200])
    _oci_cost["checked_at"] = now_iso()

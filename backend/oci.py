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


def oci_status():
    out = {"available": False, "running": False, "attempt": None, "last_at": None,
           "last_result": None, "success": False, "cost": dict(_oci_cost)}
    log = os.path.join(OCI_DIR, "retry.log")
    try:
        with open(log, "rb") as fh:
            fh.seek(max(0, os.path.getsize(log) - 65536))
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
    for line in reversed(lines):
        m = re.match(r"\[(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)\] (.*)", line)
        if not m:
            continue
        stamp, text = m.groups()
        out["last_at"] = out["last_at"] or stamp.replace(" ", "T")
        if text.startswith("SUCCESS"):
            out["success"] = True
            out["last_result"] = out["last_result"] or text[:200]
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

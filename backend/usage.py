"""Claude usage: official limits plus token counts from local logs."""
import glob
import json
import os
import threading
from datetime import datetime, timedelta, timezone

from backend.config import CLAUDE_DIR


# ---------------------------------------------------------------------------
# Claude usage
#
# Two sources, used together:
#   1. Official limits. Claude Code hands its status line the account's real
#      rate-limit state after every response (5-hour and 7-day used_percentage
#      and resets_at). ~/.claude/statusline-dashboard.py saves that to
#      USAGE_FILE. This is the only source for % and the true reset time.
#   2. Token counts, summed from Claude Code's local logs on this machine.
# Without (1) the window is estimated from the logs and labelled as such.
# ---------------------------------------------------------------------------
USAGE_FILE = os.environ.get("CLAUDE_USAGE_FILE", os.path.expanduser("~/.claude/dashboard-usage.json"))
WINDOW = timedelta(hours=5)
_usage_lock = threading.Lock()
_log_cache = {}  # path -> {"pos": bytes already parsed, "seen": {(msg id, request id): entry}}


def _load_usage_entries():
    """All assistant responses with token usage, oldest first.
    Log files only grow, so each call parses just the bytes added since the last one."""
    paths = glob.glob(os.path.join(CLAUDE_DIR, "**", "*.jsonl"), recursive=True)
    with _usage_lock:
        for gone in set(_log_cache) - set(paths):
            del _log_cache[gone]
        for path in paths:
            try:
                size = os.path.getsize(path)
                state = _log_cache.get(path)
                if state is None or size < state["pos"]:
                    state = _log_cache[path] = {"pos": 0, "seen": {}}
                if size == state["pos"]:
                    continue
                with open(path, "rb") as fh:
                    fh.seek(state["pos"])
                    chunk = fh.read()
            except OSError:
                continue
            end = chunk.rfind(b"\n") + 1  # leave a partially written last line for next time
            state["pos"] += end
            for raw in chunk[:end].splitlines():
                if b'"usage"' not in raw:
                    continue
                try:
                    d = json.loads(raw)
                    msg = d.get("message") or {}
                    usage = msg.get("usage")
                    if not usage or not d.get("timestamp"):
                        continue
                    ts = datetime.fromisoformat(d["timestamp"].replace("Z", "+00:00"))
                except (ValueError, AttributeError, TypeError):
                    continue
                # One response is logged once per content block; the copies are identical.
                state["seen"][(msg.get("id"), d.get("requestId"))] = {
                    "ts": ts,
                    "model": msg.get("model") or "unknown",
                    "input": int(usage.get("input_tokens") or 0),
                    "output": int(usage.get("output_tokens") or 0),
                    "cache_write": int(usage.get("cache_creation_input_tokens") or 0),
                    "cache_read": int(usage.get("cache_read_input_tokens") or 0),
                }
        merged = {}
        for state in _log_cache.values():
            merged.update(state["seen"])
        return sorted(merged.values(), key=lambda e: e["ts"])


def _totals(entries):
    t = {"input": 0, "output": 0, "cache_write": 0, "cache_read": 0, "messages": len(entries)}
    models = {}
    for e in entries:
        for k in ("input", "output", "cache_write", "cache_read"):
            t[k] += e[k]
        models[e["model"]] = models.get(e["model"], 0) + e["input"] + e["output"] + e["cache_write"]
    # "tokens" leaves out cache reads: re-reading cached context is counted on every
    # turn and would otherwise swamp the figure (often 90%+ of the raw total).
    t["tokens"] = t["input"] + t["output"] + t["cache_write"]
    t["by_model"] = [{"model": m, "tokens": v} for m, v in sorted(models.items(), key=lambda kv: -kv[1])]
    return t


def _official_limits(now):
    try:
        with open(USAGE_FILE) as fh:
            snap = json.load(fh)
        captured = datetime.fromtimestamp(float(snap["captured_at"]), timezone.utc)
    except (OSError, ValueError, KeyError, TypeError):
        return None
    out = {"captured_at": captured.astimezone().isoformat(timespec="seconds"),
           "age_seconds": max(0, int((now - captured).total_seconds()))}
    for key in ("five_hour", "seven_day"):
        win = (snap.get("rate_limits") or {}).get(key) or {}
        if win.get("used_percentage") is None or not win.get("resets_at"):
            continue
        reset = datetime.fromtimestamp(float(win["resets_at"]), timezone.utc)
        out[key] = {
            "used_percentage": float(win["used_percentage"]),
            "resets_at": reset.astimezone().isoformat(timespec="seconds"),
            # Past its reset time the saved percentage no longer applies.
            "expired": now >= reset,
            "_reset": reset,
        }
    return out if ("five_hour" in out or "seven_day" in out) else None


def claude_usage():
    entries = _load_usage_entries()
    now = datetime.now(timezone.utc)
    local = lambda dt: dt.astimezone().isoformat(timespec="seconds")
    limits = _official_limits(now)
    five = (limits or {}).get("five_hour")

    window = None
    if five and not five["expired"]:
        start = five["_reset"] - WINDOW
        # The window opens with its first request, which can be logged a few minutes
        # before the rounded start time implied by resets_at.
        inside = [e for e in entries if e["ts"] >= start - timedelta(minutes=10)]
        window = {"source": "official", "start": local(start), "reset": local(five["_reset"]), **_totals(inside)}
    elif not five:
        # No official data yet: estimate a window from the logs.
        blocks = []
        for e in entries:
            cur = blocks[-1] if blocks else None
            if cur is None or e["ts"] >= cur["start"] + WINDOW or e["ts"] - cur["last"] >= WINDOW:
                cur = {"start": e["ts"].replace(minute=0, second=0, microsecond=0), "entries": []}
                blocks.append(cur)
            cur["entries"].append(e)
            cur["last"] = e["ts"]
        if blocks and now < blocks[-1]["start"] + WINDOW:
            b = blocks[-1]
            window = {"source": "estimate", "start": local(b["start"]), "reset": local(b["start"] + WINDOW),
                      **_totals(b["entries"])}

    if limits:
        for key in ("five_hour", "seven_day"):
            limits.get(key, {}).pop("_reset", None)

    today = datetime.now().astimezone().date()
    days = []
    for offset in range(6, -1, -1):
        day = today - timedelta(days=offset)
        days.append({"date": day.isoformat(),
                     "tokens": _totals([e for e in entries if e["ts"].astimezone().date() == day])["tokens"]})

    return {
        "available": bool(entries) or bool(limits),
        "now": local(now),
        "limits": limits,
        "window": window,
        "today": _totals([e for e in entries if e["ts"].astimezone().date() == today]),
        "days": days,
        "last_message": local(entries[-1]["ts"]) if entries else None,
    }

"""Server status (Linux /proc)."""
import os
import shutil
import threading
import time

from backend.config import DATA, STARTED


# ---------------------------------------------------------------------------
# Server status (Linux /proc)
_cpu_prev = None
_cpu_lock = threading.Lock()


def _cpu_sample():
    with open("/proc/stat") as fh:
        nums = [int(x) for x in fh.readline().split()[1:]]
    return sum(nums), nums[3] + (nums[4] if len(nums) > 4 else 0)


def system_status():
    global _cpu_prev
    out = {"uptime": time.time() - STARTED, "cores": os.cpu_count()}
    try:
        with _cpu_lock:
            if _cpu_prev is None:
                _cpu_prev = _cpu_sample()
                time.sleep(0.25)
            total, idle = _cpu_sample()
            dt, di = total - _cpu_prev[0], idle - _cpu_prev[1]
            if dt > 0:
                _cpu_prev = (total, idle)
                out["cpu"] = round(100 * (1 - di / dt), 1)
        mem = {}
        with open("/proc/meminfo") as fh:
            for line in fh:
                k, v = line.split(":")
                mem[k] = int(v.split()[0]) * 1024
        out["mem_total"] = mem["MemTotal"]
        out["mem_used"] = mem["MemTotal"] - mem.get("MemAvailable", mem.get("MemFree", 0))
        with open("/proc/uptime") as fh:
            out["host_uptime"] = float(fh.read().split()[0])
        out["load"] = os.getloadavg()[0]
    except (OSError, ValueError, KeyError):
        pass
    disk = shutil.disk_usage(DATA)
    out["disk_total"], out["disk_used"] = disk.total, disk.used
    return out

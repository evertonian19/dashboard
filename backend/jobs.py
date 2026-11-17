"""Background housekeeping (hourly)."""
import os
import threading

from backend.config import TRASH_DAYS
from backend.oci import OCI_COST_TTL, OCI_DIR, refresh_oci_cost
from backend.trash import purge_trash


def housekeeping():
    """Hourly: refresh the OCI cost and empty trash older than TRASH_DAYS."""
    while True:
        if os.path.isdir(OCI_DIR):
            refresh_oci_cost()
        try:
            purge_trash(TRASH_DAYS)
        except Exception:
            pass
        threading.Event().wait(OCI_COST_TTL)

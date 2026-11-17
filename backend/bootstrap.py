"""Start-up initialisation: tables, then purge of old trash."""
from backend.config import TRASH_DAYS
from backend.db import init_schema
from backend.trash import purge_trash


def init():
    """Create the data directory and tables, then empty trash older than TRASH_DAYS."""
    init_schema()
    purge_trash(TRASH_DAYS)

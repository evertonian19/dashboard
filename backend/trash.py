"""Trash: deleted files and posts are only marked, then removed for good after TRASH_DAYS."""
import os
from datetime import datetime, timedelta

from backend.config import FILES
from backend.db import db


# ---------------------------------------------------------------------------
# Trash: deleting a file or post only marks it (deleted_at). It can be
# restored for TRASH_DAYS, after which it is removed for good.
def purge_file(conn, row):
    conn.execute("DELETE FROM files WHERE id = ?", (row["id"],))
    try:
        os.remove(os.path.join(FILES, row["id"] + row["ext"]))
    except FileNotFoundError:
        pass


def purge_post(conn, post_id):
    conn.execute("DELETE FROM comments WHERE post_id = ?", (post_id,))
    conn.execute("DELETE FROM posts WHERE id = ?", (post_id,))


def purge_trash(older_than_days=None):
    """Permanently remove trashed items; all of them, or only those older than N days."""
    cutoff = None
    if older_than_days is not None:
        cutoff = (datetime.now().astimezone() - timedelta(days=older_than_days)).isoformat(timespec="seconds")
    where, args = ("deleted_at IS NOT NULL", ()) if cutoff is None else ("deleted_at < ?", (cutoff,))
    with db() as conn:
        for row in conn.execute(f"SELECT id, ext FROM files WHERE {where}", args).fetchall():
            purge_file(conn, row)
        for row in conn.execute(f"SELECT id FROM posts WHERE {where}", args).fetchall():
            purge_post(conn, row["id"])

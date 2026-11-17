"""Main screen: summary, recent activity and search."""
from backend.config import KINDS
from backend.db import db, now_iso


class SummaryMixin:
    """Main screen: summary, recent activity and search."""

    def summary(self):
        with db() as conn:
            counts = {k: {"count": 0, "size": 0} for k in KINDS}
            for row in conn.execute("SELECT kind, COUNT(*) c, COALESCE(SUM(size), 0) s FROM files "
                                    "WHERE deleted_at IS NULL GROUP BY kind"):
                if row["kind"] in counts:
                    counts[row["kind"]] = {"count": row["c"], "size": row["s"]}
            activity = [dict(r) for r in conn.execute(
                "SELECT id, at, action, kind, name FROM activity ORDER BY id DESC LIMIT 8")]
            total = conn.execute("SELECT COUNT(*) FROM activity").fetchone()[0]
            posts = conn.execute("SELECT COUNT(*) FROM posts WHERE deleted_at IS NULL").fetchone()[0]
        self.send_json({"now": now_iso(), "counts": counts, "posts": posts, "activity": activity,
                        "activity_total": total})

    def delete_activity(self, activity_id):
        with db() as conn:
            if activity_id is None:
                conn.execute("DELETE FROM activity")
            else:
                conn.execute("DELETE FROM activity WHERE id = ?", (int(activity_id),))
        self.send_json({"ok": True})

    def search(self, term):
        term = term.strip()
        if not term:
            return self.send_json({"files": [], "posts": []})
        like = "%" + term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        with db() as conn:
            rows = [dict(r) for r in conn.execute(
                "SELECT id, kind, name, ext, size, created_at, title FROM files "
                "WHERE (name LIKE ? ESCAPE '\\' OR title LIKE ? ESCAPE '\\' OR note LIKE ? ESCAPE '\\') "
                "AND deleted_at IS NULL AND kind IN ('diagram', 'document') "
                "ORDER BY created_at DESC LIMIT 20", (like, like, like))]
            posts = [dict(r) for r in conn.execute(
                "SELECT id, title, created_at FROM posts WHERE deleted_at IS NULL AND (title LIKE ? ESCAPE '\\' "
                "OR body_text LIKE ? ESCAPE '\\') ORDER BY created_at DESC LIMIT 20", (like, like))]
        self.send_json({"files": rows, "posts": posts})

"""Settings (Menu 5): config, menu names, home layout, trash, login history."""
import re

from backend.config import KINDS, MAX_UPLOAD, TRASH_DAYS
from backend.db import db, get_setting, one_line, record, set_setting
from backend.pdf import PDF_SOURCES, SOFFICE
from backend.trash import purge_file, purge_post, purge_trash


class SettingsMixin:
    """Settings (Menu 5): config, menu names, home layout, trash, login history."""

    # -- settings, trash, login history ------------------------------------
    def config(self):
        with db() as conn:
            menus = get_setting(conn, "menus", {})
            home = get_setting(conn, "home", {"order": [], "hidden": []})
        self.send_json({"kinds": KINDS, "max_upload": MAX_UPLOAD, "menus": menus, "home": home,
                        "trash_days": TRASH_DAYS, "pdf_sources": PDF_SOURCES if SOFFICE else []})

    def save_home(self):
        """Which main-screen cards are shown and in what order."""
        data = self.read_json()
        if data is None:
            return
        home = {}
        for key in ("order", "hidden"):
            ids = data.get(key)
            if not isinstance(ids, list) or len(ids) > 40 or not all(
                    isinstance(i, str) and re.fullmatch(r"[a-z]{1,20}", i) for i in ids):
                return self.fail(400, "요청 형식이 올바르지 않아요")
            home[key] = list(dict.fromkeys(ids))
        with db() as conn:
            set_setting(conn, "home", home)
        self.send_json({"home": home})

    def save_menus(self):
        data = self.read_json()
        if data is None:
            return
        labels = data.get("labels")
        if not isinstance(labels, dict):
            return self.fail(400, "요청 형식이 올바르지 않아요")
        clean = {}
        for key, value in labels.items():
            name = one_line(value, 20)
            if re.fullmatch(r"menu\d{1,2}", str(key)) and name:
                clean[key] = name
        with db() as conn:
            set_setting(conn, "menus", clean)
        self.send_json({"menus": clean})

    def list_trash(self):
        with db() as conn:
            items = [dict(r) for r in conn.execute(
                "SELECT 'file' AS type, id, name, kind, size, deleted_at FROM files WHERE deleted_at IS NOT NULL "
                "UNION ALL SELECT 'post', id, title, 'post', 0, deleted_at FROM posts WHERE deleted_at IS NOT NULL "
                "ORDER BY deleted_at DESC")]
        self.send_json({"items": items, "keep_days": TRASH_DAYS})

    def restore_trash(self):
        data = self.read_json()
        if data is None:
            return
        table = {"file": "files", "post": "posts"}.get(data.get("type"))
        item_id = str(data.get("id", ""))
        if not table:
            return self.fail(400, "요청 형식이 올바르지 않아요")
        with db() as conn:
            name_col = "name" if table == "files" else "title"
            row = conn.execute(f"SELECT {name_col} AS name, * FROM {table} WHERE id = ? AND deleted_at IS NOT NULL",
                               (item_id,)).fetchone()
            if not row:
                return self.fail(404, "휴지통에 없는 항목이에요")
            conn.execute(f"UPDATE {table} SET deleted_at = NULL WHERE id = ?", (item_id,))
            record(conn, "복구", row["kind"] if table == "files" else "post", row["name"])
        self.send_json({"ok": True})

    def purge_one(self, kind, item_id):
        with db() as conn:
            if kind == "file":
                row = conn.execute("SELECT id, ext FROM files WHERE id = ? AND deleted_at IS NOT NULL",
                                   (item_id,)).fetchone()
                if row:
                    purge_file(conn, row)
            else:
                row = conn.execute("SELECT id FROM posts WHERE id = ? AND deleted_at IS NOT NULL",
                                   (item_id,)).fetchone()
                if row:
                    purge_post(conn, item_id)
        if not row:
            return self.fail(404, "휴지통에 없는 항목이에요")
        self.send_json({"ok": True})

    def empty_trash(self):
        purge_trash()
        self.send_json({"ok": True})

    def list_logins(self):
        with db() as conn:
            rows = [dict(r) for r in conn.execute(
                "SELECT at, ip, username, ok FROM logins ORDER BY id DESC LIMIT 30")]
        self.send_json({"logins": rows})

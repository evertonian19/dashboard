"""Main-screen cards: todos, memos and favourite links."""
import re
import uuid
from datetime import datetime
from urllib.parse import urlparse

from backend.db import db, now_iso, one_line


class TodosMixin:
    """Main-screen cards: todos, memos and favourite links."""

    # -- todos, memos, links ------------------------------------------------
    def delete_row(self, table, row_id):
        with db() as conn:
            done = conn.execute(f"DELETE FROM {table} WHERE id = ?", (row_id,)).rowcount
        if not done:
            return self.fail(404, "이미 삭제됐거나 없는 항목이에요")
        self.send_json({"ok": True})

    def list_todos(self):
        with db() as conn:
            rows = [dict(r) for r in conn.execute(
                "SELECT id, title, due, priority, done, created_at, done_at FROM todos "
                "ORDER BY done, due IS NULL, due, priority DESC, created_at")]
        self.send_json({"todos": rows, "today": datetime.now().strftime("%Y-%m-%d")})

    @staticmethod
    def todo_fields(data, partial):
        """Validated column values from a todo request, or an error string."""
        out = {}
        if "title" in data or not partial:
            out["title"] = one_line(data.get("title"), 200)
            if not out["title"]:
                return "할 일을 입력해 주세요"
        if "due" in data:
            due = str(data.get("due") or "")
            if due and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", due):
                return "날짜 형식이 올바르지 않아요"
            out["due"] = due or None
        if "priority" in data:
            if data.get("priority") not in (0, 1, 2):
                return "우선순위 값이 올바르지 않아요"
            out["priority"] = data["priority"]
        if "done" in data:
            out["done"] = int(bool(data["done"]))
            out["done_at"] = now_iso() if out["done"] else None
        return out

    def create_todo(self):
        data = self.read_json()
        if data is None:
            return
        fields = self.todo_fields(data, partial=False)
        if isinstance(fields, str):
            return self.fail(400, fields)
        row = {"id": uuid.uuid4().hex[:12], "due": None, "priority": 0, "created_at": now_iso(), **fields}
        with db() as conn:
            conn.execute("INSERT INTO todos (id, title, due, priority, created_at) "
                         "VALUES (:id, :title, :due, :priority, :created_at)", row)
        self.send_json({"todo": row}, 201)

    def update_todo(self, todo_id):
        data = self.read_json()
        if data is None:
            return
        fields = self.todo_fields(data, partial=True)
        if isinstance(fields, str):
            return self.fail(400, fields)
        if not fields:
            return self.fail(400, "바꿀 내용이 없어요")
        with db() as conn:
            done = conn.execute(f"UPDATE todos SET {', '.join(k + ' = ?' for k in fields)} WHERE id = ?",
                                (*fields.values(), todo_id)).rowcount
        if not done:
            return self.fail(404, "이미 삭제됐거나 없는 항목이에요")
        self.send_json({"ok": True})

    def list_memos(self):
        with db() as conn:
            rows = [dict(r) for r in conn.execute(
                "SELECT id, body, created_at, updated_at FROM memos ORDER BY created_at DESC, rowid DESC")]
        self.send_json({"memos": rows})

    def memo_body(self):
        data = self.read_json()
        if data is None:
            return None
        body = re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", "", str(data.get("body", ""))).strip()
        if not body:
            return self.fail(400, "메모 내용을 입력해 주세요")
        if len(body) > 5000:
            return self.fail(400, "메모는 5000자까지 쓸 수 있어요")
        return body

    def create_memo(self):
        body = self.memo_body()
        if not body:
            return
        row = {"id": uuid.uuid4().hex[:12], "body": body, "created_at": now_iso(), "updated_at": now_iso()}
        with db() as conn:
            conn.execute("INSERT INTO memos (id, body, created_at, updated_at) "
                         "VALUES (:id, :body, :created_at, :updated_at)", row)
        self.send_json({"memo": row}, 201)

    def update_memo(self, memo_id):
        body = self.memo_body()
        if not body:
            return
        with db() as conn:
            done = conn.execute("UPDATE memos SET body = ?, updated_at = ? WHERE id = ?",
                                (body, now_iso(), memo_id)).rowcount
        if not done:
            return self.fail(404, "이미 삭제됐거나 없는 메모예요")
        self.send_json({"ok": True})

    def list_links(self):
        with db() as conn:
            rows = [dict(r) for r in conn.execute("SELECT id, title, url FROM links ORDER BY created_at, rowid")]
        self.send_json({"links": rows})

    def create_link(self):
        data = self.read_json()
        if data is None:
            return
        url = str(data.get("url", "")).strip()
        if url and not re.match(r"[a-zA-Z][a-zA-Z0-9+.-]*:", url):
            url = "https://" + url
        if not re.fullmatch(r"https?://[^\s\"<>]{1,2000}", url):
            return self.fail(400, "주소를 확인해 주세요 (http 또는 https)")
        title = one_line(data.get("title"), 40) or urlparse(url).hostname or url
        row = {"id": uuid.uuid4().hex[:12], "title": title, "url": url, "created_at": now_iso()}
        with db() as conn:
            conn.execute("INSERT INTO links (id, title, url, created_at) VALUES (:id, :title, :url, :created_at)", row)
        self.send_json({"link": row}, 201)

"""Board (Menu 3): posts, categories, comments."""
import re
import uuid

from backend.db import db, now_iso, one_line, record
from backend.sanitize import MAX_BODY, MAX_CATEGORY, MAX_COMMENT, MAX_TITLE, sanitize_post


class BoardMixin:
    """Board (Menu 3): posts, categories, comments."""

    # -- board ------------------------------------------------------------
    def list_posts(self):
        with db() as conn:
            rows = [dict(r) for r in conn.execute(
                "SELECT p.id, p.title, substr(p.body_text, 1, 160) AS excerpt, p.created_at, "
                "p.pinned, c2.id AS category_id, c2.name AS category, "
                "(SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments "
                "FROM posts p LEFT JOIN categories c2 ON c2.id = p.category_id "
                "WHERE p.deleted_at IS NULL ORDER BY p.created_at DESC, p.rowid DESC")]
        self.send_json({"posts": rows})

    def list_categories(self):
        with db() as conn:
            rows = [dict(r) for r in conn.execute(
                "SELECT c.id, c.name, (SELECT COUNT(*) FROM posts p WHERE p.category_id = c.id AND p.deleted_at IS NULL) AS posts "
                "FROM categories c ORDER BY c.name")]
        self.send_json({"categories": rows})

    @staticmethod
    def category_name(raw):
        return re.sub(r"\s+", " ", re.sub(r"[\x00-\x1f\x7f]", " ", str(raw or ""))).strip()

    @staticmethod
    def category_id(conn, name):
        """Id of the category with this name, creating it if needed."""
        row = conn.execute("SELECT id FROM categories WHERE name = ?", (name,)).fetchone()
        if row:
            return row["id"], False
        new_id = uuid.uuid4().hex[:12]
        conn.execute("INSERT INTO categories (id, name, created_at) VALUES (?, ?, ?)", (new_id, name, now_iso()))
        return new_id, True

    def create_category(self):
        data = self.read_json()
        if data is None:
            return
        name = self.category_name(data.get("name"))
        if not name:
            return self.fail(400, "카테고리 이름을 입력해 주세요")
        if len(name) > MAX_CATEGORY:
            return self.fail(400, f"카테고리 이름은 {MAX_CATEGORY}자까지 쓸 수 있어요")
        with db() as conn:
            cat_id, created = self.category_id(conn, name)
        if not created:
            return self.fail(409, "이미 있는 카테고리예요")
        self.send_json({"category": {"id": cat_id, "name": name, "posts": 0}}, 201)

    def delete_category(self, cat_id):
        with db() as conn:
            if not conn.execute("SELECT 1 FROM categories WHERE id = ?", (cat_id,)).fetchone():
                return self.fail(404, "이미 삭제됐거나 없는 카테고리예요")
            conn.execute("UPDATE posts SET category_id = NULL WHERE category_id = ?", (cat_id,))
            conn.execute("DELETE FROM categories WHERE id = ?", (cat_id,))
        self.send_json({"ok": True})

    def get_post(self, post_id):
        with db() as conn:
            row = conn.execute(
                "SELECT p.id, p.title, p.body, p.created_at, p.updated_at, p.pinned, "
                "c.id AS category_id, c.name AS category "
                "FROM posts p LEFT JOIN categories c ON c.id = p.category_id "
                "WHERE p.id = ? AND p.deleted_at IS NULL",
                (post_id,)).fetchone()
            if not row:
                return self.fail(404, "삭제됐거나 없는 게시글이에요")
            comments = [dict(r) for r in conn.execute(
                "SELECT id, body, created_at FROM comments WHERE post_id = ? "
                "ORDER BY created_at, rowid", (post_id,))]
        self.send_json({"post": dict(row), "comments": comments})

    def post_fields(self):
        """Validated (title, body, text, category) from the request, or None after replying."""
        data = self.read_json()
        if data is None:
            return None
        title = one_line(data.get("title"), MAX_TITLE + 1)
        raw = str(data.get("body", ""))
        category = self.category_name(data.get("category"))
        if not title:
            return self.fail(400, "제목을 입력해 주세요")
        if len(title) > MAX_TITLE:
            return self.fail(400, f"제목은 {MAX_TITLE}자까지 쓸 수 있어요")
        if len(raw) > MAX_BODY:
            return self.fail(413, "본문이 너무 길어요")
        if len(category) > MAX_CATEGORY:
            return self.fail(400, f"카테고리 이름은 {MAX_CATEGORY}자까지 쓸 수 있어요")
        body, text = sanitize_post(raw)
        if not text and "<img" not in body:
            return self.fail(400, "본문을 입력해 주세요")
        return title, body, text, category

    def create_post(self):
        fields = self.post_fields()
        if not fields:
            return
        title, body, text, category = fields
        row = {"id": uuid.uuid4().hex[:12], "title": title, "body": body,
               "body_text": text, "created_at": now_iso(), "category_id": None}
        with db() as conn:
            if category:   # a name that does not exist yet becomes a new category
                row["category_id"] = self.category_id(conn, category)[0]
            conn.execute("INSERT INTO posts (id, title, body, body_text, created_at, category_id) "
                         "VALUES (:id, :title, :body, :body_text, :created_at, :category_id)", row)
            record(conn, "등록", "post", title)
        self.send_json({"post": {k: row[k] for k in ("id", "title", "created_at")}}, 201)

    def update_post(self, post_id):
        fields = self.post_fields()
        if not fields:
            return
        title, body, text, category = fields
        with db() as conn:
            if not conn.execute("SELECT 1 FROM posts WHERE id = ? AND deleted_at IS NULL", (post_id,)).fetchone():
                return self.fail(404, "삭제됐거나 없는 게시글이에요")
            cat_id = self.category_id(conn, category)[0] if category else None
            conn.execute("UPDATE posts SET title = ?, body = ?, body_text = ?, category_id = ?, updated_at = ? "
                         "WHERE id = ?", (title, body, text, cat_id, now_iso(), post_id))
            record(conn, "수정", "post", title)
        self.send_json({"post": {"id": post_id, "title": title}})

    def pin_post(self, post_id):
        data = self.read_json()
        if data is None:
            return
        with db() as conn:
            done = conn.execute("UPDATE posts SET pinned = ? WHERE id = ? AND deleted_at IS NULL",
                                (int(bool(data.get("pinned"))), post_id)).rowcount
        if not done:
            return self.fail(404, "삭제됐거나 없는 게시글이에요")
        self.send_json({"ok": True})

    def delete_post(self, post_id):
        with db() as conn:
            row = conn.execute("SELECT title FROM posts WHERE id = ? AND deleted_at IS NULL", (post_id,)).fetchone()
            if not row:
                return self.fail(404, "이미 삭제됐거나 없는 게시글이에요")
            conn.execute("UPDATE posts SET deleted_at = ?, pinned = 0 WHERE id = ?", (now_iso(), post_id))
            record(conn, "삭제", "post", row["title"])
        self.send_json({"ok": True})

    def create_comment(self, post_id):
        data = self.read_json()
        if data is None:
            return
        body = re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", "", str(data.get("body", ""))).strip()
        if not body:
            return self.fail(400, "댓글 내용을 입력해 주세요")
        if len(body) > MAX_COMMENT:
            return self.fail(400, f"댓글은 {MAX_COMMENT}자까지 쓸 수 있어요")
        row = {"id": uuid.uuid4().hex[:12], "post_id": post_id, "body": body, "created_at": now_iso()}
        with db() as conn:
            post = conn.execute("SELECT title FROM posts WHERE id = ? AND deleted_at IS NULL", (post_id,)).fetchone()
            if not post:
                return self.fail(404, "삭제됐거나 없는 게시글이에요")
            conn.execute("INSERT INTO comments (id, post_id, body, created_at) "
                         "VALUES (:id, :post_id, :body, :created_at)", row)
            record(conn, "등록", "comment", post["title"])
        self.send_json({"comment": row}, 201)

    def delete_comment(self, comment_id):
        with db() as conn:
            row = conn.execute("SELECT c.id, p.title FROM comments c LEFT JOIN posts p ON p.id = c.post_id "
                               "WHERE c.id = ?", (comment_id,)).fetchone()
            if not row:
                return self.fail(404, "이미 삭제됐거나 없는 댓글이에요")
            conn.execute("DELETE FROM comments WHERE id = ?", (comment_id,))
            record(conn, "삭제", "comment", row["title"] or "")
        self.send_json({"ok": True})

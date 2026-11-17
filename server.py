#!/usr/bin/env python3
"""Personal dashboard backend. Standard library only.

    python3 server.py            # http://127.0.0.1:8080

Environment:
    python3 server.py set-login USERNAME   # set or change the login (asks for the password)

    HOST            bind address (default 127.0.0.1 - this machine only)
    PORT            port (default 8080)
    DASHBOARD_DATA  where the database and uploaded files live (default ./data)
    CLAUDE_DIR      Claude Code log directory (default ~/.claude/projects)
    CLAUDE_USAGE_FILE  official limit snapshot written by the Claude Code status line
"""
import getpass
import json
import mimetypes
import os
import re
import secrets
import sys
import threading
import uuid
from datetime import datetime
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, quote, urlparse

from backend.auth import LOGIN_LOCK_SECONDS, LOGIN_MAX_FAILURES, PUBLIC_PATHS, SESSION_TTL, _login_failures, _login_lock, _token_hash, check_login, set_login
from backend.bootstrap import init
from backend.config import DATA, FILES, HOST, INLINE_TYPES, KINDS, LISTED_KINDS, MAX_UPLOAD, PORT, PUBLIC, TRASH_DAYS
from backend.db import db, get_setting, now_iso, one_line, record, set_setting
from backend.filenames import clean_name
from backend.jobs import housekeeping
from backend.mail import MAIL_PROVIDERS, _mail_lock, _mail_state, check_account, fetch_mail, fetch_mail_body, load_accounts, mail_error, mail_overview, mail_poller, save_accounts
from backend.oci import oci_status
from backend.pdf import PDF_SOURCES, SOFFICE, convert_to_pdf
from backend.sanitize import MAX_BODY, MAX_CATEGORY, MAX_COMMENT, MAX_JSON, MAX_TITLE, sanitize_post
from backend.system import system_status
from backend.trash import purge_file, purge_post, purge_trash
from backend.usage import claude_usage
from backend.weather import DEFAULT_CITY, geocode, weather


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    server_version = "Dashboard"
    protocol_version = "HTTP/1.1"

    def log_message(self, *args):
        pass

    # -- helpers ----------------------------------------------------------
    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def fail(self, status, message):
        self.close_connection = True
        self.send_json({"error": message}, status)

    def send_path(self, path, content_type, extra=None):
        size = os.path.getsize(path)
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(size))
        self.send_header("X-Content-Type-Options", "nosniff")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        with open(path, "rb") as fh:
            while chunk := fh.read(1 << 16):
                self.wfile.write(chunk)

    def trusted_write(self):
        """Browsers cannot add this header cross-site without a CORS preflight,
        which this server never grants, so other websites cannot upload or delete."""
        return self.headers.get("X-Requested-With") == "dashboard"

    # -- routing ----------------------------------------------------------
    def do_GET(self):
        url = urlparse(self.path)
        q = parse_qs(url.query)
        path = url.path
        try:
            expires = self.session()
            if path == "/api/session":
                return self.send_json({"authenticated": bool(expires), "expires": expires})
            if not expires:
                if path.startswith("/api/"):
                    return self.fail(401, "로그인이 필요해요")
                if path not in PUBLIC_PATHS:
                    return self.redirect("/login.html")
            elif path == "/login.html":
                return self.redirect("/")
            simple = {
                "/api/config": self.config, "/api/summary": self.summary,
                "/api/categories": self.list_categories, "/api/posts": self.list_posts,
                "/api/todos": self.list_todos, "/api/memos": self.list_memos,
                "/api/links": self.list_links, "/api/trash": self.list_trash,
                "/api/logins": self.list_logins, "/api/weather": self.get_weather,
                "/api/mail": lambda: self.send_json(mail_overview()),
                "/api/claude-usage": lambda: self.send_json(claude_usage()),
                "/api/oci": lambda: self.send_json(oci_status()),
                "/api/system": lambda: self.send_json(system_status()),
                "/api/files": lambda: self.list_files(q.get("kind", [""])[0]),
                "/api/search": lambda: self.search(q.get("q", [""])[0]),
            }
            if path in simple:
                return simple[path]()
            m = re.fullmatch(r"/api/posts/([0-9a-f]{12})", path)
            if m:
                return self.get_post(m.group(1))
            m = re.fullmatch(r"/api/files/([0-9a-f]{12})/raw", path)
            if m:
                return self.raw_file(m.group(1), "download" in q)
            m = re.fullmatch(r"/api/mail/([0-9a-f]{12})/message", path)
            if m:
                return self.mail_message(m.group(1), q.get("uid", [""])[0])
            if path.startswith("/api/"):
                return self.fail(404, "없는 주소예요")
            return self.static(path)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as exc:  # keep the server alive, report the failure
            self.fail(500, f"서버 오류: {exc}")

    def dispatch(self, routes):
        """Run the handler of the first matching route. Writes need the custom
        header (see trusted_write) and, unless the route is open, a session."""
        url = urlparse(self.path)
        for pattern, handler, *is_open in routes:
            m = re.fullmatch(pattern.replace("ID", "([0-9a-f]{12})"), url.path)
            if not m:
                continue
            if not self.trusted_write():
                return self.fail(403, "허용되지 않은 요청이에요")
            try:
                if not is_open and not self.session():
                    return self.fail(401, "로그인이 필요해요")
                return handler(*m.groups())
            except (BrokenPipeError, ConnectionResetError):
                return None
            except Exception as exc:
                return self.fail(500, f"서버 오류: {exc}")
        return self.fail(404, "없는 주소예요")

    def do_POST(self):
        self.dispatch([
            ("/api/login", self.login, True), ("/api/logout", self.logout, True),
            ("/api/files", lambda: self.upload(parse_qs(urlparse(self.path).query))),
            ("/api/files/ID/meta", self.save_file_meta), ("/api/files/ID/pdf", self.file_to_pdf),
            ("/api/posts", self.create_post), ("/api/posts/ID", self.update_post),
            ("/api/posts/ID/pin", self.pin_post), ("/api/posts/ID/comments", self.create_comment),
            ("/api/categories", self.create_category),
            ("/api/mail/accounts", self.add_mail_account), ("/api/mail/refresh", self.refresh_mail),
            ("/api/todos", self.create_todo), ("/api/todos/ID", self.update_todo),
            ("/api/memos", self.create_memo), ("/api/memos/ID", self.update_memo),
            ("/api/links", self.create_link),
            ("/api/settings/menus", self.save_menus), ("/api/settings/weather", self.save_weather),
            ("/api/settings/home", self.save_home),
            ("/api/trash/restore", self.restore_trash),
        ])

    def do_DELETE(self):
        self.dispatch([
            ("/api/files/ID", self.delete_file), ("/api/posts/ID", self.delete_post),
            ("/api/comments/ID", self.delete_comment), ("/api/mail/ID", self.delete_mail_account),
            ("/api/categories/ID", self.delete_category),
            ("/api/todos/ID", lambda i: self.delete_row("todos", i)),
            ("/api/memos/ID", lambda i: self.delete_row("memos", i)),
            ("/api/links/ID", lambda i: self.delete_row("links", i)),
            ("/api/activity", lambda: self.delete_activity(None)),
            (r"/api/activity/(\d{1,12})", self.delete_activity),
            ("/api/trash", self.empty_trash), ("/api/trash/(file|post)/ID", self.purge_one),
        ])

    # -- login ------------------------------------------------------------
    def session(self):
        """Expiry (epoch seconds) of the caller's session, or None."""
        morsel = SimpleCookie(self.headers.get("Cookie", "")).get("session")
        if not morsel:
            return None
        with db() as conn:
            row = conn.execute("SELECT expires FROM sessions WHERE token_hash = ?",
                               (_token_hash(morsel.value),)).fetchone()
        return row["expires"] if row and row["expires"] > datetime.now().timestamp() else None

    def redirect(self, location):
        self.send_response(302)
        self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def send_json_cookie(self, payload, cookie):
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(body)

    def login(self):
        data = self.read_json()
        if data is None:
            return
        now = datetime.now().timestamp()
        with _login_lock:
            _login_failures[:] = [t for t in _login_failures if now - t < LOGIN_LOCK_SECONDS]
            locked = len(_login_failures) >= LOGIN_MAX_FAILURES
        if locked:
            return self.fail(429, "로그인 시도가 너무 많아요. 5분 뒤에 다시 시도해 주세요.")
        username = str(data.get("username", ""))
        ok = check_login(username, str(data.get("password", "")))
        with db() as conn:
            conn.execute("INSERT INTO logins (at, ip, username, ok) VALUES (?, ?, ?, ?)",
                         (now_iso(), self.client_address[0], one_line(username, 64), int(ok)))
            conn.execute("DELETE FROM logins WHERE id <= (SELECT MAX(id) FROM logins) - 500")
        if not ok:
            with _login_lock:
                _login_failures.append(now)
            return self.fail(401, "아이디 또는 비밀번호가 맞지 않아요")
        token = secrets.token_urlsafe(32)
        expires = now + SESSION_TTL
        with db() as conn:
            conn.execute("DELETE FROM sessions WHERE expires < ?", (now,))
            conn.execute("INSERT INTO sessions (token_hash, expires) VALUES (?, ?)", (_token_hash(token), expires))
        self.send_json_cookie({"ok": True, "expires": expires},
                              f"session={token}; Path=/; Max-Age={SESSION_TTL}; HttpOnly; SameSite=Strict")

    def logout(self):
        self.rfile.read(min(int(self.headers.get("Content-Length") or 0), MAX_JSON))
        morsel = SimpleCookie(self.headers.get("Cookie", "")).get("session")
        if morsel:
            with db() as conn:
                conn.execute("DELETE FROM sessions WHERE token_hash = ?", (_token_hash(morsel.value),))
        self.send_json_cookie({"ok": True}, "session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict")

    def read_json(self):
        """Parsed JSON object from the request body, or None after replying with an error."""
        try:
            length = int(self.headers.get("Content-Length", ""))
        except ValueError:
            length = -1
        if length < 0 or length > MAX_JSON:
            self.fail(413, "내용이 너무 길어요")
            return None
        try:
            data = json.loads(self.rfile.read(length))
        except ValueError:
            data = None
        if not isinstance(data, dict):
            self.fail(400, "요청 형식이 올바르지 않아요")
            return None
        return data

    # -- endpoints --------------------------------------------------------
    def static(self, path):
        rel = "index.html" if path in ("", "/") else path.lstrip("/")
        full = os.path.realpath(os.path.join(PUBLIC, rel))
        if not full.startswith(PUBLIC + os.sep) or not os.path.isfile(full):
            return self.fail(404, "없는 주소예요")
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype.endswith(("javascript", "json")):
            ctype += "; charset=utf-8"
        self.send_path(full, ctype, {"Cache-Control": "no-cache"})

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

    def list_files(self, kind):
        if kind not in KINDS:
            return self.fail(400, "kind 값이 올바르지 않아요")
        with db() as conn:
            rows = [dict(r) for r in conn.execute(
                "SELECT id, kind, name, ext, size, created_at, title, note FROM files "
                "WHERE kind = ? AND deleted_at IS NULL "
                "ORDER BY created_at DESC, rowid DESC", (kind,))]
        self.send_json({"files": rows})

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

    # -- mail -------------------------------------------------------------
    def add_mail_account(self):
        data = self.read_json()
        if data is None:
            return
        provider = str(data.get("provider", ""))
        address = str(data.get("email", "")).strip()
        password = str(data.get("password", ""))
        if provider not in MAIL_PROVIDERS:
            return self.fail(400, "메일 종류를 선택해 주세요")
        if not re.fullmatch(r"[^@\s]{1,64}@[^@\s]{1,190}", address):
            return self.fail(400, "메일 주소를 확인해 주세요")
        if provider == "gmail":
            password = password.replace(" ", "")   # Google shows app passwords in 4-letter groups
        if not password or len(password) > 200:
            return self.fail(400, "앱 비밀번호를 입력해 주세요")
        accounts = load_accounts()
        if any(a["email"].lower() == address.lower() for a in accounts):
            return self.fail(409, "이미 등록된 계정이에요")
        account = {"id": uuid.uuid4().hex[:12], "provider": provider, "email": address, "password": password}
        try:
            result = fetch_mail(account)   # only save accounts that actually log in
        except Exception as exc:
            return self.fail(400, mail_error(exc))
        with _mail_lock:
            _mail_state[account["id"]] = {**result, "error": None, "checked_at": now_iso()}
        save_accounts(accounts + [account])
        with db() as conn:
            record(conn, "등록", "mail", address)
        self.send_json(mail_overview(), 201)

    def delete_mail_account(self, account_id):
        accounts = load_accounts()
        gone = [a for a in accounts if a["id"] == account_id]
        if not gone:
            return self.fail(404, "이미 삭제됐거나 없는 계정이에요")
        save_accounts([a for a in accounts if a["id"] != account_id])
        with _mail_lock:
            _mail_state.pop(account_id, None)
        with db() as conn:
            record(conn, "삭제", "mail", gone[0]["email"])
        self.send_json({"ok": True})

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

    def upload(self, q):
        kind = q.get("kind", [""])[0]
        name = clean_name(q.get("name", [""])[0])
        ext = os.path.splitext(name)[1].lower()
        try:
            length = int(self.headers.get("Content-Length", ""))
        except ValueError:
            return self.fail(411, "파일 크기를 알 수 없어요")
        if kind not in KINDS:
            return self.fail(400, "kind 값이 올바르지 않아요")
        if not name or ext not in KINDS[kind]["ext"]:
            allowed = " ".join(e.lstrip(".") for e in KINDS[kind]["ext"])
            return self.fail(415, f"등록할 수 없는 형식이에요. 가능한 형식: {allowed}")
        if length <= 0:
            return self.fail(400, "빈 파일은 등록할 수 없어요")
        if length > MAX_UPLOAD:
            return self.fail(413, f"파일이 너무 커요 (최대 {MAX_UPLOAD // 1024 // 1024}MB)")

        file_id = uuid.uuid4().hex[:12]
        final = os.path.join(FILES, file_id + ext)
        tmp = final + ".part"
        remaining = length
        try:
            with open(tmp, "wb") as fh:
                while remaining:
                    chunk = self.rfile.read(min(remaining, 1 << 16))
                    if not chunk:
                        raise ConnectionError("upload interrupted")
                    fh.write(chunk)
                    remaining -= len(chunk)
            os.replace(tmp, final)
        except Exception:
            if os.path.exists(tmp):
                os.remove(tmp)
            raise
        row = {"id": file_id, "kind": kind, "name": name, "ext": ext, "size": length, "created_at": now_iso()}
        with db() as conn:
            conn.execute("INSERT INTO files (id, kind, name, ext, size, created_at) "
                         "VALUES (:id, :kind, :name, :ext, :size, :created_at)", row)
            if kind in LISTED_KINDS:
                record(conn, "등록", kind, name)
        self.send_json({"file": row}, 201)

    def save_file_meta(self, file_id):
        """Title and description shown for an architecture entry (Menu 2)."""
        data = self.read_json()
        if data is None:
            return
        title = one_line(data.get("title"), MAX_TITLE)
        note = re.sub(r"[\x00-\x08\x0b-\x1f\x7f]", "", str(data.get("note") or "")).strip()
        if len(note) > 20000:
            return self.fail(400, "설명이 너무 길어요")
        with db() as conn:
            row = conn.execute("SELECT name FROM files WHERE id = ? AND deleted_at IS NULL", (file_id,)).fetchone()
            if not row:
                return self.fail(404, "삭제됐거나 없는 파일이에요")
            conn.execute("UPDATE files SET title = ?, note = ? WHERE id = ?", (title or None, note or None, file_id))
        self.send_json({"ok": True, "title": title or None, "note": note or None})

    def file_to_pdf(self, file_id):
        """Convert a registered document and register the PDF next to it."""
        self.rfile.read(min(int(self.headers.get("Content-Length") or 0), MAX_JSON))
        with db() as conn:
            row = conn.execute("SELECT * FROM files WHERE id = ? AND deleted_at IS NULL AND kind = 'document'",
                               (file_id,)).fetchone()
        source = os.path.join(FILES, file_id + row["ext"]) if row else ""
        if not row or not os.path.isfile(source):
            return self.fail(404, "파일을 찾을 수 없어요")
        if row["ext"] not in PDF_SOURCES:
            return self.fail(415, "이 형식은 PDF로 변환할 수 없어요")
        new_id = uuid.uuid4().hex[:12]
        target = os.path.join(FILES, new_id + ".pdf")
        try:
            convert_to_pdf(source, row["ext"], target)
        except RuntimeError as exc:
            return self.fail(422, str(exc))
        name = clean_name(os.path.splitext(row["name"])[0] + ".pdf")
        new = {"id": new_id, "kind": "document", "name": name, "ext": ".pdf",
               "size": os.path.getsize(target), "created_at": now_iso()}
        with db() as conn:
            conn.execute("INSERT INTO files (id, kind, name, ext, size, created_at) "
                         "VALUES (:id, :kind, :name, :ext, :size, :created_at)", new)
            record(conn, "변환", "document", name)
        self.send_json({"file": new}, 201)

    def delete_file(self, file_id):
        with db() as conn:
            row = conn.execute("SELECT * FROM files WHERE id = ? AND deleted_at IS NULL", (file_id,)).fetchone()
            if not row:
                return self.fail(404, "이미 삭제됐거나 없는 파일이에요")
            conn.execute("UPDATE files SET deleted_at = ? WHERE id = ?", (now_iso(), file_id))
            record(conn, "삭제", row["kind"], row["name"])
        self.send_json({"ok": True})

    def raw_file(self, file_id, download):
        with db() as conn:
            row = conn.execute("SELECT * FROM files WHERE id = ? AND deleted_at IS NULL", (file_id,)).fetchone()
        path = os.path.join(FILES, file_id + row["ext"]) if row else ""
        if not row or not os.path.isfile(path):
            return self.fail(404, "파일을 찾을 수 없어요")
        inline = row["ext"] in INLINE_TYPES and not download
        ctype = INLINE_TYPES[row["ext"]] if inline else "application/octet-stream"
        disposition = "inline" if inline else "attachment"
        headers = {
            "Content-Disposition": f"{disposition}; filename*=UTF-8''{quote(row['name'])}",
            "Cache-Control": "no-cache",
        }
        if not (inline and row["ext"] == ".pdf"):
            # Uploaded content must never run as a page on this origin. (The browser's
            # PDF viewer refuses to open inside a sandbox, and PDFs cannot script the page.)
            headers["Content-Security-Policy"] = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:"
        self.send_path(path, ctype, headers)

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

    # -- weather ----------------------------------------------------------
    def get_weather(self):
        with db() as conn:
            city = get_setting(conn, "weather_city", DEFAULT_CITY)
        try:
            self.send_json(weather(city))
        except Exception as exc:
            self.send_json({"city": city["name"], "error": f"날씨를 가져오지 못했어요 ({exc})"})

    def save_weather(self):
        data = self.read_json()
        if data is None:
            return
        name = one_line(data.get("city"), 40)
        if not name:
            return self.fail(400, "도시 이름을 입력해 주세요")
        try:
            city = geocode(name)
        except Exception as exc:
            return self.fail(502, f"도시를 찾는 중 오류가 났어요 ({exc})")
        if not city:
            return self.fail(404, f"'{name}' 도시를 찾지 못했어요")
        with db() as conn:
            set_setting(conn, "weather_city", city)
        self.get_weather()

    # -- mail body --------------------------------------------------------
    def refresh_mail(self):
        self.rfile.read(min(int(self.headers.get("Content-Length") or 0), MAX_JSON))
        for account in load_accounts():
            check_account(account)
        self.send_json(mail_overview())

    def mail_message(self, account_id, uid):
        account = next((a for a in load_accounts() if a["id"] == account_id), None)
        if not account or not uid.isdigit():
            return self.fail(404, "메일을 찾을 수 없어요")
        try:
            self.send_json({"text": fetch_mail_body(account, uid)})
        except LookupError as exc:
            self.fail(404, str(exc))
        except Exception as exc:
            self.fail(502, mail_error(exc))

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


if __name__ == "__main__":
    if sys.argv[1:2] == ["set-login"]:
        if len(sys.argv) != 3 or not sys.argv[2].strip():
            sys.exit("usage: python3 server.py set-login USERNAME")
        first = getpass.getpass("새 비밀번호: ")
        if not first or first != getpass.getpass("한 번 더: "):
            sys.exit("비밀번호가 비어 있거나 서로 달라요. 바뀌지 않았습니다.")
        set_login(sys.argv[2].strip(), first)
        sys.exit(f"로그인 계정을 {sys.argv[2].strip()} (으)로 설정했어요. 기존 로그인은 모두 해제됩니다.")
    init()
    threading.Thread(target=mail_poller, daemon=True).start()
    threading.Thread(target=housekeeping, daemon=True).start()
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    httpd.daemon_threads = True
    print(f"dashboard: http://{HOST}:{PORT}  (data: {DATA})", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass

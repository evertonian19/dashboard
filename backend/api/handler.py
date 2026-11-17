"""HTTP handler: routing, login/session and static files. Features live in the mixins."""
import json
import mimetypes
import os
import re
import secrets
import uuid
from datetime import datetime
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

from backend.api.board import BoardMixin
from backend.api.files import FilesMixin
from backend.api.todos import TodosMixin
from backend.auth import LOGIN_LOCK_SECONDS, LOGIN_MAX_FAILURES, PUBLIC_PATHS, SESSION_TTL, _login_failures, _login_lock, _token_hash, check_login
from backend.config import KINDS, MAX_UPLOAD, PUBLIC, TRASH_DAYS
from backend.db import db, get_setting, now_iso, one_line, record, set_setting
from backend.mail import MAIL_PROVIDERS, _mail_lock, _mail_state, check_account, fetch_mail, fetch_mail_body, load_accounts, mail_error, mail_overview, save_accounts
from backend.oci import oci_status
from backend.pdf import PDF_SOURCES, SOFFICE
from backend.sanitize import MAX_JSON
from backend.system import system_status
from backend.trash import purge_file, purge_post, purge_trash
from backend.usage import claude_usage
from backend.weather import DEFAULT_CITY, geocode, weather


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------
class Handler(BoardMixin, FilesMixin, TodosMixin, BaseHTTPRequestHandler):
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

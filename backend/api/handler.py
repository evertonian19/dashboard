"""HTTP handler: routing, login/session and static files. Features live in the mixins."""
import json
import mimetypes
import os
import re
import secrets
from datetime import datetime
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse

from backend.api.board import BoardMixin
from backend.api.files import FilesMixin
from backend.api.mail import MailMixin
from backend.api.settings import SettingsMixin
from backend.api.summary import SummaryMixin
from backend.api.todos import TodosMixin
from backend.api.weather import WeatherMixin
from backend.auth import LOGIN_LOCK_SECONDS, LOGIN_MAX_FAILURES, SESSION_TTL, _login_failures, _login_lock, _token_hash, check_login, is_public
from backend.config import PUBLIC
from backend.db import db, now_iso, one_line
from backend.mail import mail_overview
from backend.everton import everton_overview
from backend.markets import market_overview, rail_rates
from backend.oci import oci_status
from backend.sanitize import MAX_JSON
from backend.system import system_status
from backend.usage import claude_usage


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------
class Handler(BoardMixin, FilesMixin, TodosMixin, MailMixin, SettingsMixin, WeatherMixin, SummaryMixin, BaseHTTPRequestHandler):
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
                if not is_public(path):
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
                "/api/markets": lambda: self.send_json(market_overview()),
                "/api/rates": lambda: self.send_json(rail_rates()),
                "/api/everton": lambda: self.send_json(everton_overview()),
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

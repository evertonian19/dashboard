#!/usr/bin/env python3
"""API smoke test (standard library only).

Runs a fixed sequence of requests against a dashboard server and prints a
normalised transcript (ids, timestamps and other volatile values replaced), so
two runs can be compared with `diff` — e.g. before and after a refactor.

    DASHBOARD_DATA=/tmp/dash-test PORT=8102 python3 server.py &      # throw-away data dir!
    python3 tests/smoke_api.py http://127.0.0.1:8102 USER PASSWORD > out.txt

The account must already exist (see `python3 server.py set-login USER`).
Never point this at a data directory you care about: it creates and deletes
posts, todos, files and so on.
"""
import http.client
import json
import re
import sys
from urllib.parse import urlparse

HEX_ID = re.compile(r"\b[0-9a-f]{12}\b")
TIMESTAMP = re.compile(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:[+-]\d\d:\d\d|Z)?")
PNG = bytes.fromhex("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360f8cfc0000003010100c9fe92ef0000000049454e44ae426082")

ids = {}


def norm_text(text):
    text = TIMESTAMP.sub("<ts>", text)

    def swap(m):
        return "<id%d>" % ids.setdefault(m.group(0), len(ids) + 1)
    return HEX_ID.sub(swap, text)


def shape(value):
    """Structure only: keys and value types. For endpoints whose values change from run to run."""
    if isinstance(value, dict):
        return {k: shape(v) for k, v in sorted(value.items())}
    if isinstance(value, list):
        return [shape(value[0])] if value else []
    return type(value).__name__ if value is not None else None


def scrub(value):
    """Drop epoch-style numbers (session expiry etc.)."""
    if isinstance(value, dict):
        return {k: scrub(v) for k, v in value.items()}
    if isinstance(value, list):
        return [scrub(v) for v in value]
    if isinstance(value, float) and value > 1e9:
        return "<epoch>"
    return value


class Client:
    def __init__(self, base):
        u = urlparse(base)
        self.host, self.port = u.hostname, u.port
        self.cookie = ""

    def call(self, method, path, body=None, raw=None, headers=None, volatile=False, note=""):
        conn = http.client.HTTPConnection(self.host, self.port, timeout=30)
        hdrs = {"X-Requested-With": "dashboard"}
        if self.cookie:
            hdrs["Cookie"] = self.cookie
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            hdrs["Content-Type"] = "application/json"
        if raw is not None:
            data = raw
        hdrs.update(headers or {})
        conn.request(method, path, body=data, headers=hdrs)
        resp = conn.getresponse()
        payload = resp.read()
        set_cookie = resp.getheader("Set-Cookie")
        if set_cookie and "session=" in set_cookie:
            value = set_cookie.split(";")[0]
            self.cookie = "" if value == "session=" else value
        ctype = (resp.getheader("Content-Type") or "").split(";")[0]
        loc = resp.getheader("Location")
        line = f"{method} {norm_text(path)}{' # ' + note if note else ''} -> {resp.status} {ctype}"
        if loc:
            line += f" -> {loc}"
        print(line)
        parsed = None
        if ctype == "application/json":
            try:
                parsed = json.loads(payload)
            except ValueError:
                parsed = None
        if parsed is not None:
            parsed = shape(parsed) if volatile else scrub(parsed)
            print("   " + norm_text(json.dumps(parsed, ensure_ascii=False, sort_keys=True)))
        else:
            print(f"   <{len(payload)} bytes>")
        conn.close()
        return resp.status, parsed, payload


def main():
    base, user, password = sys.argv[1:4]
    c = Client(base)

    # --- before login -------------------------------------------------------
    c.call("GET", "/", note="unauthenticated page")
    c.call("GET", "/api/posts", note="unauthenticated api")
    c.call("GET", "/api/session")
    c.call("GET", "/login.html")
    c.call("GET", "/css/style.css")
    c.call("GET", "/js/login.js")
    c.call("GET", "/js/app.js", note="private script")
    c.call("POST", "/api/login", {"username": user, "password": "wrong"})
    c.call("POST", "/api/posts", {"title": "x", "body": "x"}, headers={"X-Requested-With": "other"}, note="missing header")
    status, _, _ = c.call("POST", "/api/login", {"username": user, "password": password})
    assert status == 200, "login failed"
    c.call("GET", "/api/session")
    c.call("GET", "/", note="authenticated page")
    c.call("GET", "/login.html", note="authenticated login page")
    c.call("GET", "/nope", note="static 404")
    c.call("GET", "/api/nope", note="api 404")

    # --- config / settings ----------------------------------------------------
    c.call("GET", "/api/config")
    c.call("POST", "/api/settings/menus", {"labels": {"menu1": "홈", "menu3": "게시판", "bad": "x"}})
    c.call("POST", "/api/settings/menus", {"labels": "oops"})
    c.call("POST", "/api/settings/home", {"order": ["links", "todos"], "hidden": ["weather"]})
    c.call("POST", "/api/settings/home", {"order": ["BAD!"], "hidden": []})
    c.call("GET", "/api/config")

    # --- board -----------------------------------------------------------------
    c.call("POST", "/api/categories", {"name": "공지"})
    c.call("POST", "/api/categories", {"name": "공지"}, note="duplicate")
    c.call("POST", "/api/categories", {"name": ""}, note="empty")
    _, cats, _ = c.call("GET", "/api/categories")
    cat_id = cats["categories"][0]["id"]
    body = '<p style="color:red;position:fixed" onclick="x()">안녕 <b>굵게</b><script>alert(1)</script><a href="javascript:x()">link</a><a href="https://example.com">ok</a></p>'
    _, post, _ = c.call("POST", "/api/posts", {"title": "첫 글", "body": body, "category": "공지"})
    post_id = (post.get("post") or post).get("id")
    c.call("POST", "/api/posts", {"title": "", "body": "x"}, note="empty title")
    c.call("GET", "/api/posts")
    c.call("GET", f"/api/posts/{post_id}")
    c.call("POST", f"/api/posts/{post_id}", {"title": "수정한 글", "body": "<p>수정</p>", "category": ""})
    c.call("POST", f"/api/posts/{post_id}/pin", {"pinned": True})
    _, comment, _ = c.call("POST", f"/api/posts/{post_id}/comments", {"body": "댓글 <b>x</b>"})
    comment_id = (comment.get("comment") or comment).get("id")
    c.call("GET", f"/api/posts/{post_id}")
    c.call("GET", "/api/search?q=%EC%88%98%EC%A0%95")
    c.call("DELETE", f"/api/comments/{comment_id}")
    c.call("GET", "/api/categories")
    c.call("DELETE", f"/api/categories/{cat_id}")
    c.call("DELETE", f"/api/posts/{post_id}")
    c.call("GET", "/api/trash")
    c.call("POST", "/api/trash/restore", {"type": "post", "id": post_id})
    c.call("GET", f"/api/posts/{post_id}")
    c.call("DELETE", f"/api/posts/{post_id}")
    c.call("DELETE", f"/api/trash/post/{post_id}")

    # --- todos / memos / links ---------------------------------------------------
    _, todo, _ = c.call("POST", "/api/todos", {"title": "할 일", "due": "2030-01-01", "priority": 2})
    todo_id = (todo.get("todo") or todo).get("id")
    c.call("POST", "/api/todos", {"title": "", "priority": 9}, note="invalid")
    c.call("POST", f"/api/todos/{todo_id}", {"done": True})
    c.call("GET", "/api/todos", volatile=False)
    c.call("DELETE", f"/api/todos/{todo_id}")
    c.call("DELETE", f"/api/todos/{todo_id}", note="already gone")
    _, memo, _ = c.call("POST", "/api/memos", {"body": "메모 내용"})
    memo_id = (memo.get("memo") or memo).get("id")
    c.call("POST", f"/api/memos/{memo_id}", {"body": "메모 수정"})
    c.call("GET", "/api/memos")
    c.call("DELETE", f"/api/memos/{memo_id}")
    c.call("POST", "/api/links", {"title": "예시", "url": "example.com"})
    c.call("POST", "/api/links", {"title": "나쁨", "url": "javascript:alert(1)"}, note="bad url")
    _, links, _ = c.call("GET", "/api/links")
    for link in links["links"]:
        c.call("DELETE", f"/api/links/{link['id']}")

    # --- files / trash -----------------------------------------------------------------
    c.call("POST", "/api/files?kind=diagram&name=a.png", raw=PNG, headers={"Content-Type": "application/octet-stream"})
    c.call("POST", "/api/files?kind=diagram&name=a.exe", raw=b"MZ", headers={"Content-Type": "application/octet-stream"}, note="bad ext")
    c.call("POST", "/api/files?kind=nope&name=a.png", raw=PNG, headers={"Content-Type": "application/octet-stream"}, note="bad kind")
    _, files, _ = c.call("GET", "/api/files?kind=diagram")
    file_id = files["files"][0]["id"]
    c.call("POST", f"/api/files/{file_id}/meta", {"title": "그림", "note": "설명"})
    c.call("GET", "/api/files?kind=diagram")
    c.call("GET", f"/api/files/{file_id}/raw")
    c.call("GET", f"/api/files/{file_id}/raw?download=1")
    c.call("GET", "/api/search?q=%EA%B7%B8%EB%A6%BC")
    c.call("DELETE", f"/api/files/{file_id}")
    c.call("GET", "/api/trash")
    c.call("POST", "/api/trash/restore", {"type": "file", "id": file_id})
    c.call("GET", f"/api/files/{file_id}/raw", note="restored")
    c.call("DELETE", f"/api/files/{file_id}")
    c.call("DELETE", f"/api/trash/file/{file_id}")
    c.call("GET", "/api/trash")
    c.call("DELETE", "/api/trash")

    # --- mail (no network: only validation paths) ---------------------------------------
    c.call("GET", "/api/mail")
    c.call("POST", "/api/mail/accounts", {"provider": "nope", "email": "a@b.c", "password": "x"}, note="bad provider")
    c.call("POST", "/api/mail/refresh", {})

    # --- activity / history / summary ------------------------------------------------------
    c.call("GET", "/api/summary", volatile=True)
    c.call("DELETE", "/api/activity")
    c.call("GET", "/api/logins", volatile=True)

    # --- machine-dependent endpoints: structure only -----------------------------------------
    for path in ("/api/system", "/api/oci", "/api/claude-usage", "/api/weather"):
        c.call("GET", path, volatile=True)

    # --- logout ----------------------------------------------------------------------------------
    c.call("POST", "/api/logout", {})
    c.call("GET", "/api/posts", note="after logout")


if __name__ == "__main__":
    main()

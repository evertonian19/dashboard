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
import sys
import threading
from http.server import ThreadingHTTPServer

from backend import ios_app
from backend.api.handler import Handler
from backend.auth import set_login
from backend.bootstrap import init
from backend.config import DATA, HOST, PORT
from backend.jobs import housekeeping
from backend.mail import mail_poller


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
    threading.Thread(target=ios_app.warm, daemon=True).start()
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    httpd.daemon_threads = True
    print(f"dashboard: http://{HOST}:{PORT}  (data: {DATA})", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass

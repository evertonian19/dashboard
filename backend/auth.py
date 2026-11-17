"""Login: one account, salted PBKDF2 hash, random session cookies."""
import hashlib
import hmac
import json
import os
import posixpath
import secrets
import threading

from backend.bootstrap import init
from backend.config import DATA
from backend.db import db


# ---------------------------------------------------------------------------
# Login
#
# One account, stored as a salted PBKDF2 hash in AUTH_FILE (owner-only).
# A successful login issues a random session cookie valid for SESSION_TTL;
# only its SHA-256 is kept in the database. Without a session every page
# redirects to /login.html and every API call answers 401.
AUTH_FILE = os.path.join(DATA, "auth.json")
SESSION_TTL = 6 * 3600
PUBLIC_PATHS = {"/login.html", "/js/login.js"}   # plus every stylesheet under /css/ (see is_public)
LOGIN_MAX_FAILURES, LOGIN_LOCK_SECONDS = 5, 300
_login_failures = []
_login_lock = threading.Lock()


def is_public(path):
    """Files the login screen needs before anyone is signed in: the page, its script and the
    stylesheets. A path with dot segments is never public, so "/css/../js/main.js" cannot
    slip a private file past the session check."""
    if posixpath.normpath(path) != path:
        return False
    return path in PUBLIC_PATHS or (path.startswith("/css/") and path.endswith(".css"))


def _hash_password(password, salt):
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 300_000).hex()


def set_login(username, password):
    os.makedirs(DATA, exist_ok=True)
    salt = secrets.token_bytes(16)
    tmp = AUTH_FILE + ".tmp"
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as fh:
        json.dump({"username": username, "salt": salt.hex(), "hash": _hash_password(password, salt)}, fh)
    os.replace(tmp, AUTH_FILE)
    init()
    with db() as conn:
        conn.execute("DELETE FROM sessions")   # changing the login signs everyone out


def check_login(username, password):
    try:
        with open(AUTH_FILE) as fh:
            auth = json.load(fh)
        salt, expected, name = bytes.fromhex(auth["salt"]), auth["hash"], auth["username"]
    except (OSError, ValueError, KeyError):
        return False
    ok_pass = hmac.compare_digest(_hash_password(password, salt), expected)
    ok_user = hmac.compare_digest(username.encode(), name.encode())
    return ok_pass and ok_user


def _token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()

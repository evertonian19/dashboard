"""Mail (Menu 6): read-only IMAP check of the inbox."""
import imaplib
import json
import os
import re
import threading
from email import message_from_bytes
from email.header import decode_header, make_header
from email.utils import parseaddr, parsedate_to_datetime
from html.parser import HTMLParser

from backend.config import DATA
from backend.db import now_iso


# ---------------------------------------------------------------------------
# Mail (Menu 6)
#
# Read-only IMAP check of the inbox: unread count and the newest headers.
# Nothing is marked read, moved or deleted (mailbox opened read-only, PEEK).
# Account passwords are stored in MAIL_FILE (owner-only) and never sent back
# to the browser.
MAIL_FILE = os.path.join(DATA, "mail-accounts.json")
MAIL_PROVIDERS = {
    "naver": {"label": "네이버", "host": "imap.naver.com", "web": "https://mail.naver.com"},
    "gmail": {"label": "Gmail", "host": "imap.gmail.com", "web": "https://mail.google.com"},
}
MAIL_POLL = 60          # seconds between background checks
MAIL_RECENT = 20        # newest messages shown per account
_mail_lock = threading.Lock()
_mail_state = {}        # account id -> last check result


def load_accounts():
    try:
        with open(MAIL_FILE) as fh:
            data = json.load(fh)
        return data if isinstance(data, list) else []
    except (OSError, ValueError):
        return []


def save_accounts(accounts):
    tmp = MAIL_FILE + ".tmp"
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as fh:
        json.dump(accounts, fh, ensure_ascii=False)
    os.replace(tmp, MAIL_FILE)


def _header(value):
    try:
        return str(make_header(decode_header(value or ""))).strip()
    except Exception:
        return (value or "").strip()


def fetch_mail(account):
    """Log in and return {"unread": n, "messages": [...]}. Raises on failure."""
    conn = imaplib.IMAP4_SSL(MAIL_PROVIDERS[account["provider"]]["host"], 993, timeout=20)
    try:
        conn.login(account["email"], account["password"])
        typ, data = conn.select("INBOX", readonly=True)
        if typ != "OK":
            raise imaplib.IMAP4.error("받은편지함을 열 수 없어요")
        total = int(data[0] or 0)
        typ, data = conn.search(None, "UNSEEN")
        unread = len(data[0].split()) if typ == "OK" and data and data[0] else 0
        messages = []
        if total:
            first = max(1, total - MAIL_RECENT + 1)
            typ, data = conn.fetch(f"{first}:{total}",
                                   "(UID FLAGS BODY.PEEK[HEADER.FIELDS (FROM SUBJECT DATE)])")
            for i, item in enumerate(data or []):
                if not isinstance(item, tuple):
                    continue
                meta = item[0]
                if i + 1 < len(data) and isinstance(data[i + 1], bytes):
                    meta += data[i + 1]   # some servers put FLAGS after the header block
                msg = message_from_bytes(item[1])
                name, addr = parseaddr(_header(msg.get("From")))
                try:
                    date = parsedate_to_datetime(msg.get("Date")).astimezone().isoformat(timespec="seconds")
                except Exception:
                    date = None
                uid = re.search(rb"UID (\d+)", meta)
                messages.append({
                    "uid": int(uid.group(1)) if uid else None,
                    "from": name or addr or "(보낸 사람 없음)", "from_addr": addr,
                    "subject": _header(msg.get("Subject")) or "(제목 없음)",
                    "date": date, "unread": b"\\Seen" not in meta,
                })
            messages.reverse()
        return {"unread": unread, "messages": messages}
    finally:
        try:
            conn.logout()
        except Exception:
            pass


class _TextOnly(HTMLParser):
    """HTML mail body -> plain text."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts, self.skip = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "head"):
            self.skip += 1
        elif tag in ("br", "p", "div", "tr", "li", "h1", "h2", "h3"):
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style", "head"):
            self.skip = max(0, self.skip - 1)

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def fetch_mail_body(account, uid):
    """Plain-text body of one message. Uses PEEK, so the message stays unread."""
    conn = imaplib.IMAP4_SSL(MAIL_PROVIDERS[account["provider"]]["host"], 993, timeout=20)
    try:
        conn.login(account["email"], account["password"])
        conn.select("INBOX", readonly=True)
        typ, data = conn.uid("fetch", str(int(uid)), "(BODY.PEEK[]<0.400000>)")
        raw = next((item[1] for item in data or [] if isinstance(item, tuple)), None)
        if typ != "OK" or raw is None:
            raise LookupError("메일을 찾을 수 없어요")
    finally:
        try:
            conn.logout()
        except Exception:
            pass
    msg = message_from_bytes(raw)
    plain = rich = None
    for part in msg.walk():
        if part.is_multipart() or "attachment" in str(part.get("Content-Disposition", "")).lower():
            continue
        kind = part.get_content_type()
        if kind not in ("text/plain", "text/html") or (kind == "text/plain" and plain) or (kind == "text/html" and rich):
            continue
        payload = part.get_payload(decode=True) or b""
        charset = part.get_content_charset() or "utf-8"
        try:
            text = payload.decode(charset, "replace")
        except LookupError:
            text = payload.decode("utf-8", "replace")
        if kind == "text/plain":
            plain = text
        else:
            rich = text
    if not (plain and plain.strip()) and rich:
        parser = _TextOnly()
        parser.feed(rich)
        plain = "".join(parser.parts)
    text = re.sub(r"[ \t\xa0\u200b\u200c\ufeff]+", " ", plain or "")
    text = re.sub(r" ?\n ?", "\n", text.replace("\r", ""))
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text[:20000]


def mail_error(exc):
    if isinstance(exc, imaplib.IMAP4.error):
        detail = exc.args[0] if exc.args else ""
        if isinstance(detail, bytes):
            detail = detail.decode("utf-8", "replace")
        return f"로그인에 실패했어요. 주소와 앱 비밀번호, IMAP 사용 설정을 확인해 주세요. ({detail})"
    return f"메일 서버에 연결할 수 없어요. ({exc})"


def check_account(account):
    try:
        result = {**fetch_mail(account), "error": None}
    except Exception as exc:
        with _mail_lock:
            old = _mail_state.get(account["id"], {})
        result = {"unread": old.get("unread", 0), "messages": old.get("messages", []),
                  "error": mail_error(exc)}
    result["checked_at"] = now_iso()
    with _mail_lock:
        _mail_state[account["id"]] = result
    return result


def mail_poller():
    while True:
        for account in load_accounts():
            check_account(account)
        threading.Event().wait(MAIL_POLL)


def mail_overview():
    accounts = []
    with _mail_lock:
        for a in load_accounts():
            state = _mail_state.get(a["id"], {})
            accounts.append({
                "id": a["id"], "provider": a["provider"], "email": a["email"],
                "checked_at": state.get("checked_at"), "error": state.get("error"),
                "unread": state.get("unread", 0), "messages": state.get("messages", []),
            })
    providers = {k: {"label": v["label"], "web": v["web"]} for k, v in MAIL_PROVIDERS.items()}
    return {"providers": providers, "accounts": accounts, "poll_seconds": MAIL_POLL}

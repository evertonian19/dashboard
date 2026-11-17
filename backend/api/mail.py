"""Mail (Menu 6): accounts, refresh and message bodies."""
import re
import uuid

from backend.db import db, now_iso, record
from backend.mail import MAIL_PROVIDERS, _mail_lock, _mail_state, check_account, fetch_mail, fetch_mail_body, load_accounts, mail_error, mail_overview, save_accounts
from backend.sanitize import MAX_JSON


class MailMixin:
    """Mail (Menu 6): accounts, refresh and message bodies."""

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

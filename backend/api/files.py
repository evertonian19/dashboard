"""Files (Menus 2 and 4): upload, metadata, PDF conversion, download."""
import os
import re
import uuid
from urllib.parse import quote

from backend.config import FILES, INLINE_TYPES, KINDS, LISTED_KINDS, MAX_UPLOAD
from backend.db import db, now_iso, one_line, record
from backend.filenames import clean_name
from backend.pdf import PDF_SOURCES, convert_to_pdf
from backend.sanitize import MAX_JSON, MAX_TITLE


class FilesMixin:
    """Files (Menus 2 and 4): upload, metadata, PDF conversion, download."""

    def list_files(self, kind):
        if kind not in KINDS:
            return self.fail(400, "kind 값이 올바르지 않아요")
        with db() as conn:
            rows = [dict(r) for r in conn.execute(
                "SELECT id, kind, name, ext, size, created_at, title, note FROM files "
                "WHERE kind = ? AND deleted_at IS NULL "
                "ORDER BY created_at DESC, rowid DESC", (kind,))]
        self.send_json({"files": rows})

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

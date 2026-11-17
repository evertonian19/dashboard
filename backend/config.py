"""Paths, limits and the file kinds the dashboard accepts."""
import os
import time


ROOT = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
PUBLIC = os.path.join(ROOT, "public")
DATA = os.environ.get("DASHBOARD_DATA", os.path.join(ROOT, "data"))
FILES = os.path.join(DATA, "files")
DB_PATH = os.path.join(DATA, "dashboard.sqlite")
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8080"))
CLAUDE_DIR = os.environ.get("CLAUDE_DIR", os.path.expanduser("~/.claude/projects"))
MAX_UPLOAD = 200 * 1024 * 1024

# What each menu accepts. "inline" types are shown in the browser; the rest download.
KINDS = {
    "diagram": {
        "label": "다이어그램",
        "ext": [".drawio", ".xml", ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp"],
    },
    "document": {
        "label": "문서",
        "ext": [".hwp", ".hwpx", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx", ".pdf",
                ".txt", ".md", ".csv", ".rtf", ".odt", ".odp", ".ods", ".zip",
                ".png", ".jpg", ".jpeg", ".gif", ".webp"],
    },
    # Images and files inserted into board posts. Not listed in any menu.
    "attachment": {
        "label": "첨부",
        "ext": [".png", ".jpg", ".jpeg", ".gif", ".webp", ".hwp", ".hwpx", ".doc", ".docx", ".ppt",
                ".pptx", ".xls", ".xlsx", ".pdf", ".txt", ".md", ".csv", ".zip"],
    },
}
LISTED_KINDS = ("diagram", "document")
INLINE_TYPES = {
    ".drawio": "application/xml", ".xml": "application/xml", ".svg": "image/svg+xml",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".webp": "image/webp",
    ".pdf": "application/pdf", ".txt": "text/plain; charset=utf-8",
    ".md": "text/plain; charset=utf-8", ".csv": "text/plain; charset=utf-8",
}


TRASH_DAYS = 30
STARTED = time.time()

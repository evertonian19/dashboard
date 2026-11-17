"""SQLite connection, schema and small helpers shared by every feature."""
import json
import os
import re
import sqlite3
from datetime import datetime

from backend.config import DB_PATH, FILES


def now_iso():
    return datetime.now().astimezone().isoformat(timespec="seconds")


def db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def init_schema():
    os.makedirs(FILES, exist_ok=True)
    with db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS files (
                id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL,
                ext TEXT NOT NULL, size INTEGER NOT NULL, created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS activity (
                id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL,
                action TEXT NOT NULL, kind TEXT NOT NULL, name TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS files_kind ON files (kind, created_at);
            CREATE TABLE IF NOT EXISTS posts (
                id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL,
                body_text TEXT NOT NULL, created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS comments (
                id TEXT PRIMARY KEY, post_id TEXT NOT NULL, body TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS comments_post ON comments (post_id, created_at);
            CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires REAL NOT NULL);
            CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS todos (
                id TEXT PRIMARY KEY, title TEXT NOT NULL, due TEXT, priority INTEGER NOT NULL DEFAULT 0,
                done INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, done_at TEXT
            );
            CREATE TABLE IF NOT EXISTS memos (
                id TEXT PRIMARY KEY, body TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS links (
                id TEXT PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL, created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS logins (
                id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, ip TEXT NOT NULL,
                username TEXT NOT NULL, ok INTEGER NOT NULL
            );
            """
        )
        for table, column, decl in (("posts", "category_id", "TEXT"), ("posts", "deleted_at", "TEXT"),
                                    ("posts", "pinned", "INTEGER NOT NULL DEFAULT 0"),
                                    ("posts", "updated_at", "TEXT"), ("files", "deleted_at", "TEXT"),
                                    ("files", "title", "TEXT"), ("files", "note", "TEXT")):
            if column not in [r[1] for r in conn.execute(f"PRAGMA table_info({table})")]:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {decl}")


def record(conn, action, kind, name):
    conn.execute("INSERT INTO activity (at, action, kind, name) VALUES (?, ?, ?, ?)",
                 (now_iso(), action, kind, name))


def get_setting(conn, key, default=None):
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    try:
        return json.loads(row["value"]) if row else default
    except ValueError:
        return default


def set_setting(conn, key, value):
    conn.execute("INSERT INTO settings (key, value) VALUES (?, ?) "
                 "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                 (key, json.dumps(value, ensure_ascii=False)))


def one_line(raw, limit):
    """Single-line text: control characters and runs of spaces collapsed, length capped."""
    return re.sub(r"\s+", " ", re.sub(r"[\x00-\x1f\x7f]", " ", str(raw or ""))).strip()[:limit]

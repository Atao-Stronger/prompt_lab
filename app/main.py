"""Prompt Lab backend: tiny authenticated JSON store over SQLite."""

import json
import os
import secrets
import sqlite3
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from seed import SEED_PROMPTS

DB_PATH = os.environ.get("DB_PATH", "/data/prompt_lab.db")
ACCESS_TOKEN = os.environ.get("ACCESS_TOKEN", "")
WEB_DIR = Path(__file__).parent / "web"

MAX_FAILS = 10
WINDOW_SECONDS = 60.0
_fails: dict[str, list[float]] = {}
_fails_lock = threading.Lock()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = connect()
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute(
        "CREATE TABLE IF NOT EXISTS prompts ("
        "id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)"
    )
    conn.commit()
    count = conn.execute("SELECT COUNT(*) AS c FROM prompts").fetchone()["c"]
    if count == 0:
        stamp = now_iso()
        for item in SEED_PROMPTS:
            prompt = dict(item)
            prompt.setdefault("id", "p_" + secrets.token_hex(3))
            prompt.setdefault("createdAt", stamp)
            prompt.setdefault("updatedAt", stamp)
            prompt.setdefault("versions", [])
            conn.execute(
                "INSERT OR REPLACE INTO prompts (id, data, updated_at) VALUES (?, ?, ?)",
                (
                    prompt["id"],
                    json.dumps(prompt, ensure_ascii=False),
                    prompt["updatedAt"],
                ),
            )
        conn.commit()
    conn.close()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Prompt Lab", lifespan=lifespan)


def require_token(request: Request, x_auth_token: str = Header(default="")) -> None:
    if not ACCESS_TOKEN:
        raise HTTPException(status_code=500, detail="ACCESS_TOKEN 未配置")
    if secrets.compare_digest(x_auth_token, ACCESS_TOKEN):
        return
    host = request.client.host if request.client else "unknown"
    now = time.time()
    with _fails_lock:
        stamps = [t for t in _fails.get(host, []) if now - t < WINDOW_SECONDS]
        stamps.append(now)
        _fails[host] = stamps
        blocked = len(stamps) > MAX_FAILS
    if blocked:
        raise HTTPException(status_code=429, detail="尝试过于频繁，请一分钟后再试")
    raise HTTPException(status_code=401, detail="口令不正确")


class Prompt(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=200)
    content: str
    description: str = ""
    category: str = "未分类"
    tags: list[str] = Field(default_factory=list)
    favorite: bool = False
    usageCount: int = 0
    lastUsedAt: str | None = None
    createdAt: str
    updatedAt: str
    versions: list[dict] = Field(default_factory=list)


def upsert(conn: sqlite3.Connection, prompt: Prompt) -> None:
    conn.execute(
        "INSERT INTO prompts (id, data, updated_at) VALUES (?, ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at",
        (prompt.id, prompt.model_dump_json(), prompt.updatedAt or now_iso()),
    )


@app.get("/api/health")
def health() -> dict:
    conn = connect()
    count = conn.execute("SELECT COUNT(*) AS c FROM prompts").fetchone()["c"]
    conn.close()
    return {"ok": True, "count": count}


@app.get("/api/prompts", dependencies=[Depends(require_token)])
def list_prompts() -> dict:
    conn = connect()
    rows = conn.execute("SELECT data FROM prompts").fetchall()
    conn.close()
    return {"prompts": [json.loads(row["data"]) for row in rows]}


@app.put("/api/prompts/{prompt_id}", dependencies=[Depends(require_token)])
def put_prompt(prompt_id: str, prompt: Prompt) -> dict:
    if prompt.id != prompt_id:
        raise HTTPException(status_code=400, detail="路径 id 与正文 id 不一致")
    conn = connect()
    upsert(conn, prompt)
    conn.commit()
    conn.close()
    return {"ok": True}


@app.delete("/api/prompts/{prompt_id}", dependencies=[Depends(require_token)])
def delete_prompt(prompt_id: str) -> dict:
    conn = connect()
    conn.execute("DELETE FROM prompts WHERE id = ?", (prompt_id,))
    conn.commit()
    conn.close()
    return {"ok": True}


app.mount("/", StaticFiles(directory=str(WEB_DIR), html=True), name="web")

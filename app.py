from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
import uuid
from pathlib import Path
from typing import Annotated, Literal
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request as UrlRequest, urlopen

from fastapi import Cookie, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / "uploads"
DB_PATH = DATA_DIR / "bluechip.db"
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "club-media")
SESSION_TTL = 60 * 60 * 12

DATA_DIR.mkdir(exist_ok=True)
UPLOAD_DIR.mkdir(exist_ok=True)

DEFAULT_CONTENT = {
    "site_name": "Blue Chip Poker Club",
    "kicker": "Experiência completa de poker na sua cidade",
    "hero_title": "Blue Chip Poker Club:\nMais que um jogo,\nUma Comunidade.",
    "hero_description": "Torneios, cash games e eventos especiais em um ambiente confortável, seguro e feito para quem ama poker. E para completar: restaurante no local para você jogar e aproveitar sem pressa.",
    "today_title": "Hoje no Blue Chip",
    "today_description": "Confira os destaques e a programação do dia.",
    "today_note": "Consulte a equipe sobre regulamento, reservas e regras de entrada.",
    "schedule_title": "Torneios, Cash & Eventos",
    "schedule_description": "Uma agenda pensada para todos os estilos: do recreativo ao competitivo.",
    "restaurant_title": "Restaurante no local",
    "restaurant_heading": "Do jantar ao pós-jogo",
    "restaurant_description": "Além de um ambiente organizado e ético, o clube conta com hamburgueria de sliders, drinks especiais e diversas bebidas.",
    "contact_title": "Localização & Contato",
    "contact_description": "Encontre a casa no mapa e fale com a equipe para informações.",
    "address": "Rua Visconde do Rio Branco, 245 - Vila Bressan",
    "whatsapp": "5519996471948",
    "email": "contato@bluechip.com.br",
    "map_url": "https://www.google.com/maps?q=Rua%20Visconde%20do%20Rio%20Branco%20245%20Araras%20SP&output=embed",
}


class DatabaseConnection:
    def __init__(self, connection, postgres: bool):
        self.connection = connection
        self.postgres = postgres

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        try:
            if exc_type is None:
                self.connection.commit()
            else:
                self.connection.rollback()
            return False
        finally:
            self.connection.close()

    def execute(self, query: str, params=()):
        if self.postgres:
            query = query.replace("BEGIN IMMEDIATE", "BEGIN").replace("?", "%s")
        return self.connection.execute(query, params)

    def executemany(self, query: str, params):
        if self.postgres:
            query = query.replace("?", "%s")
            for item in params:
                self.connection.execute(query, item)
            return None
        return self.connection.executemany(query, params)


def using_postgres() -> bool:
    return bool(DATABASE_URL)


def db() -> DatabaseConnection:
    if using_postgres():
        try:
            import psycopg
            from psycopg.rows import dict_row
        except ImportError as exc:
            raise RuntimeError("Instale psycopg[binary] para usar DATABASE_URL.") from exc
        return DatabaseConnection(psycopg.connect(DATABASE_URL, row_factory=dict_row), True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return DatabaseConnection(connection, False)


def password_hash(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 310_000)
    return f"{salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt, expected = stored.split("$", 1)
    except ValueError:
        return False
    return hmac.compare_digest(password_hash(password, salt), stored)


def decode_json(value):
    return value if isinstance(value, (dict, list)) else json.loads(value)


def upload_to_supabase(name: str, contents: bytes, content_type: str) -> str:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(503, "O armazenamento de imagens do Supabase não está configurado.")
    endpoint = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{name}"
    request = UrlRequest(
        endpoint,
        data=contents,
        method="POST",
        headers={
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Content-Type": content_type,
            "x-upsert": "false",
        },
    )
    try:
        with urlopen(request, timeout=20) as response:
            if response.status not in (200, 201):
                raise HTTPException(502, "O Supabase recusou o upload da imagem.")
    except (HTTPError, URLError) as exc:
        raise HTTPException(502, "Não foi possível enviar a imagem para o Supabase.") from exc
    return f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{name}"

def init_db() -> None:
    with db() as conn:
        if using_postgres():
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL
                )
            """)
            conn.execute("CREATE TABLE IF NOT EXISTS content (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
            conn.execute("""
                CREATE TABLE IF NOT EXISTS cards (
                    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
                    carousel TEXT NOT NULL CHECK(carousel IN ('schedule','restaurant')),
                    tag TEXT NOT NULL DEFAULT '', title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
                    image_url TEXT NOT NULL DEFAULT '', link_url TEXT NOT NULL DEFAULT '',
                    position INTEGER NOT NULL DEFAULT 0,
                    active BOOLEAN NOT NULL DEFAULT TRUE
                )
            """)
            conn.execute("ALTER TABLE cards ADD COLUMN IF NOT EXISTS link_url TEXT NOT NULL DEFAULT ''")
            conn.execute("CREATE TABLE IF NOT EXISTS tournament (id INTEGER PRIMARY KEY CHECK(id=1), data JSONB NOT NULL)")
        else:
            conn.connection.executescript("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS content (
                    key TEXT PRIMARY KEY, value TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS cards (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    carousel TEXT NOT NULL CHECK(carousel IN ('schedule','restaurant')),
                    tag TEXT NOT NULL DEFAULT '', title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
                    image_url TEXT NOT NULL DEFAULT '', link_url TEXT NOT NULL DEFAULT '',
                    position INTEGER NOT NULL DEFAULT 0,
                    active INTEGER NOT NULL DEFAULT 1
                );
                CREATE TABLE IF NOT EXISTS tournament (
                    id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL
                );
            """)
            columns = {row[1] for row in conn.execute("PRAGMA table_info(cards)")}
            if "link_url" not in columns:
                conn.execute("ALTER TABLE cards ADD COLUMN link_url TEXT NOT NULL DEFAULT ''")
        content_insert = (
            "INSERT INTO content(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING"
            if using_postgres()
            else "INSERT OR IGNORE INTO content(key,value) VALUES(?,?)"
        )
        conn.executemany(content_insert, DEFAULT_CONTENT.items())
        username = os.getenv("ADMIN_USERNAME", "admin")
        password = os.getenv("ADMIN_PASSWORD")
        if password:
            user_insert = (
                "INSERT INTO users(username,password_hash) VALUES(?,?) ON CONFLICT(username) DO NOTHING"
                if using_postgres()
                else "INSERT OR IGNORE INTO users(username,password_hash) VALUES(?,?)"
            )
            conn.execute(user_insert, (username, password_hash(password)))
        count_row = conn.execute("SELECT COUNT(*) AS count FROM cards").fetchone()
        count = count_row["count"] if using_postgres() else count_row[0]
        if not count:
            cards = [
                ("schedule", "SEGUNDA", "Noite de Cash", "Mesas abertas a partir das 18h", "", 0),
                ("schedule", "TERÇA", "Torneio Regular", "Inscrições 19h • Início 20h", "", 1),
                ("schedule", "SÁBADO", "Main Event", "Confira os detalhes com a equipe", "", 2),
                ("restaurant", "", "Hambúrguer artesanal", "Carne suculenta + molho da casa", "", 0),
                ("restaurant", "", "Drinks especiais", "Clássicos + assinatura da casa", "", 1),
            ]
            conn.executemany("INSERT INTO cards(carousel,tag,title,description,image_url,position) VALUES(?,?,?,?,?,?)", cards)


app = FastAPI(title="Blue Chip Poker CMS", version="1.0.0")
init_db()

app.mount("/css", StaticFiles(directory=BASE_DIR / "css"), name="css")
app.mount("/js", StaticFiles(directory=BASE_DIR / "js"), name="js")
app.mount("/image", StaticFiles(directory=BASE_DIR / "image"), name="image")
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


def session_secret() -> bytes:
    return (os.getenv("SECRET_KEY") or secrets.token_urlsafe(32)).encode()


def make_session(username: str) -> str:
    payload = f"{username}|{int(time.time()) + SESSION_TTL}"
    signature = hmac.new(session_secret(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}|{signature}"


def authenticated(session: str | None) -> bool:
    if not session:
        return False
    try:
        username, expires, signature = session.rsplit("|", 2)
        payload = f"{username}|{expires}"
        good = hmac.compare_digest(signature, hmac.new(session_secret(), payload.encode(), hashlib.sha256).hexdigest())
        if not good or int(expires) < time.time():
            return False
        with db() as conn:
            return conn.execute("SELECT 1 FROM users WHERE username=?", (username,)).fetchone() is not None
    except (ValueError, TypeError):
        return False


def require_auth(session: str | None) -> None:
    if not authenticated(session):
        raise HTTPException(401, "Sessão inválida ou expirada")


def public_data(active_only: bool = True) -> dict:
    with db() as conn:
        content = {row["key"]: row["value"] for row in conn.execute("SELECT key,value FROM content")}
        where = "WHERE active=TRUE" if active_only else ""
        cards = [dict(row) for row in conn.execute(f"SELECT * FROM cards {where} ORDER BY carousel,position,id")]
    return {"content": content, "cards": cards}


class ContentUpdate(BaseModel):
    content: dict[str, str]


class CardInput(BaseModel):
    carousel: Literal["schedule", "restaurant"]
    tag: str = Field("", max_length=40)
    title: str = Field(min_length=1, max_length=120)
    description: str = Field("", max_length=300)
    image_url: str = Field("", max_length=1000)
    link_url: str = Field("", max_length=1000)
    position: int = Field(0, ge=0, le=999)
    active: bool = True

    @field_validator("link_url")
    @classmethod
    def validate_link_url(cls, value: str) -> str:
        value = value.strip()
        if not value:
            return ""
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValueError("Informe um link completo iniciado por http:// ou https://")
        return value


class TournamentInput(BaseModel):
    revision: int = Field(0, ge=0)
    name: str = Field(min_length=1, max_length=120, pattern=r"\S")
    status: Literal["idle", "running", "paused", "break", "ended"] = "idle"
    level: int = Field(1, ge=1, le=999)
    small_blind: int = Field(0, ge=0, le=1000000000)
    big_blind: int = Field(0, ge=0, le=1000000000)
    ante: int = Field(0, ge=0, le=1000000000)
    entries: int = Field(0, ge=0, le=1000000)
    players: int = Field(0, ge=0, le=1000000)
    average_stack: int = Field(0, ge=0, le=1000000000)
    note: str = Field("", max_length=300)
    remaining_seconds: int | None = Field(None, ge=0, le=86400)


class TournamentAutomationInput(BaseModel):
    revision: int = Field(0, ge=0)
    name: str = Field(min_length=1, max_length=120, pattern=r"\S")
    level_duration_minutes: int = Field(15, ge=1, le=240)
    small_blind: int = Field(0, ge=0, le=1000000000)
    big_blind: int = Field(0, ge=1, le=1000000000)
    blind_growth_mode: Literal["multiplier", "fixed"] = "multiplier"
    blind_growth_value: float = Field(2, ge=0, le=1000000000)
    ante_percent: float = Field(0, ge=0, le=100)
    break_every_levels: int = Field(0, ge=0, le=100)
    break_duration_minutes: int = Field(0, ge=0, le=120)
    players: int = Field(0, ge=0, le=1000000)
    entries: int = Field(0, ge=0, le=1000000)
    average_stack: int = Field(0, ge=0, le=1000000000)
    note: str = Field("", max_length=300)


class TournamentAutomationAction(BaseModel):
    revision: int = Field(0, ge=0)
    action: Literal["pause", "resume", "end"]


class TournamentMetricsInput(BaseModel):
    revision: int = Field(0, ge=0)
    players: int = Field(0, ge=0, le=1000000)
    entries: int = Field(0, ge=0, le=1000000)
    average_stack: int = Field(0, ge=0, le=1000000000)
    note: str = Field("", max_length=300)


def automation_elapsed(data: dict, now: float) -> float:
    automation = data.get("automation") or {}
    elapsed = float(automation.get("elapsed_seconds", 0))
    if data.get("status") == "running" and automation.get("started_at") is not None:
        elapsed += max(0, now - float(automation["started_at"]))
    return elapsed


def automatic_tournament_state(data: dict, now: float) -> dict:
    automation = data["automation"]
    elapsed = automation_elapsed(data, now)
    level_seconds = int(automation["level_duration_seconds"])
    levels_before_break = int(automation.get("break_every_levels", 0))
    break_seconds = int(automation.get("break_duration_seconds", 0))
    on_break = False

    if levels_before_break and break_seconds:
        cycle_seconds = levels_before_break * level_seconds + break_seconds
        completed_cycles, cycle_position = divmod(int(elapsed), cycle_seconds)
        running_seconds = levels_before_break * level_seconds
        if cycle_position >= running_seconds:
            level = completed_cycles * levels_before_break + levels_before_break
            remaining = cycle_seconds - cycle_position
            on_break = True
        else:
            level = completed_cycles * levels_before_break + cycle_position // level_seconds + 1
            remaining = level_seconds - cycle_position % level_seconds
    else:
        level = int(elapsed) // level_seconds + 1
        remaining = level_seconds - int(elapsed) % level_seconds

    step = max(0, level - 1)
    if automation["blind_growth_mode"] == "multiplier":
        factor = float(automation["blind_growth_value"]) ** step
        small_blind = round(int(automation["small_blind"]) * factor)
        big_blind = round(int(automation["big_blind"]) * factor)
    else:
        increment = float(automation["blind_growth_value"]) * step
        small_blind = round(int(automation["small_blind"]) + increment)
        big_blind = round(int(automation["big_blind"]) + increment)

    ante = round(big_blind * float(automation.get("ante_percent", 0)) / 100)
    return {
        "level": level,
        "small_blind": small_blind,
        "big_blind": big_blind,
        "ante": ante,
        "remaining_seconds": remaining,
        "status": "break" if on_break else data.get("status", "running"),
        "automation_elapsed_seconds": elapsed,
    }


def tournament_snapshot(data: dict, now: float) -> dict:
    result = dict(data)
    if data.get("automation"):
        result.update(automatic_tournament_state(data, now))
        if data.get("status") in ("paused", "ended"):
            result["status"] = data["status"]
    elif data.get("ends_at") is not None:
        result["remaining_seconds"] = max(0, data["ends_at"] - now)
    result["server_time"] = now
    return result


@app.get("/api/tournament")
def get_tournament(response: Response):
    response.headers["Cache-Control"] = "no-store"
    with db() as conn:
        row = conn.execute("SELECT data FROM tournament WHERE id=1").fetchone()
    return tournament_snapshot(decode_json(row["data"]), time.time()) if row else {"status": "idle", "revision": 0, "server_time": time.time()}


@app.put("/api/admin/tournament")
def update_tournament(payload: TournamentInput, session: Annotated[str | None, Cookie()] = None):
    require_auth(session)
    if payload.players > payload.entries or payload.small_blind > payload.big_blind:
        raise HTTPException(422, "Confira jogadores/entradas e small blind/big blind.")
    with db() as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute("SELECT data FROM tournament WHERE id=1").fetchone()
        old = decode_json(row["data"]) if row else {"revision": 0, "remaining_seconds": 0}
        if old.get("automation"):
            raise HTTPException(422, "Este torneio usa a estrutura automática. Atualize jogadores e avisos pelo painel automático.")
        if old["revision"] != payload.revision:
            raise HTTPException(409, "O torneio foi alterado em outra sessão. Recarregue os dados antes de salvar.")
        now = time.time()
        remaining = payload.remaining_seconds
        if remaining is None:
            remaining = tournament_snapshot(old, now)["remaining_seconds"]
        data = payload.model_dump()
        data.update(revision=old["revision"] + 1, updated_at=now, remaining_seconds=remaining,
                    ends_at=now + remaining if payload.status in ("running", "break") else None)
        conn.execute("INSERT INTO tournament(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data", (json.dumps(data),))
    return tournament_snapshot(data, now)


@app.put("/api/admin/tournament/automation")
def start_automatic_tournament(payload: TournamentAutomationInput, session: Annotated[str | None, Cookie()] = None):
    require_auth(session)
    if payload.players > payload.entries:
        raise HTTPException(422, "Jogadores restantes não pode ser maior que entradas totais.")
    if payload.small_blind > payload.big_blind:
        raise HTTPException(422, "A small blind não pode ser maior que a big blind.")
    if payload.blind_growth_mode == "multiplier" and payload.blind_growth_value < 1:
        raise HTTPException(422, "O multiplicador das blinds deve ser igual ou maior que 1.")
    if payload.break_every_levels == 0 and payload.break_duration_minutes:
        raise HTTPException(422, "Defina a frequência do intervalo ou deixe a duração do intervalo em zero.")
    now = time.time()
    with db() as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute("SELECT data FROM tournament WHERE id=1").fetchone()
        old = decode_json(row["data"]) if row else {"revision": 0}
        if old["revision"] != payload.revision:
            raise HTTPException(409, "O torneio foi alterado em outra sessão. Recarregue os dados antes de iniciar.")
        data = {
            "revision": old["revision"] + 1,
            "name": payload.name,
            "status": "running",
            "players": payload.players,
            "entries": payload.entries,
            "average_stack": payload.average_stack,
            "note": payload.note,
            "updated_at": now,
            "automation": {
                "started_at": now,
                "elapsed_seconds": 0,
                "level_duration_seconds": payload.level_duration_minutes * 60,
                "small_blind": payload.small_blind,
                "big_blind": payload.big_blind,
                "blind_growth_mode": payload.blind_growth_mode,
                "blind_growth_value": payload.blind_growth_value,
                "ante_percent": payload.ante_percent,
                "break_every_levels": payload.break_every_levels,
                "break_duration_seconds": payload.break_duration_minutes * 60,
            },
        }
        conn.execute("INSERT INTO tournament(id,data) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data", (json.dumps(data),))
    return tournament_snapshot(data, now)


@app.post("/api/admin/tournament/automation/action")
def automatic_tournament_action(payload: TournamentAutomationAction, session: Annotated[str | None, Cookie()] = None):
    require_auth(session)
    now = time.time()
    with db() as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute("SELECT data FROM tournament WHERE id=1").fetchone()
        if not row:
            raise HTTPException(404, "Nenhum torneio automático foi iniciado.")
        data = decode_json(row["data"])
        if not data.get("automation"):
            raise HTTPException(422, "Este torneio não usa a estrutura automática.")
        if data["revision"] != payload.revision:
            raise HTTPException(409, "O torneio foi alterado em outra sessão. Recarregue os dados antes de continuar.")
        if payload.action == "pause":
            if data["status"] != "running":
                raise HTTPException(422, "Apenas um torneio em andamento pode ser pausado.")
            data["automation"]["elapsed_seconds"] = automation_elapsed(data, now)
            data["automation"]["started_at"] = None
            data["status"] = "paused"
        elif payload.action == "resume":
            if data["status"] != "paused":
                raise HTTPException(422, "Apenas um torneio pausado pode ser retomado.")
            data["automation"]["started_at"] = now
            data["status"] = "running"
        else:
            data["automation"]["elapsed_seconds"] = automation_elapsed(data, now)
            data["automation"]["started_at"] = None
            data["status"] = "ended"
        data["revision"] += 1
        data["updated_at"] = now
        conn.execute("UPDATE tournament SET data=? WHERE id=1", (json.dumps(data),))
    return tournament_snapshot(data, now)


@app.put("/api/admin/tournament/automation/metrics")
def update_automatic_tournament_metrics(payload: TournamentMetricsInput, session: Annotated[str | None, Cookie()] = None):
    require_auth(session)
    if payload.players > payload.entries:
        raise HTTPException(422, "Jogadores restantes não pode ser maior que entradas totais.")
    now = time.time()
    with db() as conn:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute("SELECT data FROM tournament WHERE id=1").fetchone()
        if not row:
            raise HTTPException(404, "Nenhum torneio automático foi iniciado.")
        data = decode_json(row["data"])
        if not data.get("automation"):
            raise HTTPException(422, "Este torneio não usa a estrutura automática.")
        if data["revision"] != payload.revision:
            raise HTTPException(409, "O torneio foi alterado em outra sessão. Recarregue os dados antes de salvar.")
        data.update(players=payload.players, entries=payload.entries, average_stack=payload.average_stack, note=payload.note,
                    revision=data["revision"] + 1, updated_at=now)
        conn.execute("UPDATE tournament SET data=? WHERE id=1", (json.dumps(data),))
    return tournament_snapshot(data, now)


@app.get("/", include_in_schema=False)
def public_page():
    return FileResponse(BASE_DIR / "index.html")


@app.get("/admin", include_in_schema=False)
def admin_page(session: Annotated[str | None, Cookie()] = None):
    return FileResponse(BASE_DIR / ("admin.html" if authenticated(session) else "login.html"))


@app.get("/api/public")
def get_public():
    return public_data()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/login")
def login(response: Response, username: Annotated[str, Form()], password: Annotated[str, Form()]):
    with db() as conn:
        user = conn.execute("SELECT * FROM users WHERE username=?", (username.strip(),)).fetchone()
    if not user or not verify_password(password, user["password_hash"]):
        raise HTTPException(401, "Usuário ou senha incorretos")
    response.set_cookie("session", make_session(user["username"]), httponly=True, samesite="strict", secure=os.getenv("COOKIE_SECURE") == "1", max_age=SESSION_TTL)
    return {"ok": True}


@app.post("/api/logout")
def logout(response: Response):
    response.delete_cookie("session")
    return {"ok": True}


@app.get("/api/admin/data")
def admin_data(session: Annotated[str | None, Cookie()] = None):
    require_auth(session)
    return public_data(False)


@app.put("/api/admin/content")
def update_content(payload: ContentUpdate, session: Annotated[str | None, Cookie()] = None):
    require_auth(session)
    allowed = set(DEFAULT_CONTENT)
    unknown = set(payload.content) - allowed
    if unknown:
        raise HTTPException(422, f"Campos desconhecidos: {', '.join(sorted(unknown))}")
    with db() as conn:
        conn.executemany("INSERT INTO content(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", payload.content.items())
    return {"ok": True}


@app.post("/api/admin/cards", status_code=201)
def create_card(card: CardInput, session: Annotated[str | None, Cookie()] = None):
    require_auth(session)
    with db() as conn:
        if using_postgres():
            cursor = conn.execute("INSERT INTO cards(carousel,tag,title,description,image_url,link_url,position,active) VALUES(?,?,?,?,?,?,?,?) RETURNING id", (card.carousel, card.tag, card.title, card.description, card.image_url, card.link_url, card.position, card.active))
            card_id = cursor.fetchone()["id"]
        else:
            cursor = conn.execute("INSERT INTO cards(carousel,tag,title,description,image_url,link_url,position,active) VALUES(?,?,?,?,?,?,?,?)", (card.carousel, card.tag, card.title, card.description, card.image_url, card.link_url, card.position, int(card.active)))
            card_id = cursor.lastrowid
    return {"id": card_id}


@app.put("/api/admin/cards/{card_id}")
def update_card(card_id: int, card: CardInput, session: Annotated[str | None, Cookie()] = None):
    require_auth(session)
    with db() as conn:
        active = card.active if using_postgres() else int(card.active)
        result = conn.execute("UPDATE cards SET carousel=?,tag=?,title=?,description=?,image_url=?,link_url=?,position=?,active=? WHERE id=?", (card.carousel, card.tag, card.title, card.description, card.image_url, card.link_url, card.position, active, card_id))
    if not result.rowcount:
        raise HTTPException(404, "Card não encontrado")
    return {"ok": True}


@app.delete("/api/admin/cards/{card_id}", status_code=204)
def delete_card(card_id: int, session: Annotated[str | None, Cookie()] = None):
    require_auth(session)
    with db() as conn:
        result = conn.execute("DELETE FROM cards WHERE id=?", (card_id,))
    if not result.rowcount:
        raise HTTPException(404, "Card não encontrado")


@app.post("/api/admin/upload", status_code=201)
async def upload_image(file: Annotated[UploadFile, File()], session: Annotated[str | None, Cookie()] = None):
    require_auth(session)
    allowed = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
    if file.content_type not in allowed:
        raise HTTPException(415, "Envie uma imagem JPG, PNG, WEBP ou GIF")
    contents = await file.read(5 * 1024 * 1024 + 1)
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(413, "A imagem deve ter no máximo 5 MB")
    name = f"{uuid.uuid4().hex}{allowed[file.content_type]}"
    if using_postgres():
        return {"url": upload_to_supabase(name, contents, file.content_type)}
    (UPLOAD_DIR / name).write_bytes(contents)
    return {"url": f"/uploads/{name}"}


@app.exception_handler(HTTPException)
async def http_error(_: Request, exc: HTTPException):
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code)

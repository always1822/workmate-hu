from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Form, Query
from fastapi.responses import Response
from starlette.middleware.cors import CORSMiddleware
import secrets
from services import (put_object, get_object, storage_path, send_email,
                      doc_email_html, reset_email_html)
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import ReturnDocument
import os
import io
import glob
import logging
import re
import uuid
import bcrypt
import jwt
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from models import (Owned, Customer, CustomerIn, Job, JobIn, LineItem, Quote, QuoteIn,  # noqa: F401
                    Invoice, InvoiceIn, WorkLog, WorkLogIn, Document, DocumentIn,
                    Payment, PaymentIn, Company, RegisterIn, LoginIn, ForgotIn, ResetIn,
                    SendDocIn, ContactIn, now_iso)
from seed_data import seed_user

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")
JWT_ALG = "HS256"


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except ValueError:
        return False


def create_token(user_id: str, email: str) -> str:
    return jwt.encode({"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(days=7)},
                      os.environ["JWT_SECRET"], algorithm=JWT_ALG)


async def current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else request.cookies.get("access_token")
    if not token:
        raise HTTPException(401, "Nincs bejelentkezve")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "A munkamenet lejárt")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Érvénytelen token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "Felhasználó nem található")
    return user


# Modellek: lásd models.py
# ---------- Auth ----------
def public_user(u: dict) -> dict:
    return {"id": u["id"], "name": u.get("name", ""), "email": u["email"], "company_name": u.get("company_name", "")}


@api_router.get("/")
async def root():
    return {"message": "WorkMate HU API", "status": "ok"}


@api_router.post("/auth/register")
async def register(payload: RegisterIn):
    email = payload.email.lower().strip()
    if len(payload.password) < 6:
        raise HTTPException(400, "A jelszó legalább 6 karakter legyen")
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Ez az email cím már regisztrálva van")
    user = {"id": str(uuid.uuid4()), "name": payload.name, "email": email,
            "company_name": payload.company_name, "password_hash": hash_password(payload.password),
            "created_at": now_iso()}
    await db.users.insert_one(dict(user))
    await db.company.insert_one({"user_id": user["id"], **Company(name=payload.company_name,
                                                                  contact_name=payload.name,
                                                                  email=email).model_dump()})
    return {"token": create_token(user["id"], email), "user": public_user(user)}


@api_router.post("/auth/login")
async def login(payload: LoginIn):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(401, "Hibás email cím vagy jelszó")
    return {"token": create_token(user["id"], email), "user": public_user(user)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return public_user(user)


@api_router.post("/auth/logout")
async def logout(user: dict = Depends(current_user)):
    return {"ok": True}


@api_router.post("/auth/forgot-password")
async def forgot_password(payload: ForgotIn, request: Request):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token": token, "user_id": user["id"], "used": False,
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1)})
        origin = request.headers.get("origin") or os.environ.get("FRONTEND_URL", "")
        link = f"{origin}/uj-jelszo?token={token}"
        try:
            await send_email(email, "WorkMate HU – jelszó visszaállítás",
                             reset_email_html(user.get("name", ""), link))
        except Exception as e:
            logger.error(f"Reset email failed: {e}")
    return {"ok": True, "message": "Ha létezik a fiók, elküldtük a visszaállító linket."}


@api_router.post("/auth/reset-password")
async def reset_password(payload: ResetIn):
    if len(payload.password) < 6:
        raise HTTPException(400, "A jelszó legalább 6 karakter legyen")
    rec = await db.password_reset_tokens.find_one({"token": payload.token, "used": False})
    if not rec:
        raise HTTPException(400, "Érvénytelen vagy már felhasznált link")
    exp = rec["expires_at"]
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        raise HTTPException(400, "A link lejárt, kérj újat")
    await db.users.update_one({"id": rec["user_id"]}, {"$set": {"password_hash": hash_password(payload.password)}})
    await db.password_reset_tokens.update_one({"token": payload.token}, {"$set": {"used": True}})
    return {"ok": True}


# ---------- Generic owned CRUD ----------
def crud(path: str, coll: str, model, model_in, before_create=None):
    @api_router.get(f"/{path}", response_model=List[model])
    async def list_items(user: dict = Depends(current_user)):
        docs = await db[coll].find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
        return [model(**d) for d in docs]

    @api_router.post(f"/{path}", response_model=model)
    async def create_item(payload: model_in, user: dict = Depends(current_user)):
        data = payload.model_dump()
        if before_create:
            await before_create(user, data)
        obj = model(**data, user_id=user["id"])
        await db[coll].insert_one(obj.model_dump())
        return obj

    @api_router.get(f"/{path}/{{item_id}}", response_model=model)
    async def get_item(item_id: str, user: dict = Depends(current_user)):
        doc = await db[coll].find_one({"id": item_id, "user_id": user["id"]}, {"_id": 0})
        if not doc:
            raise HTTPException(404, "Nem található")
        return model(**doc)

    @api_router.put(f"/{path}/{{item_id}}", response_model=model)
    async def update_item(item_id: str, payload: model_in, user: dict = Depends(current_user)):
        doc = await db[coll].find_one({"id": item_id, "user_id": user["id"]}, {"_id": 0})
        if not doc:
            raise HTTPException(404, "Nem található")
        doc.update(payload.model_dump())
        doc["user_id"] = user["id"]
        await db[coll].replace_one({"id": item_id, "user_id": user["id"]}, doc)
        return model(**doc)

    @api_router.delete(f"/{path}/{{item_id}}")
    async def delete_item(item_id: str, user: dict = Depends(current_user)):
        res = await db[coll].delete_one({"id": item_id, "user_id": user["id"]})
        if res.deleted_count == 0:
            raise HTTPException(404, "Nem található")
        return {"ok": True}


crud("customers", "customers", Customer, CustomerIn)


async def _auto_quote_number(user: dict, data: dict):
    """Ajánlat létrehozásakor automatikus sorszám (AJ-<év>-<XXX>), ha nincs megadva."""
    if not data.get("number"):
        year = datetime.now(timezone.utc).year
        data["number"] = await next_doc_number(user["id"], year, f"AJ-{year}-", "quote_seq", "quotes")


crud("quotes", "quotes", Quote, QuoteIn, before_create=_auto_quote_number)
crud("worklogs", "worklogs", WorkLog, WorkLogIn)
crud("documents", "documents", Document, DocumentIn)
crud("payments", "payments", Payment, PaymentIn)


# ---------- Számla segédfüggvények ----------
def fmt_ft(v: float) -> str:
    return f"{float(v or 0):,.0f} Ft".replace(",", " ")


def invoice_total(doc: dict) -> float:
    """Számla bruttó összege: a tárolt total, ha van, egyébként a tételekből számolt."""
    t = doc.get("total")
    if t is not None and float(t) > 0:
        return float(t)
    return totals(doc)[2]


def eff_status(doc: dict) -> str:
    """Effektív számlastátusz: a Lejárt a fizetési határidőből automatikusan számított."""
    s = doc.get("status", "")
    if s == "kiallitva":
        due = str(doc.get("due_date") or "")
        if due:
            try:
                if datetime.fromisoformat(due[:10]).date() < datetime.now(timezone.utc).date():
                    return "lejart"
            except ValueError:
                pass
    return s


def is_issued(doc: dict) -> bool:
    return eff_status(doc) in ("kiallitva", "lejart", "fizetve")


async def next_doc_number(user_id: str, year: int, prefix: str, seq_key: str, coll) -> str:
    """Atomikus, évenként újrainduló sorszám: <prefix><XXX> (pl. SZ-2026-001, AJ-2026-001)."""
    key = f"{seq_key}_{user_id}_{year}"
    doc = await db.counters.find_one({"_id": key})
    if doc is None:
        # Első használat: a meglévő legnagyobb sorszám után indulunk
        max_seq = 0
        for d in await db[coll].find({"user_id": user_id, "number": {"$regex": f"^{re.escape(prefix)}"}},
                                     {"number": 1}).to_list(1000):
            try:
                max_seq = max(max_seq, int(d["number"][len(prefix):]))
            except (ValueError, IndexError):
                pass
        try:
            await db.counters.insert_one({"_id": key, "seq": max_seq})
        except Exception:
            pass
    res = await db.counters.find_one_and_update({"_id": key}, {"$inc": {"seq": 1}},
                                                return_document=ReturnDocument.AFTER)
    return f"{prefix}{res['seq']:03d}"


async def next_invoice_number(user_id: str, year: int) -> str:
    """Atomikus, évenként újrainduló számlasorszám: SZ-<év>-<XXX>."""
    return await next_doc_number(user_id, year, f"SZ-{year}-", "invoice_seq", "invoices")


async def log_change(user: dict, kind: str, action: str, entity_id: str, title: str, detail: str = ""):
    """Munkanapló: minden releváns változás rögzítése (ki, mikor, mit)."""
    await db.changes.insert_one({
        "id": str(uuid.uuid4()), "user_id": user["id"], "created_at": now_iso(),
        "actor": user.get("name", "") or user.get("email", ""),
        "kind": kind, "action": action, "entity_id": entity_id,
        "title": title, "detail": detail,
    })


async def _invoice_from_job(job: dict, user: dict) -> Invoice:
    """Számla létrehozása munkából: az ajánlat tételei, ÁFA-ja és végösszege öröklődik."""
    vat_rate = 27
    quote = await db.quotes.find_one({"job_id": job["id"], "user_id": user["id"]}, {"_id": 0})
    if quote:
        vat_rate = float(quote.get("vat_rate") or 27)
        # Az ajánlat tételei változatlan szerkezettel öröklődnek (nincs mesterséges tétel)
        items = [LineItem(**i) for i in (quote.get("items") or [])]
        # Az ajánlat végösszege a TELJES ajánlatból számolódik (tételek + anyagköltség + munkadíj)
        gross = totals(quote)[2]
        if gross <= 0:
            gross = float(job.get("value") or 0)
        # Konzisztencia: a számla tételei pontosan fedjék a végösszeget, hogy a nettó/ÁFA/bruttó
        # és a tárolt összeg mindenhol (lista, PDF, statisztika) azonos legyen
        items_gross = totals({"items": [i.model_dump() for i in items], "vat_rate": vat_rate})[2]
        if items_gross > 0 and abs(items_gross - gross) > 0.01:
            factor = gross / items_gross
            for it in items:
                it.unit_price = round(float(it.unit_price) * factor, 2)
        elif items_gross <= 0 and gross > 0:
            # A tétel(ek) nulla értékűek, de az ajánlatnak van értéke (pl. anyag-/munkadíj):
            # egyetlen, valós összeget hordozó tétel készül az első tétel megnevezésével
            first = items[0] if items else None
            items = [LineItem(description=(first.description if first else job.get("title", "Elvégzett munka")),
                              quantity=1, unit=(first.unit if first else "alk"),
                              unit_price=round(gross / (1 + vat_rate / 100), 2))]
    else:
        gross = float(job.get("value") or 0)
        items = [LineItem(description=job.get("title", "Elvégzett munka"), quantity=1, unit="alk",
                          unit_price=round(gross / (1 + vat_rate / 100), 2) if gross else 0)]
    if not items:
        items = [LineItem(description=job.get("title", "Elvégzett munka"), quantity=1, unit="alk", unit_price=0)]
    today = datetime.now(timezone.utc).date()
    number = await next_invoice_number(user["id"], today.year)
    inv = Invoice(user_id=user["id"], number=number,
                  customer_id=job.get("customer_id", ""), customer_name=job.get("customer_name", ""),
                  job_id=job["id"], title=job.get("title", ""), status="kiallitva",
                  issue_date=today.isoformat(), due_date=(today + timedelta(days=8)).isoformat(),
                  vat_rate=vat_rate, items=items)
    inv.total = gross if gross > 0 else totals(inv.model_dump())[2]
    return inv


# ---------- Munkák (státuszváltás naplózása) ----------
@api_router.get("/jobs", response_model=List[Job])
async def list_jobs(user: dict = Depends(current_user)):
    docs = await db.jobs.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return [Job(**d) for d in docs]


@api_router.post("/jobs", response_model=Job)
async def create_job(payload: JobIn, user: dict = Depends(current_user)):
    obj = Job(**payload.model_dump(), user_id=user["id"])
    await db.jobs.insert_one(obj.model_dump())
    await log_change(user, "munka", "letrehozas", obj.id, obj.title)
    return obj


@api_router.get("/jobs/{job_id}", response_model=Job)
async def get_job(job_id: str, user: dict = Depends(current_user)):
    doc = await db.jobs.find_one({"id": job_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Nem található")
    return Job(**doc)


@api_router.put("/jobs/{job_id}", response_model=Job)
async def update_job(job_id: str, payload: JobIn, user: dict = Depends(current_user)):
    doc = await db.jobs.find_one({"id": job_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Nem található")
    old_status = doc.get("status", "")
    for k, v in payload.model_dump().items():
        doc[k] = v
    doc["user_id"] = user["id"]
    await db.jobs.replace_one({"id": job_id, "user_id": user["id"]}, doc)
    new_status = payload.model_dump().get("status")
    if new_status and new_status != old_status:
        await log_change(user, "munka", "statusz_modositas", job_id, doc.get("title", ""),
                         f"{old_status} → {new_status}")
    return Job(**doc)


@api_router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, user: dict = Depends(current_user)):
    res = await db.jobs.delete_one({"id": job_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Nem található")
    return {"ok": True}


# ---------- Számlák (automatikus sorszám, +8 nap, egyedi job_id, Lejárt státusz) ----------
@api_router.get("/invoices", response_model=List[Invoice])
async def list_invoices(user: dict = Depends(current_user)):
    docs = await db.invoices.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    out = []
    for d in docs:
        d = dict(d)
        d["total"] = invoice_total(d)
        d["status"] = eff_status(d)
        out.append(Invoice(**d))
    return out


@api_router.post("/invoices", response_model=Invoice)
async def create_invoice(payload: InvoiceIn, user: dict = Depends(current_user)):
    data = payload.model_dump()
    job = None
    if data.get("job_id"):
        job = await db.jobs.find_one({"id": data["job_id"], "user_id": user["id"]}, {"_id": 0})
        if not job:
            raise HTTPException(404, "Munka nem található")
        existing = await db.invoices.find_one({"job_id": data["job_id"], "user_id": user["id"]}, {"_id": 0})
        if existing:
            raise HTTPException(400, "Ehhez a munkához már létezik számla")
    if job:
        inv = await _invoice_from_job(job, user)
    else:
        today = datetime.now(timezone.utc).date()
        issue = str(data.get("issue_date") or today.isoformat())[:10]
        number = await next_invoice_number(user["id"], today.year)
        items = [LineItem(**i) for i in (data.get("items") or [])]
        try:
            due = (datetime.fromisoformat(issue).date() + timedelta(days=8)).isoformat()
        except ValueError:
            due = ""
        inv = Invoice(user_id=user["id"], number=number,
                      customer_id=data.get("customer_id", ""), customer_name=data.get("customer_name", ""),
                      job_id=data.get("job_id", ""), title=data.get("title") or "Számla",
                      status=data.get("status") or "kiallitva", issue_date=issue, due_date=due,
                      payment_method=data.get("payment_method") or "atutalas",
                      vat_rate=float(data.get("vat_rate") or 27), notes=data.get("notes") or "",
                      items=items)
        inv.total = totals(inv.model_dump())[2]
    await db.invoices.insert_one(inv.model_dump())
    await log_change(user, "szamla", "letrehozas", inv.id, f"{inv.number} – {inv.customer_name or inv.title}",
                     f"Bruttó {fmt_ft(inv.total)}")
    out = inv.model_dump()
    out["total"] = invoice_total(out)
    out["status"] = eff_status(out)
    return Invoice(**out)


@api_router.get("/invoices/{invoice_id}", response_model=Invoice)
async def get_invoice(invoice_id: str, user: dict = Depends(current_user)):
    doc = await db.invoices.find_one({"id": invoice_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Nem található")
    doc = dict(doc)
    doc["total"] = invoice_total(doc)
    doc["status"] = eff_status(doc)
    return Invoice(**doc)


@api_router.put("/invoices/{invoice_id}", response_model=Invoice)
async def update_invoice(invoice_id: str, payload: InvoiceIn, user: dict = Depends(current_user)):
    doc = await db.invoices.find_one({"id": invoice_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Nem található")
    old_total = invoice_total(doc)
    old_status = doc.get("status", "")
    data = payload.model_dump()
    changes_log = []

    # Összeg/tétel konzisztencia: a PUT-ban megadott összeg az irányadó (inline szerkesztés,
    # Fizetve gomb, modál-mentés), a tételeket ehhez arányosan igazítjuk, hogy a PDF és a
    # statisztikák mindig ugyanazt az értéket mutassák. Tétel-módosításnál a frontend a
    # tételekből számolt összeget küldi – így az is mindig konzisztens.
    new_total = data.get("total")
    if new_total is not None:
        new_total = float(new_total)
    if data.get("items") is not None:
        doc["items"] = [LineItem(**i).model_dump() for i in data["items"]]
    if new_total is None:
        doc["total"] = totals(doc)[2]
    elif abs(new_total - old_total) > 0.01:
        computed = totals(doc)[2]
        if computed > 0 and abs(computed - new_total) > 0.01:
            factor = new_total / computed
            for it in doc["items"]:
                it["unit_price"] = round(float(it.get("unit_price") or 0) * factor, 4)
        doc["total"] = new_total
        changes_log.append(("osszeg_modositas", f"{fmt_ft(old_total)} → {fmt_ft(new_total)}"))
    else:
        doc["total"] = new_total
    for k in ("customer_id", "customer_name", "title", "payment_method", "notes"):
        if data.get(k) is not None:
            doc[k] = data[k]
    doc["vat_rate"] = float(data.get("vat_rate") if data.get("vat_rate") is not None else doc.get("vat_rate") or 27)

    issue = str(data.get("issue_date") or doc.get("issue_date") or datetime.now(timezone.utc).date().isoformat())[:10]
    doc["issue_date"] = issue
    if data.get("due_date"):
        doc["due_date"] = str(data["due_date"])[:10]
    else:
        try:
            doc["due_date"] = (datetime.fromisoformat(issue).date() + timedelta(days=8)).isoformat()
        except ValueError:
            doc["due_date"] = ""

    new_status = data.get("status") or doc.get("status", "kiallitva")
    if new_status == "lejart":
        new_status = "kiallitva"  # a Lejárt csak megjelenített státusz
    if new_status != old_status:
        doc["status"] = new_status
        changes_log.append(("statusz_modositas", f"{old_status} → {new_status}"))
    else:
        doc["status"] = new_status

    doc["user_id"] = user["id"]
    await db.invoices.replace_one({"id": invoice_id, "user_id": user["id"]}, doc)
    for action, detail in changes_log:
        await log_change(user, "szamla", action, invoice_id,
                         f"{doc.get('number', '')} – {doc.get('customer_name') or doc.get('title')}", detail)
    out = dict(doc)
    out["total"] = invoice_total(out)
    out["status"] = eff_status(out)
    return Invoice(**out)


@api_router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str, user: dict = Depends(current_user)):
    res = await db.invoices.delete_one({"id": invoice_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Nem található")
    return {"ok": True}


# ---------- File upload / download ----------
@api_router.post("/uploads", response_model=Document)
async def upload_document(file: UploadFile = File(...), category: str = Form("egyeb"),
                          customer_name: str = Form(""), customer_id: str = Form(""),
                          user: dict = Depends(current_user)):
    data = await file.read()
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(400, "A fájl túl nagy (max 15 MB)")
    path, mime = storage_path(user["id"], file.filename or "fajl.bin")
    try:
        result = put_object(path, data, file.content_type or mime)
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(502, "A feltöltés nem sikerült")
    doc = Document(user_id=user["id"], name=file.filename or "fájl", category=category,
                   customer_name=customer_name, customer_id=customer_id,
                   size_kb=round(len(data) / 1024, 1),
                   storage_path=result["path"], content_type=file.content_type or mime)
    await db.documents.insert_one(doc.model_dump())
    return doc


@api_router.post("/uploads/logo")
async def upload_logo(file: UploadFile = File(...), user: dict = Depends(current_user)):
    data = await file.read()
    if len(data) > 4 * 1024 * 1024:
        raise HTTPException(400, "A logó túl nagy (max 4 MB)")
    path, mime = storage_path(user["id"], file.filename or "logo.png")
    try:
        result = put_object(path, data, file.content_type or mime)
    except Exception as e:
        logger.error(f"Logo upload failed: {e}")
        raise HTTPException(502, "A feltöltés nem sikerült")
    await db.company.update_one({"user_id": user["id"]}, {"$set": {"logo_path": result["path"]}}, upsert=True)
    return {"logo_path": result["path"]}


@api_router.get("/files/{path:path}")
async def download_file(path: str, auth: Optional[str] = Query(None), request: Request = None):
    # Support ?auth=<token> query param (used by <img src>, <a href> in the frontend)
    token = auth
    if not token:
        header = request.headers.get("Authorization", "")
        if header.startswith("Bearer "):
            token = header[7:]
        else:
            token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(401, "Nincs bejelentkezve")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "A munkamenet lejárt")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Érvénytelen token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "Felhasználó nem található")
    doc = await db.documents.find_one({"storage_path": path, "user_id": user["id"]}, {"_id": 0})
    comp = await db.company.find_one({"user_id": user["id"], "logo_path": path}, {"_id": 0})
    if not doc and not comp:
        raise HTTPException(404, "Fájl nem található")
    try:
        data, ctype = get_object(path)
    except Exception:
        raise HTTPException(404, "Fájl nem elérhető")
    return Response(data, media_type=(doc or {}).get("content_type") or ctype)


@api_router.get("/company", response_model=Company)
async def get_company(user: dict = Depends(current_user)):
    doc = await db.company.find_one({"user_id": user["id"]}, {"_id": 0, "user_id": 0})
    return Company(**(doc or {"name": user.get("company_name", "")}))


@api_router.put("/company", response_model=Company)
async def save_company(payload: Company, user: dict = Depends(current_user)):
    data = payload.model_dump()
    await db.company.replace_one({"user_id": user["id"]}, {"user_id": user["id"], **data}, upsert=True)
    return Company(**data)


def totals(doc):
    net = sum(float(i.get("quantity", 0)) * float(i.get("unit_price", 0)) for i in doc.get("items", []))
    net += float(doc.get("material_cost") or 0) + float(doc.get("labor_cost") or 0)
    vat = net * float(doc.get("vat_rate") or 0) / 100
    return net, vat, net + vat


# ---------- Quote -> Job, Job -> Invoice ----------
@api_router.post("/quotes/{quote_id}/job", response_model=Job)
async def quote_to_job(quote_id: str, user: dict = Depends(current_user)):
    q = await db.quotes.find_one({"id": quote_id, "user_id": user["id"]}, {"_id": 0})
    if not q:
        raise HTTPException(404, "Ajánlat nem található")
    if q.get("job_id"):
        existing = await db.jobs.find_one({"id": q["job_id"], "user_id": user["id"]}, {"_id": 0})
        if existing:
            return Job(**existing)
    _, _, gross = totals(q)
    job = Job(user_id=user["id"], title=q.get("title") or "Munka ajánlatból", customer_id=q.get("customer_id", ""),
              customer_name=q.get("customer_name", ""), status="tervezett", value=gross,
              description=q.get("description") or q.get("notes", ""), quote_id=quote_id)
    await db.jobs.insert_one(job.model_dump())
    await db.quotes.update_one({"id": quote_id, "user_id": user["id"]},
                               {"$set": {"job_id": job.id, "status": "elfogadva"}})
    await log_change(user, "ajanlat", "elfogadas", quote_id, q.get("title") or q.get("number", ""),
                     f"Munka létrehozva: {job.title} ({fmt_ft(gross)})")
    return job


@api_router.post("/jobs/{job_id}/invoice", response_model=Invoice)
async def job_to_invoice(job_id: str, user: dict = Depends(current_user)):
    job = await db.jobs.find_one({"id": job_id, "user_id": user["id"]}, {"_id": 0})
    if not job:
        raise HTTPException(404, "Munka nem található")
    existing = await db.invoices.find_one({"job_id": job_id, "user_id": user["id"]}, {"_id": 0})
    if existing:
        raise HTTPException(400, "Ehhez a munkához már létezik számla")
    inv = await _invoice_from_job(job, user)
    await db.invoices.insert_one(inv.model_dump())
    await log_change(user, "szamla", "letrehozas", inv.id, f"{inv.number} – {inv.customer_name or inv.title}",
                     f"Bruttó {fmt_ft(inv.total)}")
    out = inv.model_dump()
    out["total"] = invoice_total(out)
    out["status"] = eff_status(out)
    return Invoice(**out)


# ---------- Központi statisztika (Dashboard, Pénzügy, Riportok közös forrása) ----------
async def compute_stats(uid: str) -> dict:
    """Minden statisztika az aktuális adatokból számolódik – nincs gyorstárazott, eltérő érték."""
    customers = await db.customers.count_documents({"user_id": uid})
    jobs = await db.jobs.find({"user_id": uid}, {"_id": 0}).to_list(1000)
    quotes = await db.quotes.find({"user_id": uid}, {"_id": 0}).to_list(1000)
    invoices = await db.invoices.find({"user_id": uid}, {"_id": 0}).to_list(1000)
    logs = await db.worklogs.find({"user_id": uid}, {"_id": 0}).to_list(1000)
    payments = await db.payments.find({"user_id": uid}, {"_id": 0}).to_list(1000)

    active = [j for j in jobs if j.get("status") in ("tervezett", "folyamatban")]
    open_quotes = [q for q in quotes if q.get("status") == "letrehozva"]
    issued_inv = [i for i in invoices if is_issued(i)]
    now = datetime.now(timezone.utc)
    year = now.year
    month_prefix = now.strftime("%Y-%m")

    def gross(d):
        return invoice_total(d)

    monthly_revenue = sum(gross(i) for i in issued_inv if str(i.get("issue_date", "")).startswith(month_prefix))
    yearly_revenue = sum(gross(i) for i in issued_inv if str(i.get("issue_date", "")).startswith(str(year)))
    paid_revenue = sum(gross(i) for i in invoices if eff_status(i) == "fizetve")
    unpaid_value = sum(gross(i) for i in invoices if eff_status(i) in ("kiallitva", "lejart"))
    overdue_value = sum(gross(i) for i in invoices if eff_status(i) == "lejart")

    def month_expense(m):
        return sum(float(p.get("amount") or 0) for p in payments
                   if p.get("kind") == "kiadas" and str(p.get("date", "")).startswith(m))

    def month_extra(m):
        return sum(float(p.get("amount") or 0) for p in payments
                   if p.get("kind") == "bevetel" and str(p.get("date", "")).startswith(m))

    months = []
    for m in range(1, 13):
        key = f"{year}-{str(m).zfill(2)}"
        rel = [i for i in issued_inv if str(i.get("issue_date", "")).startswith(key)]
        revenue = sum(gross(i) for i in rel) + month_extra(key)
        expense = month_expense(key)
        months.append({"month": key, "revenue": revenue, "expense": expense,
                       "profit": revenue - expense, "count": len(rel)})

    by_customer = {}
    for i in issued_inv:
        by_customer[i.get("customer_name") or "Egyéb"] = by_customer.get(i.get("customer_name") or "Egyéb", 0) + gross(i)

    accepted = len([q for q in quotes if q.get("status") == "elfogadva"])
    yearly_expense = sum(m["expense"] for m in months)
    extra_income = sum(m["revenue"] for m in months) - yearly_revenue
    profit = yearly_revenue + extra_income - yearly_expense
    # A Dashboard „Következő lépések” listájához: mi vár a felhasználóra
    to_invoice = len([j for j in jobs if j.get("status") == "elkeszult"
                      and not any(i.get("job_id") == j.get("id") for i in invoices)])
    unpaid_invoices = len([i for i in invoices if eff_status(i) in ("kiallitva", "lejart")])

    return {
        "year": year,
        "customers": customers,
        "active_jobs": len(active),
        "open_quotes": len(open_quotes),
        "open_quotes_value": sum(gross(q) for q in open_quotes),
        "invoices": len(invoices),
        "invoice_count": len(invoices),
        "monthly_revenue": monthly_revenue,
        "yearly_revenue": yearly_revenue,
        "paid_revenue": paid_revenue,
        "unpaid_value": unpaid_value,
        "unpaid_revenue": unpaid_value,
        "overdue_value": overdue_value,
        "monthly_expense": month_expense(month_prefix),
        "yearly_expense": yearly_expense,
        "extra_income": extra_income,
        "profit": profit,
        "yearly_profit": profit,
        "closed_jobs": len([j for j in jobs if j.get("status") == "elkeszult"]),
        "to_invoice": to_invoice,
        "unpaid_invoices": unpaid_invoices,
        "pipeline": sum(float(j.get("value") or 0) for j in active),
        "hours_logged": sum(float(l.get("hours") or 0) for l in logs),
        "jobs_by_status": {s: len([j for j in jobs if j.get("status") == s]) for s in ("tervezett", "folyamatban", "elkeszult")},
        "months": months,
        "top_customers": sorted([{"name": k, "revenue": v} for k, v in by_customer.items()], key=lambda x: -x["revenue"])[:5],
        "quote_acceptance": round(accepted / len(quotes) * 100) if quotes else 0,
    }


@api_router.get("/stats")
async def stats(user: dict = Depends(current_user)):
    return await compute_stats(user["id"])


@api_router.get("/changes")
async def changes(user: dict = Depends(current_user)):
    """Munkanapló változás-feed: ki, mikor, mit módosított."""
    docs = await db.changes.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return docs


@api_router.get("/dashboard")
async def dashboard(user: dict = Depends(current_user)):
    uid = user["id"]
    s = await compute_stats(uid)
    jobs = await db.jobs.find({"user_id": uid}, {"_id": 0}).to_list(1000)
    quotes = await db.quotes.find({"user_id": uid}, {"_id": 0}).to_list(1000)
    invoices = await db.invoices.find({"user_id": uid}, {"_id": 0}).to_list(1000)

    def gross(d):
        return invoice_total(d)

    return {
        **s,
        "recent_jobs": sorted(jobs, key=lambda j: j.get("created_at", ""), reverse=True)[:5],
        "recent_quotes": [{**q, "total": gross(q)} for q in sorted(quotes, key=lambda q: q.get("created_at", ""), reverse=True)[:5]],
        "recent_invoices": [{**i, "total": gross(i), "status": eff_status(i)}
                            for i in sorted(invoices, key=lambda i: i.get("created_at", ""), reverse=True)[:5]],
    }


@api_router.get("/reports")
async def reports(user: dict = Depends(current_user)):
    s = await compute_stats(user["id"])
    return {
        "year": s["year"],
        "months": s["months"],
        "yearly_revenue": s["yearly_revenue"],
        "yearly_expense": s["yearly_expense"],
        "yearly_profit": s["profit"],
        "paid_revenue": s["paid_revenue"],
        "unpaid_revenue": s["unpaid_value"],
        "invoice_count": s["invoice_count"],
        "closed_jobs": s["closed_jobs"],
        "quote_acceptance": s["quote_acceptance"],
        "top_customers": s["top_customers"],
    }


# ---------- PDF ----------
_FONTS = None


def _font():
    global _FONTS
    if _FONTS:
        return _FONTS
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    import os
    # Windows + Linux font keresés
    possible_regs = [
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/DejaVuSans.ttf",
    ] + glob.glob("/usr/share/fonts/**/DejaVuSans.ttf", recursive=True) + glob.glob("C:/Windows/Fonts/segoeui*.ttf")
    
    possible_bolds = [
        "C:/Windows/Fonts/arialbd.ttf",
        "C:/Windows/Fonts/DejaVuSans-Bold.ttf",
    ] + glob.glob("/usr/share/fonts/**/DejaVuSans-Bold.ttf", recursive=True)

    reg = next((p for p in possible_regs if os.path.exists(p)), None)
    bold = next((p for p in possible_bolds if os.path.exists(p)), None)

    if reg:
        pdfmetrics.registerFont(TTFont("DejaVu", reg))
        pdfmetrics.registerFont(TTFont("DejaVu-Bold", bold if bold else reg))
        _FONTS = ("DejaVu", "DejaVu-Bold")
    else:
        _FONTS = ("Helvetica", "Helvetica-Bold")
    return _FONTS


def huf(v):
    return f"{v:,.0f}".replace(",", " ") + " Ft"


def build_pdf(doc, comp, cust, kind: str) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas
    from reportlab.lib import colors
    from reportlab.lib.utils import ImageReader

    base, bold = _font()
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    W, H = A4
    cyan = colors.HexColor("#06b6d4")
    grey = colors.HexColor("#6b7280")
    dark = colors.HexColor("#1f2937")

    c.setFillColor(cyan)
    c.rect(0, H - 30 * mm, W, 30 * mm, stroke=0, fill=1)
    c.setFillColor(colors.white)
    logo = None
    if comp.get("logo_path"):
        try:
            data, _ = get_object(comp["logo_path"])
            logo = ImageReader(io.BytesIO(data))
        except Exception:
            logo = None
    if logo is None and comp.get("logo_url"):
        try:
            logo = ImageReader(comp["logo_url"])
        except Exception:
            logo = None
    if logo is not None:
        try:
            c.drawImage(logo, 20 * mm, H - 25 * mm, width=22 * mm, height=18 * mm,
                        preserveAspectRatio=True, mask="auto")
        except Exception:
            logo = None
    c.setFont(bold, 19)
    c.drawString(20 * mm + (26 * mm if logo is not None else 0), H - 19 * mm, comp.get("name") or "WorkMate HU")
    c.setFont(bold, 11)
    c.drawRightString(W - 20 * mm, H - 19 * mm, "ÁRAJÁNLAT" if kind == "quote" else "SZÁMLA")

    y = H - 42 * mm
    c.setFont(base, 9)
    c.setFillColor(grey)
    for line in [comp.get("contact_name", ""), comp.get("address", ""), comp.get("email", ""), comp.get("phone", ""),
                 f"Adószám: {comp.get('tax_number')}" if comp.get("tax_number") else "",
                 f"Bankszámla: {comp.get('bank_account')}" if comp.get("bank_account") else ""]:
        if line:
            c.drawString(20 * mm, y, str(line))
            y -= 5 * mm

    yr = H - 42 * mm
    c.setFillColor(dark)
    c.setFont(bold, 10)
    label = "Ajánlat sz." if kind == "quote" else "Számla sz."
    c.drawRightString(W - 20 * mm, yr, f"{label}: {doc.get('number') or doc['id'][:8]}")
    c.setFont(base, 9)
    c.setFillColor(grey)
    rows = [f"Ügyfél: {doc.get('customer_name') or '-'}"]
    if cust:
        rows += [cust.get("address", ""), f"Adószám: {cust.get('tax_number')}" if cust.get("tax_number") else ""]
    if kind == "quote":
        rows.append(f"Érvényes: {doc.get('valid_until') or '-'}")
    else:
        rows += [f"Kelt: {doc.get('issue_date') or '-'}", f"Fizetési határidő: {doc.get('due_date') or '-'}",
                 f"Fizetési mód: {'Átutalás' if doc.get('payment_method') == 'atutalas' else 'Készpénz'}"]
    for i, r in enumerate([r for r in rows if r]):
        c.drawRightString(W - 20 * mm, yr - (i + 1) * 5 * mm, str(r))
        yr -= 0

    y = min(y, yr - len([r for r in rows if r]) * 5 * mm) - 8 * mm
    c.setFillColor(dark)
    c.setFont(bold, 13)
    c.drawString(20 * mm, y, doc.get("title") or ("Árajánlat" if kind == "quote" else "Számla"))
    y -= 11 * mm

    c.setFillColor(colors.HexColor("#f5f7fb"))
    c.rect(20 * mm, y - 2.5 * mm, W - 40 * mm, 8 * mm, stroke=0, fill=1)
    c.setFillColor(grey)
    c.setFont(bold, 9)
    c.drawString(22 * mm, y, "Megnevezés")
    c.drawRightString(115 * mm, y, "Menny.")
    c.drawRightString(135 * mm, y, "Egység")
    c.drawRightString(165 * mm, y, "Egységár")
    c.drawRightString(W - 22 * mm, y, "Összesen")
    y -= 9 * mm

    c.setFont(base, 9)
    net = 0
    pdf_items = list(doc.get("items", []))
    if float(doc.get("material_cost") or 0):
        pdf_items.append({"description": "Anyagköltség", "quantity": 1, "unit": "alk",
                          "unit_price": float(doc["material_cost"])})
    if float(doc.get("labor_cost") or 0):
        pdf_items.append({"description": "Munkadíj", "quantity": 1, "unit": "alk",
                          "unit_price": float(doc["labor_cost"])})
    for it in pdf_items:
        tot = float(it.get("quantity", 0)) * float(it.get("unit_price", 0))
        net += tot
        c.setFillColor(dark)
        c.drawString(22 * mm, y, str(it.get("description", ""))[:55])
        c.drawRightString(115 * mm, y, f"{float(it.get('quantity', 0)):g}")
        c.drawRightString(135 * mm, y, str(it.get("unit", "")))
        c.drawRightString(165 * mm, y, huf(float(it.get("unit_price", 0))))
        c.drawRightString(W - 22 * mm, y, huf(tot))
        y -= 7 * mm
        c.setStrokeColor(colors.HexColor("#e5e7eb"))
        c.line(20 * mm, y + 2 * mm, W - 20 * mm, y + 2 * mm)
        if y < 55 * mm:
            c.showPage()
            y = H - 30 * mm
            c.setFont(base, 9)

    rate = float(doc.get("vat_rate") or 0)
    stored_total = float(doc.get("total") or 0)
    computed = net + net * rate / 100
    if stored_total > 0 and abs(computed - stored_total) > 0.5:
        # A rendszerben tárolt bruttó az irányadó (a tétel-egységárak kerekítése miatt
        # a tételekből számolt érték apró eltérést mutathat – a PDF, a táblázat és a
        # statisztikák mindig ugyanazt az összeget mutassák)
        net = stored_total / (1 + rate / 100) if rate else stored_total
        vat = stored_total - net
    else:
        vat = net * rate / 100
    y -= 7 * mm
    c.setFont(base, 10)
    for lbl, val in [("Nettó összesen:", net), (f"ÁFA ({rate:g}%):", vat)]:
        c.setFillColor(grey)
        c.drawRightString(165 * mm, y, lbl)
        c.setFillColor(dark)
        c.drawRightString(W - 22 * mm, y, huf(val))
        y -= 6 * mm
    y -= 3 * mm
    c.setFillColor(cyan)
    c.setFont(bold, 12)
    c.drawRightString(165 * mm, y, "Bruttó összesen:")
    c.drawRightString(W - 22 * mm, y, huf(net + vat))

    if doc.get("notes"):
        y -= 14 * mm
        c.setFont(bold, 9)
        c.setFillColor(dark)
        c.drawString(20 * mm, y, "Megjegyzés")
        c.setFont(base, 9)
        c.setFillColor(grey)
        for i, chunk in enumerate([doc["notes"][i:i + 95] for i in range(0, len(doc["notes"]), 95)][:6]):
            c.drawString(20 * mm, y - (i + 1) * 5 * mm, chunk)

    c.setFont(base, 8)
    c.setFillColor(grey)
    c.drawCentredString(W / 2, 15 * mm, comp.get("quote_footer") or "Készült a WorkMate HU rendszerrel")
    c.showPage()
    c.save()
    return buf.getvalue()


async def _pdf_ctx(coll, item_id, user):
    doc = await db[coll].find_one({"id": item_id, "user_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Nem található")
    comp = await db.company.find_one({"user_id": user["id"]}, {"_id": 0}) or {}
    cust = await db.customers.find_one({"id": doc.get("customer_id"), "user_id": user["id"]}, {"_id": 0}) if doc.get("customer_id") else None
    return doc, comp, cust


@api_router.get("/quotes/{quote_id}/pdf")
async def quote_pdf(quote_id: str, user: dict = Depends(current_user)):
    doc, comp, cust = await _pdf_ctx("quotes", quote_id, user)
    data = build_pdf(doc, comp, cust, "quote")
    name = f"ajanlat-{doc.get('number') or doc['id'][:8]}.pdf"
    return Response(data, media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="{name}"'})


@api_router.get("/invoices/{invoice_id}/pdf")
async def invoice_pdf(invoice_id: str, user: dict = Depends(current_user)):
    doc, comp, cust = await _pdf_ctx("invoices", invoice_id, user)
    data = build_pdf(doc, comp, cust, "invoice")
    name = f"szamla-{doc.get('number') or doc['id'][:8]}.pdf"
    return Response(data, media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="{name}"'})


@api_router.post("/quotes/{quote_id}/send")
async def send_quote(quote_id: str, payload: SendDocIn, user: dict = Depends(current_user)):
    doc, comp, cust = await _pdf_ctx("quotes", quote_id, user)
    to = payload.to or (cust or {}).get("email")
    if not to:
        raise HTTPException(400, "Nincs megadva e-mail cím")
    html = doc_email_html(doc, comp, "quote")
    if payload.message:
        html = f'<div style="font-family:Arial;padding:16px 0;color:#1f2937">{payload.message}</div>' + html
    try:
        await send_email(to, f"Árajánlat – {doc.get('title') or doc.get('number')}", html, comp.get("email"))
    except Exception as e:
        logger.error(f"Quote email failed: {e}")
        raise HTTPException(502, "Az e-mail küldése nem sikerült")
    await db.quotes.update_one({"id": quote_id, "user_id": user["id"]}, {"$set": {"status": "letrehozva"}})
    return {"ok": True, "to": to}


@api_router.post("/invoices/{invoice_id}/send")
async def send_invoice(invoice_id: str, payload: SendDocIn, user: dict = Depends(current_user)):
    doc, comp, cust = await _pdf_ctx("invoices", invoice_id, user)
    to = payload.to or (cust or {}).get("email")
    if not to:
        raise HTTPException(400, "Nincs megadva e-mail cím")
    html = doc_email_html(doc, comp, "invoice")
    if payload.message:
        html = f'<div style="font-family:Arial;padding:16px 0;color:#1f2937">{payload.message}</div>' + html
    try:
        await send_email(to, f"Számla – {doc.get('number') or doc.get('title')}", html, comp.get("email"))
    except Exception as e:
        logger.error(f"Invoice email failed: {e}")
        raise HTTPException(502, "Az e-mail küldése nem sikerült")
    if doc.get("status") == "vazlat":
        await db.invoices.update_one({"id": invoice_id, "user_id": user["id"]}, {"$set": {"status": "kiallitva"}})
    return {"ok": True, "to": to}


# ---------- Public contact ----------
@api_router.post("/contacts")
async def create_contact(payload: ContactIn):
    doc = {"id": str(uuid.uuid4()), "name": payload.name, "email": payload.email.lower(),
           "subject": payload.subject, "message": payload.message, "phone": "",
           "handled": False, "created_at": now_iso()}
    await db.contacts.insert_one(dict(doc))
    target = os.environ.get("CONTACT_EMAIL")
    if target:
        html = (f'<div style="font-family:Arial;color:#1f2937"><h3 style="color:#06b6d4">Új üzenet a WorkMate HU oldalról</h3>'
                f'<p><b>Név:</b> {payload.name}<br/><b>E-mail:</b> {payload.email}<br/>'
                f'<b>Tárgy:</b> {payload.subject}</p><p style="white-space:pre-wrap">{payload.message}</p></div>')
        try:
            await send_email(target, f"WorkMate HU kapcsolat – {payload.subject}", html, payload.email)
        except Exception as e:
            logger.error(f"Contact email failed: {e}")
    return {"ok": True, "message": "Köszönjük, megkaptuk az üzenetet!"}


# ---------- Global search ----------
@api_router.get("/search")
async def global_search(q: str = Query(""), user: dict = Depends(current_user)):
    term = (q or "").strip()
    if len(term) < 2:
        return {"results": []}
    rx = {"$regex": term, "$options": "i"}
    uid = user["id"]
    results = []

    async def collect(coll, fields, kind, route, title_field, sub_fields):
        docs = await db[coll].find({"user_id": uid, "$or": [{f: rx} for f in fields]}, {"_id": 0}).limit(6).to_list(6)
        for d in docs:
            sub = " · ".join(str(d.get(f)) for f in sub_fields if d.get(f))
            results.append({"kind": kind, "id": d["id"], "title": d.get(title_field) or "—",
                            "subtitle": sub, "route": route})

    await collect("customers", ["name", "contact", "email", "phone", "address"], "Ügyfél", "/ugyfelek", "name", ["contact", "email"])
    await collect("jobs", ["title", "customer_name", "description"], "Munka", "/munkak", "title", ["customer_name", "status"])
    await collect("quotes", ["title", "number", "customer_name"], "Ajánlat", "/ajanlatok", "title", ["number", "customer_name"])
    await collect("invoices", ["title", "number", "customer_name"], "Számla", "/szamlak", "title", ["number", "customer_name"])
    await collect("documents", ["name", "customer_name"], "Dokumentum", "/dokumentumok", "name", ["customer_name"])
    await collect("payments", ["title", "notes", "customer_name"], "Pénzügy", "/penzugy", "title", ["customer_name"])
    return {"results": results[:24]}


# ---------- Customer history ----------
@api_router.get("/customers/{customer_id}/history")
async def customer_history(customer_id: str, user: dict = Depends(current_user)):
    uid = user["id"]
    cust = await db.customers.find_one({"id": customer_id, "user_id": uid}, {"_id": 0})
    if not cust:
        raise HTTPException(404, "Ügyfél nem található")
    jobs = await db.jobs.find({"user_id": uid, "customer_id": customer_id}, {"_id": 0}).to_list(500)
    quotes = await db.quotes.find({"user_id": uid, "customer_id": customer_id}, {"_id": 0}).to_list(500)
    invoices = await db.invoices.find({"user_id": uid, "customer_id": customer_id}, {"_id": 0}).to_list(500)
    link = {"$or": [{"customer_id": customer_id}, {"customer_name": cust.get("name")}]}
    payments = await db.payments.find({"user_id": uid, **link}, {"_id": 0}).to_list(500)
    docs = await db.documents.find({"user_id": uid, **link}, {"_id": 0}).to_list(500)
    job_ids = [j["id"] for j in jobs]
    logs = await db.worklogs.find({"user_id": uid, "job_id": {"$in": job_ids}}, {"_id": 0}).to_list(500) if job_ids else []
    invoiced = sum(totals(i)[2] for i in invoices if i.get("status") in ("kiallitva", "fizetve"))
    paid = sum(totals(i)[2] for i in invoices if i.get("status") == "fizetve")
    return {
        "customer": Customer(**cust).model_dump(),
        "jobs": jobs, "quotes": [{**q, "total": totals(q)[2]} for q in quotes],
        "invoices": [{**i, "total": totals(i)[2]} for i in invoices],
        "payments": payments, "documents": docs,
        "stats": {"jobs": len(jobs), "quotes": len(quotes), "invoices": len(invoices),
                  "invoiced": invoiced, "paid": paid, "outstanding": invoiced - paid,
                  "hours": sum(float(l.get("hours") or 0) for l in logs),
                  "open_jobs": len([j for j in jobs if j.get("status") not in ("kesz", "lezarva")])},
    }


# ---------- Calendar ----------
@api_router.get("/calendar")
async def calendar(user: dict = Depends(current_user)):
    uid = user["id"]
    events = []
    for j in await db.jobs.find({"user_id": uid, "deadline": {"$nin": ["", None]}}, {"_id": 0}).to_list(500):
        events.append({"id": j["id"], "date": j["deadline"], "kind": "munka", "title": j.get("title", ""),
                       "subtitle": j.get("customer_name", ""), "status": j.get("status", ""), "route": f"/munkak/{j['id']}"})
    for q in await db.quotes.find({"user_id": uid, "valid_until": {"$nin": ["", None]}}, {"_id": 0}).to_list(500):
        events.append({"id": q["id"], "date": q["valid_until"], "kind": "ajanlat",
                       "title": q.get("title") or q.get("number", ""), "subtitle": q.get("customer_name", ""),
                       "status": q.get("status", ""), "route": "/ajanlatok"})
    for i in await db.invoices.find({"user_id": uid, "due_date": {"$nin": ["", None]}}, {"_id": 0}).to_list(500):
        events.append({"id": i["id"], "date": i["due_date"], "kind": "szamla",
                       "title": i.get("title") or i.get("number", ""), "subtitle": i.get("customer_name", ""),
                       "status": i.get("status", ""), "route": "/szamlak"})
    events.sort(key=lambda e: e["date"])
    return {"events": events}


# ---------- Notifications ----------
@api_router.get("/notifications")
async def notifications(user: dict = Depends(current_user)):
    """Csak valós esemény esetén ad vissza értesítést (közelgő/lejárt határidő, elfogadott ajánlat, számlázandó munka)."""
    uid = user["id"]
    today = datetime.now(timezone.utc).date()
    soon = today + timedelta(days=5)
    items = []

    for j in await db.jobs.find({"user_id": uid, "status": {"$ne": "elkeszult"},
                                 "deadline": {"$nin": ["", None]}}, {"_id": 0}).to_list(200):
        try:
            d = datetime.fromisoformat(str(j["deadline"])[:10]).date()
        except ValueError:
            continue
        if d < today:
            items.append({"id": f"job-late-{j['id']}", "kind": "hatarido", "level": "danger",
                          "title": "Lejárt határidő", "message": f"{j.get('title', '')} – {j['deadline']}",
                          "route": "/munkak"})
        elif d <= soon:
            items.append({"id": f"job-soon-{j['id']}", "kind": "hatarido", "level": "warning",
                          "title": "Közelgő határidő", "message": f"{j.get('title', '')} – {j['deadline']}",
                          "route": "/munkak"})

    for j in await db.jobs.find({"user_id": uid, "status": "elkeszult"}, {"_id": 0}).to_list(200):
        if not await db.invoices.find_one({"user_id": uid, "job_id": j["id"]}):
            items.append({"id": f"job-invoice-{j['id']}", "kind": "szamla", "level": "info",
                          "title": "Számlázható munka", "message": f"{j.get('title', '')} elkészült – készíts számlát",
                          "route": "/szamlak"})

    for q in await db.quotes.find({"user_id": uid, "status": "elfogadva", "job_id": {"$in": ["", None]}},
                                  {"_id": 0}).to_list(200):
        items.append({"id": f"quote-{q['id']}", "kind": "ajanlat", "level": "info",
                      "title": "Elfogadott ajánlat", "message": f"{q.get('title') or q.get('number')} – indíthatod a munkát",
                      "route": "/ajanlatok"})

    for inv in await db.invoices.find({"user_id": uid, "status": "kiallitva",
                                       "due_date": {"$nin": ["", None]}}, {"_id": 0}).to_list(200):
        try:
            d = datetime.fromisoformat(str(inv["due_date"])[:10]).date()
        except ValueError:
            continue
        if d < today:
            items.append({"id": f"inv-{inv['id']}", "kind": "szamla", "level": "danger",
                          "title": "Lejárt fizetési határidő",
                          "message": f"{inv.get('number', '')} – {inv.get('customer_name', '')}",
                          "route": "/szamlak"})

    order = {"danger": 0, "warning": 1, "info": 2}
    items.sort(key=lambda x: order.get(x["level"], 3))
    return {"count": len(items), "items": items[:20]}


# ---------- Demo data ----------
@api_router.post("/seed")
async def seed(user: dict = Depends(current_user)):
    """Demo adatok betöltése a bejelentkezett felhasználó fiókjába (felhasználónként egyszer)."""
    uid = user["id"]
    claim = await db.users.find_one_and_update({"id": uid, "seeded": {"$ne": True}}, {"$set": {"seeded": True}})
    if not claim:
        return {"seeded": False}
    created = await seed_user(db, uid)
    return {"seeded": created}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.customers.create_index("user_id")
    await db.jobs.create_index("user_id")
    await db.quotes.create_index("user_id")
    await db.invoices.create_index("user_id")
    await db.payments.create_index("user_id")
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=86400)
    # migrate legacy status values to the extended workflow
    for old, new in [("uj", "tervezett"), ("erdeklodo", "tervezett"), ("ajanlat_elkuldve", "tervezett"),
                     ("elfogadva", "tervezett"), ("kesz", "elkeszult"), ("lezarva", "elkeszult"),
                     ("szamlazva", "elkeszult")]:
        await db.jobs.update_many({"status": old}, {"$set": {"status": new}})
    for old, new in [("vazlat", "letrehozva"), ("piszkozat", "letrehozva"), ("elkuldve", "letrehozva"),
                     ("munka_letrehozva", "elfogadva")]:
        await db.quotes.update_many({"status": old}, {"$set": {"status": new}})
    email = os.environ.get("DEMO_EMAIL")
    if email and not await db.users.find_one({"email": email}):
        uid = str(uuid.uuid4())
        await db.users.insert_one({"id": uid, "name": "Demo Vállalkozó", "email": email,
                                  "company_name": "WorkMate Demo Kft.",
                                   "password_hash": hash_password(os.environ["DEMO_PASSWORD"]), "created_at": now_iso()})
        await db.company.replace_one({"user_id": uid}, {"user_id": uid, **Company(
            name="WorkMate Demo Kft.", contact_name="Demo Vállalkozó", tax_number="98765432-1-41",
            address="1136 Budapest, Hegedűs Gyula u. 8.", email=email, phone="+36 1 234 5678",
            website="workmate.hu", bank_account="12345678-12345678-12345678",
            quote_footer="Köszönjük, hogy minket választott!", onboarded=True).model_dump()}, upsert=True)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

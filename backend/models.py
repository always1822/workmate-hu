"""WorkMate HU – Pydantic adatmodellek (MongoDB dokumentumok és kérés-sémák)."""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Models ----------
class Owned(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = ""
    created_at: str = Field(default_factory=now_iso)


class Customer(Owned):
    name: str
    contact: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    address: Optional[str] = ""
    tax_number: Optional[str] = ""
    notes: Optional[str] = ""


class CustomerIn(BaseModel):
    name: str
    contact: Optional[str] = ""
    email: Optional[str] = ""
    phone: Optional[str] = ""
    address: Optional[str] = ""
    tax_number: Optional[str] = ""
    notes: Optional[str] = ""


class Job(Owned):
    title: str
    customer_id: Optional[str] = ""
    customer_name: Optional[str] = ""
    status: str = "tervezett"  # tervezett | folyamatban | elkeszult
    priority: str = "kozepes"
    value: float = 0
    deadline: Optional[str] = ""
    description: Optional[str] = ""
    quote_id: Optional[str] = ""


class JobIn(BaseModel):
    title: str
    customer_id: Optional[str] = ""
    customer_name: Optional[str] = ""
    status: str = "tervezett"
    priority: str = "kozepes"
    value: float = 0
    deadline: Optional[str] = ""
    description: Optional[str] = ""
    quote_id: Optional[str] = ""


class LineItem(BaseModel):
    description: str = ""
    quantity: float = 1
    unit: str = "db"
    unit_price: float = 0


class Quote(Owned):
    number: str = ""
    customer_id: Optional[str] = ""
    customer_name: Optional[str] = ""
    title: str = ""
    status: str = "letrehozva"  # letrehozva | elfogadva | elutasitva
    valid_until: Optional[str] = ""
    vat_rate: float = 27
    notes: Optional[str] = ""
    description: Optional[str] = ""
    material_cost: float = 0
    labor_cost: float = 0
    attachment_path: Optional[str] = ""
    attachment_name: Optional[str] = ""
    items: List[LineItem] = []
    job_id: Optional[str] = ""


class QuoteIn(BaseModel):
    number: Optional[str] = ""
    customer_id: Optional[str] = ""
    customer_name: Optional[str] = ""
    title: str = ""
    status: str = "letrehozva"
    valid_until: Optional[str] = ""
    vat_rate: float = 27
    notes: Optional[str] = ""
    description: Optional[str] = ""
    material_cost: float = 0
    labor_cost: float = 0
    attachment_path: Optional[str] = ""
    attachment_name: Optional[str] = ""
    items: List[LineItem] = []
    job_id: Optional[str] = ""


class Invoice(Owned):
    number: str = ""
    customer_id: Optional[str] = ""
    customer_name: Optional[str] = ""
    job_id: Optional[str] = ""
    title: str = ""
    status: str = "vazlat"  # vazlat | kiallitva | fizetve
    issue_date: str = ""
    due_date: str = ""
    payment_method: str = "atutalas"
    vat_rate: float = 27
    notes: Optional[str] = ""
    items: List[LineItem] = []


class InvoiceIn(BaseModel):
    number: Optional[str] = ""
    customer_id: Optional[str] = ""
    customer_name: Optional[str] = ""
    job_id: Optional[str] = ""
    title: str = ""
    status: str = "vazlat"
    issue_date: str = ""
    due_date: str = ""
    payment_method: str = "atutalas"
    vat_rate: float = 27
    notes: Optional[str] = ""
    items: List[LineItem] = []


class WorkLog(Owned):
    date: str = ""
    job_id: Optional[str] = ""
    job_title: Optional[str] = ""
    worker: Optional[str] = ""
    hours: float = 0
    description: Optional[str] = ""


class WorkLogIn(BaseModel):
    date: str = ""
    job_id: Optional[str] = ""
    job_title: Optional[str] = ""
    worker: Optional[str] = ""
    hours: float = 0
    description: Optional[str] = ""


class Document(Owned):
    name: str
    category: str = "egyeb"
    customer_id: Optional[str] = ""
    customer_name: Optional[str] = ""
    job_id: Optional[str] = ""
    size_kb: float = 0
    url: Optional[str] = ""
    storage_path: Optional[str] = ""
    content_type: Optional[str] = ""


class DocumentIn(BaseModel):
    name: str
    category: str = "egyeb"
    customer_id: Optional[str] = ""
    customer_name: Optional[str] = ""
    job_id: Optional[str] = ""
    size_kb: float = 0
    url: Optional[str] = ""
    storage_path: Optional[str] = ""
    content_type: Optional[str] = ""


class Payment(Owned):
    kind: str = "bevetel"  # bevetel | kiadas
    title: str = ""
    category: str = "egyeb"
    amount: float = 0
    date: str = ""
    customer_id: Optional[str] = ""
    customer_name: Optional[str] = ""
    job_id: Optional[str] = ""
    invoice_id: Optional[str] = ""
    notes: Optional[str] = ""


class PaymentIn(BaseModel):
    kind: str = "bevetel"
    title: str = ""
    category: str = "egyeb"
    amount: float = 0
    date: str = ""
    customer_id: Optional[str] = ""
    customer_name: Optional[str] = ""
    job_id: Optional[str] = ""
    invoice_id: Optional[str] = ""
    notes: Optional[str] = ""


class Company(BaseModel):
    model_config = ConfigDict(extra="ignore")
    name: str = ""
    contact_name: str = ""
    tax_number: str = ""
    reg_number: str = ""
    address: str = ""
    email: str = ""
    phone: str = ""
    website: str = ""
    bank_account: str = ""
    logo_url: str = ""
    logo_path: str = ""
    quote_footer: str = ""
    onboarded: bool = False


class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    company_name: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    password: str


class SendDocIn(BaseModel):
    to: Optional[EmailStr] = None
    message: Optional[str] = ""


class ContactIn(BaseModel):
    name: str
    email: EmailStr
    subject: str
    message: str

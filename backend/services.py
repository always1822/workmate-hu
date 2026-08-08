"""Object storage (Emergent managed) + Resend email helpers."""
import os
import asyncio
import logging
import uuid
import requests
import httpx

logger = logging.getLogger(__name__)

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "workmate-hu"

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "WorkMate HU")

MIME_TYPES = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif",
              "webp": "image/webp", "svg": "image/svg+xml", "pdf": "application/pdf",
              "csv": "text/csv", "txt": "text/plain", "doc": "application/msword",
              "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}

_storage_key = None


def init_storage(force: bool = False):
    global _storage_key
    if _storage_key and not force:
        return _storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    _storage_key = resp.json()["storage_key"]
    return _storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type},
                        data=data, timeout=120)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type},
                            data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


def storage_path(user_id: str, filename: str) -> tuple:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    return f"{APP_NAME}/uploads/{user_id}/{uuid.uuid4()}.{ext}", MIME_TYPES.get(ext, "application/octet-stream")


async def send_email(to: str, subject: str, html: str, reply_to: str = None) -> str:
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if reply_to:
        payload["contact_email"] = reply_to
    last = None
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                                         headers={"X-Email-Key": EMAIL_KEY}, json=payload)
            resp.raise_for_status()
            return resp.json().get("id", "")
        except Exception as e:  # transient upstream errors (502/503/timeout)
            last = e
            logger.warning(f"Email send attempt {attempt + 1} failed: {e}")
            if attempt < 1:
                await asyncio.sleep(1)
    raise last


def huf(v):
    return f"{float(v or 0):,.0f}".replace(",", " ") + " Ft"


def doc_email_html(doc, comp, kind: str) -> str:
    title = "Árajánlat" if kind == "quote" else "Számla"
    rows = ""
    net = 0
    for it in doc.get("items", []):
        tot = float(it.get("quantity", 0)) * float(it.get("unit_price", 0))
        net += tot
        rows += (f'<tr><td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#1f2937">{it.get("description","")}</td>'
                 f'<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#6b7280">{float(it.get("quantity",0)):g} {it.get("unit","")}</td>'
                 f'<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#6b7280">{huf(it.get("unit_price"))}</td>'
                 f'<td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:#1f2937;font-weight:600">{huf(tot)}</td></tr>')
    rate = float(doc.get("vat_rate") or 0)
    vat = net * rate / 100
    meta = (f'Érvényes: {doc.get("valid_until") or "-"}' if kind == "quote"
            else f'Kelt: {doc.get("issue_date") or "-"} · Fizetési határidő: {doc.get("due_date") or "-"}')
    return f"""<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:32px 0;font-family:Arial,Helvetica,sans-serif">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
<tr><td style="background:#06b6d4;padding:24px 28px;color:#ffffff">
  <div style="font-size:19px;font-weight:bold">{comp.get('name') or 'WorkMate HU'}</div>
  <div style="font-size:12px;opacity:.85;letter-spacing:1px">{title.upper()}</div>
</td></tr>
<tr><td style="padding:28px">
  <p style="margin:0 0 6px;color:#1f2937;font-size:16px;font-weight:bold">{doc.get('title') or title}</p>
  <p style="margin:0 0 4px;color:#6b7280;font-size:13px">{title} száma: {doc.get('number') or '-'}</p>
  <p style="margin:0 0 20px;color:#6b7280;font-size:13px">{meta}</p>
  <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;border-collapse:collapse">
    <tr style="background:#f5f7fb">
      <th align="left" style="padding:10px 12px;color:#6b7280;font-size:11px;letter-spacing:1px">MEGNEVEZÉS</th>
      <th align="right" style="padding:10px 12px;color:#6b7280;font-size:11px;letter-spacing:1px">MENNY.</th>
      <th align="right" style="padding:10px 12px;color:#6b7280;font-size:11px;letter-spacing:1px">EGYSÉGÁR</th>
      <th align="right" style="padding:10px 12px;color:#6b7280;font-size:11px;letter-spacing:1px">ÖSSZESEN</th>
    </tr>
    {rows}
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;font-size:13px">
    <tr><td align="right" style="color:#6b7280;padding:4px 12px">Nettó összesen:</td><td align="right" style="color:#1f2937;padding:4px 0;width:130px">{huf(net)}</td></tr>
    <tr><td align="right" style="color:#6b7280;padding:4px 12px">ÁFA ({rate:g}%):</td><td align="right" style="color:#1f2937;padding:4px 0">{huf(vat)}</td></tr>
    <tr><td align="right" style="color:#06b6d4;font-weight:bold;font-size:15px;padding:10px 12px">Bruttó összesen:</td><td align="right" style="color:#06b6d4;font-weight:bold;font-size:15px;padding:10px 0">{huf(net + vat)}</td></tr>
  </table>
  {f'<p style="margin:20px 0 0;color:#6b7280;font-size:13px">{doc.get("notes")}</p>' if doc.get('notes') else ''}
</td></tr>
<tr><td style="padding:20px 28px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px">
  {comp.get('name') or ''} · {comp.get('address') or ''}<br/>
  {comp.get('email') or ''} · {comp.get('phone') or ''}
  {f"<br/>Adószám: {comp.get('tax_number')}" if comp.get('tax_number') else ''}
  {f"<br/>Bankszámla: {comp.get('bank_account')}" if comp.get('bank_account') else ''}
  <div style="margin-top:12px;font-style:italic">{comp.get('quote_footer') or 'Készült a WorkMate HU rendszerrel'}</div>
</td></tr>
</table>
</td></tr></table>"""


def reset_email_html(name: str, link: str) -> str:
    return f"""<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:32px 0;font-family:Arial,Helvetica,sans-serif">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">
<tr><td style="background:#06b6d4;padding:22px 28px;color:#ffffff;font-size:18px;font-weight:bold">WorkMate HU</td></tr>
<tr><td style="padding:28px;color:#1f2937;font-size:14px;line-height:1.6">
  <p style="margin:0 0 12px">Kedves {name or 'Vállalkozó'}!</p>
  <p style="margin:0 0 20px;color:#6b7280">Jelszó-visszaállítást kértél a WorkMate HU fiókodhoz. Az alábbi gombbal állíthatsz be új jelszót. A link 1 óráig érvényes.</p>
  <a href="{link}" style="display:inline-block;background:#06b6d4;color:#ffffff;text-decoration:none;padding:13px 26px;border-radius:12px;font-weight:bold">Új jelszó beállítása</a>
  <p style="margin:22px 0 0;color:#6b7280;font-size:12px">Ha nem te kérted, hagyd figyelmen kívül ezt a levelet.</p>
</td></tr>
</table>
</td></tr></table>"""

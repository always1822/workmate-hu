"""Iteration 6 – Simplified statuses, dashboard, quote fields, notifications, pricing, migration."""
import io
import os
from pathlib import Path
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests

def _backend_url():
    url = os.getenv("REACT_APP_BACKEND_URL")
    if not url:
        env = Path(__file__).resolve().parents[2] / "frontend" / ".env"
        for line in env.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                url = line.split("=", 1)[1].strip().strip('"')
    return url.rstrip("/")


BASE_URL = _backend_url()

JOB_STATUSES = {"tervezett", "folyamatban", "elkeszult"}
QUOTE_STATUSES = {"letrehozva", "elfogadva", "elutasitva"}


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def demo_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "demo@workmate.hu", "password": "workmate123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def new_user():
    email = f"iter6_{uuid.uuid4().hex[:8]}@workmate.hu"
    r = requests.post(f"{BASE_URL}/api/auth/register", json={
        "name": "Iter6 Tester", "company_name": "Iter6 Kft.",
        "email": email, "password": "iter6pass"})
    assert r.status_code == 200, r.text
    return {"headers": {"Authorization": f"Bearer {r.json()['token']}"},
            "email": email, "token": r.json()["token"], "user_id": r.json()["user"]["id"]}


@pytest.fixture(scope="module")
def new_headers(new_user):
    # Trigger seed so we have real notifications setup baseline
    requests.post(f"{BASE_URL}/api/seed", headers=new_user["headers"])
    return new_user["headers"]


# ---------- Migration / status enum sanity ----------
def test_demo_jobs_only_new_statuses(demo_headers):
    r = requests.get(f"{BASE_URL}/api/jobs", headers=demo_headers)
    assert r.status_code == 200
    jobs = r.json()
    assert jobs, "expected at least one demo job"
    bad = [j["status"] for j in jobs if j["status"] not in JOB_STATUSES]
    assert not bad, f"legacy statuses leaked into demo jobs: {bad}"


def test_demo_quotes_only_new_statuses(demo_headers):
    r = requests.get(f"{BASE_URL}/api/quotes", headers=demo_headers)
    assert r.status_code == 200
    qs = r.json()
    assert qs, "expected at least one demo quote"
    bad = [q["status"] for q in qs if q["status"] not in QUOTE_STATUSES]
    assert not bad, f"legacy statuses leaked into demo quotes: {bad}"


# ---------- Dashboard shape ----------
def test_dashboard_has_deadline_relevant_fields(demo_headers):
    r = requests.get(f"{BASE_URL}/api/dashboard", headers=demo_headers)
    assert r.status_code == 200
    d = r.json()
    for k in ("customers", "active_jobs", "monthly_revenue", "jobs_by_status"):
        assert k in d, f"missing key {k}"
    # jobs_by_status has exactly 3 buckets, all new statuses
    assert set(d["jobs_by_status"].keys()) == JOB_STATUSES


def test_calendar_endpoint_ok(demo_headers):
    r = requests.get(f"{BASE_URL}/api/calendar", headers=demo_headers)
    assert r.status_code == 200
    assert "events" in r.json()


# ---------- Quote new fields (no items) ----------
def test_create_quote_without_items_material_labor_only(new_headers):
    # Create customer
    c = requests.post(f"{BASE_URL}/api/customers", headers=new_headers,
                      json={"name": "TEST_MatLabor Ügyfél"})
    assert c.status_code == 200
    cust = c.json()

    q = requests.post(f"{BASE_URL}/api/quotes", headers=new_headers, json={
        "number": "TEST-Q-MATLAB-01", "customer_id": cust["id"],
        "customer_name": cust["name"], "title": "Csak anyag+munkadíj",
        "status": "letrehozva", "vat_rate": 27,
        "material_cost": 100000, "labor_cost": 50000,
        "description": "Csempézés az előszobában",
        "items": [],
    })
    assert q.status_code == 200, q.text
    quote = q.json()
    assert quote["material_cost"] == 100000
    assert quote["labor_cost"] == 50000
    assert quote["items"] == []
    assert quote["status"] == "letrehozva"

    # PDF should include Anyagköltség and Munkadíj
    pdf = requests.get(f"{BASE_URL}/api/quotes/{quote['id']}/pdf", headers=new_headers)
    assert pdf.status_code == 200
    assert pdf.headers["content-type"].startswith("application/pdf")
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(pdf.content))
    text = "\n".join((p.extract_text() or "") for p in reader.pages)
    assert "Anyagk" in text or "Anyagköltség" in text, f"Anyagköltség row missing. Text: {text[:500]}"
    assert "Munkad" in text, f"Munkadíj row missing. Text: {text[:500]}"
    # Net = 150000 → gross with 27% VAT = 190500 -> "190 500 Ft"
    assert "190 500" in text, f"Bruttó összesen 190 500 Ft missing. Text: {text[:800]}"

    return quote["id"]


def test_quote_status_enum_supported(new_headers):
    # Create and update through all 3 statuses
    q = requests.post(f"{BASE_URL}/api/quotes", headers=new_headers, json={
        "title": "Status enum test", "status": "letrehozva",
        "material_cost": 1000, "labor_cost": 500, "vat_rate": 27, "items": []
    }).json()
    qid = q["id"]
    for s in ("elfogadva", "elutasitva", "letrehozva"):
        r = requests.put(f"{BASE_URL}/api/quotes/{qid}", headers=new_headers,
                         json={**q, "status": s})
        assert r.status_code == 200
        assert r.json()["status"] == s


def test_job_status_enum_supported(new_headers):
    j = requests.post(f"{BASE_URL}/api/jobs", headers=new_headers,
                     json={"title": "Status test job", "status": "tervezett", "value": 0}).json()
    jid = j["id"]
    for s in ("folyamatban", "elkeszult", "tervezett"):
        r = requests.put(f"{BASE_URL}/api/jobs/{jid}", headers=new_headers,
                         json={**j, "status": s})
        assert r.status_code == 200
        assert r.json()["status"] == s


# ---------- Notifications ----------
def _cleanup_jobs_quotes(headers):
    for coll in ("jobs", "quotes", "invoices"):
        rows = requests.get(f"{BASE_URL}/api/{coll}", headers=headers).json()
        for r in rows:
            requests.delete(f"{BASE_URL}/api/{coll}/{r['id']}", headers=headers)


def test_notifications_are_event_driven():
    # Create a totally fresh user with no seed data auto? Actually /api/seed
    # runs on register-triggered auto-call from FE; but backend register itself
    # does not call seed. So a raw register user should have 0 items.
    email = f"notif_{uuid.uuid4().hex[:8]}@workmate.hu"
    r = requests.post(f"{BASE_URL}/api/auth/register", json={
        "name": "Notif Tester", "company_name": "N Kft.",
        "email": email, "password": "notifpass"})
    assert r.status_code == 200
    h = {"Authorization": f"Bearer {r.json()['token']}"}

    # Initially: no data -> no notifications
    resp = requests.get(f"{BASE_URL}/api/notifications", headers=h).json()
    assert resp["count"] == 0, f"Fresh user should have zero notifications, got {resp}"
    assert resp["items"] == []

    # (a) Overdue job in folyamatban -> 'Lejárt határidő'
    yesterday = (datetime.now(timezone.utc).date() - timedelta(days=1)).isoformat()
    j1 = requests.post(f"{BASE_URL}/api/jobs", headers=h, json={
        "title": "Késésben munka", "status": "folyamatban",
        "deadline": yesterday, "value": 10000}).json()

    # (b) elkeszult job with no invoice -> 'Számlázható munka'
    j2 = requests.post(f"{BASE_URL}/api/jobs", headers=h, json={
        "title": "Kész munka", "status": "elkeszult", "value": 50000}).json()

    # (c) elfogadva quote without job_id -> 'Elfogadott ajánlat'
    q1 = requests.post(f"{BASE_URL}/api/quotes", headers=h, json={
        "title": "Elfogadott aj.", "number": "AJ-N-1", "status": "elfogadva",
        "material_cost": 10000, "labor_cost": 5000, "vat_rate": 27, "items": []}).json()

    resp = requests.get(f"{BASE_URL}/api/notifications", headers=h).json()
    ids = [i["id"] for i in resp["items"]]
    kinds = {i["kind"] for i in resp["items"]}
    titles = {i["title"] for i in resp["items"]}

    assert any(f"job-late-{j1['id']}" == x or x.startswith(f"job-late-{j1['id']}") for x in ids), \
        f"Missing overdue-job notification. ids={ids}"
    assert any(x == f"job-invoice-{j2['id']}" for x in ids), \
        f"Missing job-invoice notification. ids={ids}"
    assert any(x == f"quote-{q1['id']}" for x in ids), \
        f"Missing accepted-quote notification. ids={ids}"
    assert "Lejárt határidő" in titles
    assert "Számlázható munka" in titles
    assert "Elfogadott ajánlat" in titles
    assert resp["count"] >= 3

    # Cleanup so subsequent isolation checks aren't polluted
    _cleanup_jobs_quotes(h)
    resp2 = requests.get(f"{BASE_URL}/api/notifications", headers=h).json()
    assert resp2["count"] == 0


# ---------- Pricing (public route) ----------
def test_pricing_page_public():
    # The pricing page is a React route; verify FE serves it without auth.
    # We just check the root html loads – Playwright test does the rest.
    r = requests.get(f"{BASE_URL}/arak", timeout=15)
    assert r.status_code == 200
    # Should be HTML (React SPA)
    assert "text/html" in r.headers.get("content-type", "")


# ---------- Attachment (file upload + quote link) ----------
def test_quote_attachment_upload_and_download(new_headers):
    # Upload a fake PNG via /api/uploads (matches the FE Quotes flow)
    png_bytes = (b"\x89PNG\r\n\x1a\n" + b"\x00" * 128)
    files = {"file": ("test_attachment.png", png_bytes, "image/png")}
    data = {"category": "terv"}
    r = requests.post(f"{BASE_URL}/api/uploads", headers=new_headers,
                      files=files, data=data)
    if r.status_code == 502:
        pytest.skip("Object storage upstream unavailable")
    assert r.status_code == 200, r.text
    doc = r.json()
    assert doc["storage_path"]

    # Save quote with attachment
    q = requests.post(f"{BASE_URL}/api/quotes", headers=new_headers, json={
        "title": "Attachment test", "status": "letrehozva",
        "material_cost": 1000, "labor_cost": 0, "vat_rate": 27, "items": [],
        "attachment_path": doc["storage_path"], "attachment_name": doc["name"]}).json()
    assert q["attachment_path"] == doc["storage_path"]
    assert q["attachment_name"] == "test_attachment.png"

    # Download via /api/files/{path}?auth=<token>
    token = new_headers["Authorization"].split(" ", 1)[1]
    dl = requests.get(f"{BASE_URL}/api/files/{doc['storage_path']}?auth={token}")
    assert dl.status_code == 200, dl.text
    assert dl.content.startswith(b"\x89PNG"), "downloaded bytes should match uploaded PNG"


# ---------- 401 without auth ----------
def test_notifications_requires_auth():
    r = requests.get(f"{BASE_URL}/api/notifications")
    assert r.status_code == 401

"""Iteration 5 – End-to-end business flow + root endpoint + data isolation regression."""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://workmate-premium.preview.emergentagent.com").rstrip("/")


# ---------- Health ----------
def test_root_endpoint():
    r = requests.get(f"{BASE_URL}/api/")
    assert r.status_code == 200
    data = r.json()
    assert data.get("message") == "WorkMate HU API"
    assert data.get("status") == "ok"


# ---------- Fixtures ----------
@pytest.fixture(scope="module")
def new_user():
    email = f"testflow_{uuid.uuid4().hex[:8]}@workmate.hu"
    payload = {"name": "Test Flow User", "company_name": "TestFlow Kft.",
               "email": email, "password": "testpass123"}
    r = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": email, "token": data["token"], "user_id": data["user"]["id"]}


@pytest.fixture(scope="module")
def new_headers(new_user):
    return {"Authorization": f"Bearer {new_user['token']}"}


@pytest.fixture(scope="module")
def demo_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": "demo@workmate.hu", "password": "workmate123"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


# ---------- Demo seed sanity ----------
def test_demo_dashboard_shape(demo_headers):
    d = requests.get(f"{BASE_URL}/api/dashboard", headers=demo_headers).json()
    assert d["customers"] == 3
    assert d["active_jobs"] >= 2
    assert d["invoices"] >= 2
    assert d["monthly_revenue"] > 0
    assert d["hours_logged"] >= 18


def test_demo_customer_names(demo_headers):
    cs = requests.get(f"{BASE_URL}/api/customers", headers=demo_headers).json()
    names = {c["name"] for c in cs}
    assert {"Kovács Építő Kft.", "Szabó Ingatlan Zrt.", "Nagy Autószerviz"} <= names


# ---------- E2E business flow ----------
def test_full_business_flow(new_headers):
    # 1. Create customer
    r = requests.post(f"{BASE_URL}/api/customers", headers=new_headers,
                      json={"name": "TEST_E2E Ügyfél Kft.", "contact": "T Ügyfél",
                            "email": "e2e@test.hu", "phone": "+36 1 111 1111",
                            "address": "Budapest"})
    assert r.status_code == 200, r.text
    cust = r.json()
    cust_id = cust["id"]

    # 2. Create quote with line items
    q = requests.post(f"{BASE_URL}/api/quotes", headers=new_headers, json={
        "number": "TEST-Q-E2E-01",
        "customer_id": cust_id,
        "customer_name": cust["name"],
        "title": "E2E ajánlat",
        "status": "elkuldve",
        "valid_until": "2026-12-31",
        "items": [
            {"description": "Munka", "quantity": 2, "unit": "óra", "unit_price": 50000},
            {"description": "Anyag", "quantity": 1, "unit": "alk", "unit_price": 30000},
        ],
    })
    assert q.status_code == 200, q.text
    quote = q.json()
    quote_id = quote["id"]

    # 3. Download quote PDF
    pdf = requests.get(f"{BASE_URL}/api/quotes/{quote_id}/pdf", headers=new_headers)
    assert pdf.status_code == 200
    assert pdf.headers.get("content-type", "").startswith("application/pdf")
    assert pdf.content[:4] == b"%PDF"

    # 4. Quote → Job
    r = requests.post(f"{BASE_URL}/api/quotes/{quote_id}/job", headers=new_headers)
    assert r.status_code == 200, r.text
    job = r.json()
    job_id = job["id"]
    assert job["customer_id"] == cust_id

    # 5. Set job status to kesz
    r = requests.put(f"{BASE_URL}/api/jobs/{job_id}", headers=new_headers,
                     json={**{k: job[k] for k in ("title", "customer_id", "customer_name",
                                                   "priority", "value", "deadline",
                                                   "description")}, "status": "kesz"})
    assert r.status_code == 200
    assert r.json()["status"] == "kesz"

    # 6. Job → Invoice
    r = requests.post(f"{BASE_URL}/api/jobs/{job_id}/invoice", headers=new_headers)
    assert r.status_code == 200, r.text
    inv = r.json()
    inv_id = inv["id"]
    assert inv["job_id"] == job_id

    # 7. Invoice PDF
    pdf = requests.get(f"{BASE_URL}/api/invoices/{inv_id}/pdf", headers=new_headers)
    assert pdf.status_code == 200
    assert pdf.headers.get("content-type", "").startswith("application/pdf")

    # 8. Mark invoice as paid so dashboard revenue picks it up
    upd = {k: inv[k] for k in ("number", "customer_id", "customer_name", "job_id",
                                "title", "issue_date", "due_date", "payment_method",
                                "vat_rate", "notes", "items")}
    upd["status"] = "fizetve"
    r = requests.put(f"{BASE_URL}/api/invoices/{inv_id}", headers=new_headers, json=upd)
    assert r.status_code == 200

    # 9. Dashboard & reports reflect the new invoice
    d = requests.get(f"{BASE_URL}/api/dashboard", headers=new_headers).json()
    assert d["customers"] >= 1
    assert d["invoices"] >= 1
    assert d["monthly_revenue"] > 0

    rep = requests.get(f"{BASE_URL}/api/reports", headers=new_headers)
    assert rep.status_code == 200


# ---------- Data isolation ----------
def test_isolation_from_demo(new_headers, demo_headers):
    demo_cs = requests.get(f"{BASE_URL}/api/customers", headers=demo_headers).json()
    demo_ids = {c["id"] for c in demo_cs}

    new_cs = requests.get(f"{BASE_URL}/api/customers", headers=new_headers).json()
    new_ids = {c["id"] for c in new_cs}
    assert demo_ids.isdisjoint(new_ids)

    # New user cannot GET a demo customer
    any_demo_id = next(iter(demo_ids))
    r = requests.get(f"{BASE_URL}/api/customers/{any_demo_id}", headers=new_headers)
    assert r.status_code == 404

    # Cannot delete
    r = requests.delete(f"{BASE_URL}/api/customers/{any_demo_id}", headers=new_headers)
    assert r.status_code == 404


def test_no_auth_returns_401():
    for ep in ("customers", "jobs", "quotes", "invoices", "payments",
               "documents", "worklogs", "dashboard"):
        r = requests.get(f"{BASE_URL}/api/{ep}")
        assert r.status_code == 401, f"{ep}: {r.status_code}"


# ---------- Register→Login round-trip ----------
def test_register_then_login_roundtrip():
    email = f"rt_{uuid.uuid4().hex[:8]}@workmate.hu"
    pw = "roundtrip123"
    r = requests.post(f"{BASE_URL}/api/auth/register", json={
        "name": "RT", "company_name": "RT Kft.", "email": email, "password": pw})
    assert r.status_code == 200
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200
    assert "token" in r.json()

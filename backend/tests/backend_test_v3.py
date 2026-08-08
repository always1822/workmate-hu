"""WorkMate HU – iteration 3 backend tests: forgot/reset password, uploads,
file isolation, logo, email send (Resend), payments CRUD, reports profit,
extended job/quote statuses, migration."""
import io
import os
import uuid
import pytest
import requests

BASE_URL = "https://workmate-premium.preview.emergentagent.com"
try:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
except Exception:
    pass
API = f"{BASE_URL}/api"

DEMO_EMAIL = os.getenv("TEST_DEMO_EMAIL", "demo@workmate.hu")
DEMO_PASSWORD = os.getenv("TEST_DEMO_PASSWORD", "workmate123")
RESEND_TO = "delivered@resend.dev"


def _client(token=None):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    if token:
        s.headers["Authorization"] = f"Bearer {token}"
    return s


def _register(pwd="tesztjelszo123"):
    email = f"test_{uuid.uuid4().hex[:10]}@example.com"
    r = requests.post(f"{API}/auth/register",
                      json={"name": "T", "email": email, "password": pwd, "company_name": "TEST"})
    assert r.status_code == 200, r.text
    b = r.json()
    return b["token"], b["user"], email, pwd


@pytest.fixture(scope="session")
def demo_token():
    r = requests.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200
    return r.json()["token"]


@pytest.fixture(scope="session")
def demo_client(demo_token):
    return _client(demo_token)


# ---------- Forgot / reset password ----------
class TestPasswordReset:
    def test_forgot_password_existing_email_ok(self):
        r = requests.post(f"{API}/auth/forgot-password", json={"email": DEMO_EMAIL})
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_forgot_password_unknown_email_still_ok(self):
        r = requests.post(f"{API}/auth/forgot-password",
                          json={"email": f"nonexistent_{uuid.uuid4().hex[:6]}@nope.hu"})
        # generic response so we don't leak account existence
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_reset_password_flow_end_to_end(self):
        # Create fresh user
        _, _, email, pwd = _register()
        # Trigger forgot => token inserted
        requests.post(f"{API}/auth/forgot-password", json={"email": email})
        # Fetch token directly from DB via a fresh mongo client
        from motor.motor_asyncio import AsyncIOMotorClient
        import asyncio
        mongo_url = os.environ.get("MONGO_URL") or open("/app/backend/.env").read().split("MONGO_URL=")[1].splitlines()[0].strip().strip('"')
        db_name = os.environ.get("DB_NAME") or open("/app/backend/.env").read().split("DB_NAME=")[1].splitlines()[0].strip().strip('"')

        async def fetch():
            c = AsyncIOMotorClient(mongo_url)
            u = await c[db_name].users.find_one({"email": email})
            t = await c[db_name].password_reset_tokens.find_one({"user_id": u["id"], "used": False})
            c.close()
            return t["token"]

        token = asyncio.run(fetch())
        new_pwd = "ujjelszo456"

        # too short => 400
        r_short = requests.post(f"{API}/auth/reset-password", json={"token": token, "password": "abc"})
        assert r_short.status_code == 400

        # invalid token => 400
        r_bad = requests.post(f"{API}/auth/reset-password", json={"token": "not-a-real-token", "password": new_pwd})
        assert r_bad.status_code == 400

        # success
        r_ok = requests.post(f"{API}/auth/reset-password", json={"token": token, "password": new_pwd})
        assert r_ok.status_code == 200

        # old password now fails
        r_old = requests.post(f"{API}/auth/login", json={"email": email, "password": pwd})
        assert r_old.status_code == 401

        # new one works
        r_new = requests.post(f"{API}/auth/login", json={"email": email, "password": new_pwd})
        assert r_new.status_code == 200

        # token reuse => 400
        r_reuse = requests.post(f"{API}/auth/reset-password", json={"token": token, "password": "anotherpwd"})
        assert r_reuse.status_code == 400


# ---------- File upload / logo / isolation ----------
PNG_1x1 = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
           b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xff"
           b"\xff?\x03\x00\x08\xfc\x02\xfe\xa7\xe7:v\x00\x00\x00\x00IEND\xaeB`\x82")


class TestUploads:
    def test_upload_document_and_download(self):
        tok, _, _, _ = _register()
        headers = {"Authorization": f"Bearer {tok}"}
        r = requests.post(f"{API}/uploads",
                          headers=headers,
                          files={"file": ("teszt.png", PNG_1x1, "image/png")},
                          data={"category": "szerzodes"})
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["storage_path"]
        assert doc["category"] == "szerzodes"
        # Fetch through /files/{path}?auth=
        r2 = requests.get(f"{API}/files/{doc['storage_path']}?auth={tok}")
        assert r2.status_code == 200
        assert r2.content == PNG_1x1

    def test_download_isolated_from_other_user(self):
        tokA, _, _, _ = _register()
        tokB, _, _, _ = _register()
        r = requests.post(f"{API}/uploads",
                          headers={"Authorization": f"Bearer {tokA}"},
                          files={"file": ("a.png", PNG_1x1, "image/png")},
                          data={"category": "egyeb"})
        path = r.json()["storage_path"]
        r_other = requests.get(f"{API}/files/{path}?auth={tokB}")
        assert r_other.status_code == 404

    def test_upload_too_large(self):
        tok, _, _, _ = _register()
        big = b"x" * (15 * 1024 * 1024 + 10)
        r = requests.post(f"{API}/uploads",
                          headers={"Authorization": f"Bearer {tok}"},
                          files={"file": ("big.bin", big, "application/octet-stream")},
                          data={"category": "egyeb"})
        assert r.status_code == 400

    def test_upload_logo_sets_company_logo_path(self):
        tok, _, _, _ = _register()
        r = requests.post(f"{API}/uploads/logo",
                          headers={"Authorization": f"Bearer {tok}"},
                          files={"file": ("logo.png", PNG_1x1, "image/png")})
        assert r.status_code == 200, r.text
        assert r.json().get("logo_path")
        # And company reflects it
        c = requests.get(f"{API}/company", headers={"Authorization": f"Bearer {tok}"}).json()
        assert c.get("logo_path")


# ---------- Email sending ----------
class TestEmailSend:
    def test_quote_send_sets_status_elkuldve(self, demo_client):
        q = demo_client.post(f"{API}/quotes", json={
            "number": "TEST-Q-EMAIL", "title": "TEST_e-mail ajánlat",
            "customer_name": "TEST Kft", "status": "piszkozat", "vat_rate": 27,
            "items": [{"description": "x", "quantity": 1, "unit": "db", "unit_price": 1000}]}).json()
        r = demo_client.post(f"{API}/quotes/{q['id']}/send", json={"to": RESEND_TO})
        assert r.status_code == 200, r.text
        assert demo_client.get(f"{API}/quotes/{q['id']}").json()["status"] == "letrehozva"
        # verify logo doesn't break PDF
        pdf = demo_client.get(f"{API}/quotes/{q['id']}/pdf")
        assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"
        demo_client.delete(f"{API}/quotes/{q['id']}")

    def test_invoice_send_sets_status_kiallitva(self, demo_client):
        inv = demo_client.post(f"{API}/invoices", json={
            "number": "TEST-INV-EMAIL", "title": "TEST_e-mail számla",
            "customer_name": "TEST Kft", "status": "vazlat",
            "issue_date": "2026-01-05", "due_date": "2026-01-15", "vat_rate": 27,
            "items": [{"description": "x", "quantity": 1, "unit": "db", "unit_price": 1000}]}).json()
        r = demo_client.post(f"{API}/invoices/{inv['id']}/send", json={"to": RESEND_TO})
        assert r.status_code == 200, r.text
        assert demo_client.get(f"{API}/invoices/{inv['id']}").json()["status"] == "kiallitva"
        demo_client.delete(f"{API}/invoices/{inv['id']}")

    def test_send_without_recipient_400(self, demo_client):
        q = demo_client.post(f"{API}/quotes", json={
            "number": "TEST-Q-NO-EMAIL", "title": "TEST_no email",
            "customer_name": "TEST", "status": "piszkozat", "vat_rate": 27,
            "items": [{"description": "x", "quantity": 1, "unit": "db", "unit_price": 100}]}).json()
        r = demo_client.post(f"{API}/quotes/{q['id']}/send", json={})
        assert r.status_code == 400
        demo_client.delete(f"{API}/quotes/{q['id']}")


# ---------- Payments CRUD ----------
class TestPayments:
    def test_payments_crud_and_isolation(self):
        tokA, _, _, _ = _register()
        tokB, _, _, _ = _register()
        A = _client(tokA)
        B = _client(tokB)
        r = A.post(f"{API}/payments", json={"kind": "kiadas", "title": "TEST_kiadas",
                                             "category": "anyag", "amount": 5000, "date": "2026-01-05"})
        assert r.status_code == 200
        pid = r.json()["id"]
        assert A.get(f"{API}/payments/{pid}").json()["amount"] == 5000
        # userB cannot see or update
        assert B.get(f"{API}/payments/{pid}").status_code == 404
        assert B.put(f"{API}/payments/{pid}", json={"kind": "kiadas", "title": "hack", "amount": 1}).status_code == 404
        assert B.delete(f"{API}/payments/{pid}").status_code == 404
        # update by owner
        A.put(f"{API}/payments/{pid}", json={"kind": "kiadas", "title": "TEST_frissitve",
                                              "category": "anyag", "amount": 7000, "date": "2026-01-06"})
        assert A.get(f"{API}/payments/{pid}").json()["title"] == "TEST_frissitve"
        assert A.delete(f"{API}/payments/{pid}").status_code == 200
        assert A.get(f"{API}/payments/{pid}").status_code == 404


# ---------- Reports profit ----------
class TestReportsProfit:
    def test_reports_has_profit_fields(self, demo_client):
        r = demo_client.get(f"{API}/reports")
        assert r.status_code == 200
        d = r.json()
        for k in ("yearly_revenue", "yearly_expense", "yearly_profit", "months"):
            assert k in d
        assert len(d["months"]) == 12
        for m in d["months"]:
            for k in ("revenue", "expense", "profit"):
                assert k in m


# ---------- Extended status workflow ----------
class TestStatusFlow:
    def test_quote_to_job_uses_elfogadva_and_tervezett(self, demo_client):
        q = demo_client.post(f"{API}/quotes", json={
            "number": "TEST-Q-FLOW3", "title": "TEST_flow3", "customer_name": "TEST",
            "status": "letrehozva", "vat_rate": 27,
            "items": [{"description": "x", "quantity": 1, "unit": "db", "unit_price": 1000}]}).json()
        job = demo_client.post(f"{API}/quotes/{q['id']}/job").json()
        assert job["status"] == "tervezett"
        assert demo_client.get(f"{API}/quotes/{q['id']}").json()["status"] == "elfogadva"

        # Move job to elkeszult then invoice => job stays elkeszult
        upd = {k: job.get(k) for k in ("title", "customer_id", "customer_name", "priority",
                                        "value", "deadline", "description", "quote_id")}
        upd["status"] = "elkeszult"
        demo_client.put(f"{API}/jobs/{job['id']}", json=upd)
        inv = demo_client.post(f"{API}/jobs/{job['id']}/invoice").json()
        assert demo_client.get(f"{API}/jobs/{job['id']}").json()["status"] == "elkeszult"

        demo_client.delete(f"{API}/invoices/{inv['id']}")
        demo_client.delete(f"{API}/jobs/{job['id']}")
        demo_client.delete(f"{API}/quotes/{q['id']}")


# ---------- Seed race safety ----------
class TestSeedIdempotent:
    def test_double_seed_leaves_three_customers(self):
        tok, _, _, _ = _register()
        headers = {"Authorization": f"Bearer {tok}"}
        r1 = requests.post(f"{API}/seed", headers=headers)
        r2 = requests.post(f"{API}/seed", headers=headers)
        assert r1.status_code == 200 and r2.status_code == 200
        # second one should not seed
        assert r2.json().get("seeded") is False
        c = requests.get(f"{API}/customers", headers=headers).json()
        assert len(c) == 3, f"Expected 3 customers, got {len(c)}"


# ---------- Auth guard on new endpoints ----------
class TestAuthGuardNew:
    @pytest.mark.parametrize("path", ["/payments", "/uploads"])
    def test_requires_auth(self, path):
        r = requests.get(f"{API}{path}") if path == "/payments" else requests.post(f"{API}{path}")
        assert r.status_code == 401

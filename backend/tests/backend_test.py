"""WorkMate HU backend integration tests with JWT auth + user isolation."""
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


def _client(token=None):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    if token:
        s.headers["Authorization"] = f"Bearer {token}"
    return s


def _register(name="Teszt Felhasználó", company="TEST Kft.", password=os.getenv("TEST_USER_PASSWORD", "tesztjelszo123")):
    email = f"test_{uuid.uuid4().hex[:10]}@example.com"
    r = requests.post(f"{API}/auth/register",
                      json={"name": name, "email": email, "password": password, "company_name": company})
    assert r.status_code == 200, r.text
    body = r.json()
    return body["token"], body["user"], email, password


@pytest.fixture(scope="session")
def demo_token():
    r = requests.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    assert r.status_code == 200, f"Demo login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def demo_client(demo_token):
    return _client(demo_token)


# ---------- Auth ----------
class TestAuth:
    def test_register_new_user(self):
        token, user, email, _ = _register()
        assert isinstance(token, str) and len(token) > 20
        assert user["email"] == email
        assert "id" in user

    def test_register_duplicate_email_400(self):
        _, _, email, pwd = _register()
        r = requests.post(f"{API}/auth/register",
                          json={"name": "X", "email": email, "password": pwd, "company_name": "Y"})
        assert r.status_code == 400

    def test_login_demo_success(self):
        r = requests.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
        assert r.status_code == 200
        assert "token" in r.json()

    def test_login_wrong_password_401(self):
        r = requests.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": "wrongpass"})
        assert r.status_code == 401

    def test_me_requires_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, demo_client):
        r = demo_client.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == DEMO_EMAIL


class TestAuthGuard:
    @pytest.mark.parametrize("path", [
        "/customers", "/jobs", "/quotes", "/invoices", "/worklogs",
        "/documents", "/dashboard", "/reports", "/company"
    ])
    def test_endpoint_requires_auth(self, path):
        r = requests.get(f"{API}{path}")
        assert r.status_code == 401, f"{path} should be 401 without token, got {r.status_code}"


class TestIsolation:
    def test_two_users_see_only_their_data(self):
        tokA, _, _, _ = _register(company="TEST_A Kft.")
        tokB, _, _, _ = _register(company="TEST_B Kft.")
        A = _client(tokA)
        B = _client(tokB)

        rA = A.post(f"{API}/customers", json={"name": "TEST_A_customer"})
        assert rA.status_code == 200
        aid = rA.json()["id"]

        rB = B.post(f"{API}/customers", json={"name": "TEST_B_customer"})
        assert rB.status_code == 200
        bid = rB.json()["id"]

        listA = A.get(f"{API}/customers").json()
        assert all(x["id"] != bid for x in listA)
        assert any(x["id"] == aid for x in listA)

        assert A.get(f"{API}/customers/{bid}").status_code == 404
        assert A.put(f"{API}/customers/{bid}", json={"name": "hack"}).status_code == 404
        assert A.delete(f"{API}/customers/{bid}").status_code == 404

        assert B.get(f"{API}/customers/{bid}").json()["name"] == "TEST_B_customer"

    def test_dashboard_isolation(self):
        tokA, _, _, _ = _register()
        A = _client(tokA)
        d = A.get(f"{API}/dashboard").json()
        assert d["customers"] == 0
        assert d["active_jobs"] == 0
        assert d["invoices"] == 0


class TestCustomers:
    def test_crud(self, demo_client):
        r = demo_client.post(f"{API}/customers", json={"name": "TEST_Ügyfél Ő", "email": "t@x.hu"})
        assert r.status_code == 200
        cid = r.json()["id"]
        assert demo_client.get(f"{API}/customers/{cid}").json()["name"] == "TEST_Ügyfél Ő"
        demo_client.put(f"{API}/customers/{cid}", json={"name": "TEST_Módosítva"})
        assert demo_client.get(f"{API}/customers/{cid}").json()["name"] == "TEST_Módosítva"
        assert demo_client.delete(f"{API}/customers/{cid}").status_code == 200
        assert demo_client.get(f"{API}/customers/{cid}").status_code == 404


class TestJobs:
    def test_crud(self, demo_client):
        r = demo_client.post(f"{API}/jobs", json={"title": "TEST_Job", "status": "uj", "value": 1000})
        jid = r.json()["id"]
        assert demo_client.put(f"{API}/jobs/{jid}",
                               json={"title": "TEST_Job", "status": "folyamatban", "value": 2000}).status_code == 200
        assert demo_client.get(f"{API}/jobs/{jid}").json()["status"] == "folyamatban"
        demo_client.delete(f"{API}/jobs/{jid}")


class TestQuoteJobInvoiceFlow:
    def test_full_flow(self, demo_client):
        q_payload = {
            "number": "TEST-Q-FLOW", "title": "TEST_Flow ajánlat", "customer_name": "TEST_Ügyfél",
            "status": "vazlat", "vat_rate": 27,
            "items": [{"description": "TEST tétel ű", "quantity": 2, "unit": "db", "unit_price": 1000}],
        }
        rq = demo_client.post(f"{API}/quotes", json=q_payload)
        assert rq.status_code == 200
        qid = rq.json()["id"]

        pdf = demo_client.get(f"{API}/quotes/{qid}/pdf")
        assert pdf.status_code == 200
        assert pdf.headers.get("content-type", "").startswith("application/pdf")
        assert pdf.content[:4] == b"%PDF"

        rj = demo_client.post(f"{API}/quotes/{qid}/job")
        assert rj.status_code == 200, rj.text
        job = rj.json()
        assert job["quote_id"] == qid
        assert demo_client.get(f"{API}/quotes/{qid}").json()["status"] == "elfogadva"

        # mark job elkeszult
        upd = {k: job.get(k) for k in ("title", "customer_id", "customer_name", "priority",
                                        "value", "deadline", "description", "quote_id")}
        upd["status"] = "elkeszult"
        demo_client.put(f"{API}/jobs/{job['id']}", json=upd)

        ri = demo_client.post(f"{API}/jobs/{job['id']}/invoice")
        assert ri.status_code == 200, ri.text
        inv = ri.json()
        assert inv["job_id"] == job["id"]
        assert len(inv["items"]) >= 1
        assert demo_client.get(f"{API}/jobs/{job['id']}").json()["status"] == "elkeszult"

        pdf2 = demo_client.get(f"{API}/invoices/{inv['id']}/pdf")
        assert pdf2.status_code == 200
        assert pdf2.content[:4] == b"%PDF"
        assert len(pdf2.content) > 1000

        ri2 = demo_client.post(f"{API}/jobs/{job['id']}/invoice")
        assert ri2.json()["id"] == inv["id"]

        demo_client.delete(f"{API}/invoices/{inv['id']}")
        demo_client.delete(f"{API}/jobs/{job['id']}")
        demo_client.delete(f"{API}/quotes/{qid}")


class TestInvoices:
    def test_crud(self, demo_client):
        payload = {
            "number": "TEST-INV-1", "title": "TEST_Számla", "customer_name": "TEST_C",
            "status": "kiallitva", "issue_date": "2026-01-05", "due_date": "2026-01-13",
            "vat_rate": 27,
            "items": [{"description": "TEST", "quantity": 1, "unit": "db", "unit_price": 5000}],
        }
        r = demo_client.post(f"{API}/invoices", json=payload)
        assert r.status_code == 200
        iid = r.json()["id"]
        pdf = demo_client.get(f"{API}/invoices/{iid}/pdf")
        assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"
        demo_client.delete(f"{API}/invoices/{iid}")


class TestReports:
    def test_reports_structure(self, demo_client):
        r = demo_client.get(f"{API}/reports")
        assert r.status_code == 200
        d = r.json()
        for k in ("year", "months", "yearly_revenue", "paid_revenue", "unpaid_revenue",
                  "invoice_count", "quote_acceptance", "top_customers"):
            assert k in d
        assert len(d["months"]) == 12


class TestCompany:
    def test_get_and_save(self, demo_client):
        r = demo_client.get(f"{API}/company")
        assert r.status_code == 200
        body = r.json()
        body["name"] = "TEST_Cég Ő"
        r2 = demo_client.put(f"{API}/company", json=body)
        assert r2.status_code == 200 and r2.json()["name"] == "TEST_Cég Ő"


class TestDashboard:
    def test_dashboard(self, demo_client):
        r = demo_client.get(f"{API}/dashboard")
        assert r.status_code == 200
        d = r.json()
        for k in ("customers", "active_jobs", "open_quotes", "invoices",
                  "monthly_revenue", "yearly_revenue", "unpaid_value",
                  "jobs_by_status", "recent_jobs", "recent_quotes", "recent_invoices"):
            assert k in d
        assert set(d["jobs_by_status"].keys()) == {"tervezett", "folyamatban", "elkeszult"}

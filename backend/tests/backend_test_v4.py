"""WorkMate HU – iteration 4 backend tests: public /contacts, global /search,
customer /history, /calendar, user isolation."""
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


# ---------- Public /contacts ----------
class TestContactsPublic:
    def test_contact_post_no_auth_ok(self):
        r = requests.post(f"{API}/contacts", json={
            "name": "TEST User", "email": "test_contact@example.com",
            "subject": "TEST tárgy", "message": "Ez egy teszt üzenet a WorkMate HU rendszerhez."
        })
        assert r.status_code == 200, r.text
        b = r.json()
        assert b.get("ok") is True
        assert "üzenet" in (b.get("message") or "").lower() or "köszönjük" in (b.get("message") or "").lower()

    def test_contact_invalid_email_422(self):
        r = requests.post(f"{API}/contacts", json={
            "name": "T", "email": "not-an-email",
            "subject": "x", "message": "y"
        })
        assert r.status_code == 422

    def test_contact_missing_fields_422(self):
        r = requests.post(f"{API}/contacts", json={"name": "T"})
        assert r.status_code == 422


# ---------- Global search ----------
class TestGlobalSearch:
    def test_search_requires_auth(self):
        r = requests.get(f"{API}/search", params={"q": "kov"})
        assert r.status_code == 401

    def test_search_short_query_empty(self, demo_client):
        r = demo_client.get(f"{API}/search", params={"q": "k"})
        assert r.status_code == 200
        assert r.json().get("results") == []

    def test_search_returns_multi_kind_results(self, demo_client):
        # demo seed contains customer 'Kovács' etc.
        r = demo_client.get(f"{API}/search", params={"q": "kov"})
        assert r.status_code == 200
        results = r.json().get("results", [])
        assert isinstance(results, list)
        kinds = {x["kind"] for x in results}
        # At least Ügyfél should hit for demo seed 'Kovács Kft.'
        assert "Ügyfél" in kinds, f"Expected 'Ügyfél' in kinds, got {kinds}, results={results[:3]}"
        # Every result must contain required fields
        for r_ in results:
            assert set(r_.keys()) >= {"kind", "id", "title", "route"}

    def test_search_isolation_between_users(self):
        tokA, _, _, _ = _register()
        tokB, _, _, _ = _register()
        A = _client(tokA)
        B = _client(tokB)
        # A creates a customer with unique name
        unique = f"TESTZZ_{uuid.uuid4().hex[:6]}"
        A.post(f"{API}/customers", json={"name": unique, "email": f"{unique}@ex.hu"})
        rA = A.get(f"{API}/search", params={"q": unique}).json().get("results", [])
        rB = B.get(f"{API}/search", params={"q": unique}).json().get("results", [])
        assert any(x["title"] == unique for x in rA)
        assert not any(x["title"] == unique for x in rB), f"User B saw {rB}"


# ---------- Customer history ----------
class TestCustomerHistory:
    def test_history_requires_auth(self):
        r = requests.get(f"{API}/customers/anything/history")
        assert r.status_code == 401

    def test_history_returns_full_payload(self, demo_client):
        customers = demo_client.get(f"{API}/customers").json()
        assert len(customers) > 0
        cid = customers[0]["id"]
        r = demo_client.get(f"{API}/customers/{cid}/history")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("customer", "jobs", "quotes", "invoices", "payments", "documents", "stats"):
            assert k in d, f"missing key {k}"
        for k in ("jobs", "open_jobs", "quotes", "invoices", "invoiced", "paid", "outstanding", "hours"):
            assert k in d["stats"], f"missing stats.{k}"
        assert d["customer"]["id"] == cid

    def test_history_other_user_404(self):
        tokA, _, _, _ = _register()
        tokB, _, _, _ = _register()
        A = _client(tokA)
        B = _client(tokB)
        c = A.post(f"{API}/customers", json={"name": "TESTHIST"}).json()
        r = B.get(f"{API}/customers/{c['id']}/history")
        assert r.status_code == 404


# ---------- Calendar ----------
class TestCalendar:
    def test_calendar_requires_auth(self):
        r = requests.get(f"{API}/calendar")
        assert r.status_code == 401

    def test_calendar_returns_events_sorted(self, demo_client):
        r = demo_client.get(f"{API}/calendar")
        assert r.status_code == 200
        events = r.json().get("events", [])
        assert isinstance(events, list)
        # sorted ascending by date
        dates = [e["date"] for e in events]
        assert dates == sorted(dates)
        # Each event has required fields
        for e in events[:10]:
            assert set(e.keys()) >= {"id", "date", "kind", "title", "route", "status"}
            assert e["kind"] in ("munka", "ajanlat", "szamla")

    def test_calendar_user_scoped(self):
        tokA, _, _, _ = _register()
        tokB, _, _, _ = _register()
        A = _client(tokA)
        B = _client(tokB)
        # A creates a job with a deadline
        A.post(f"{API}/jobs", json={
            "title": "TESTCALJOB_A", "customer_name": "TEST",
            "status": "erdeklodo", "priority": "normal",
            "value": 0, "deadline": "2026-06-15", "description": ""
        })
        eventsA = A.get(f"{API}/calendar").json()["events"]
        eventsB = B.get(f"{API}/calendar").json()["events"]
        assert any(e["title"] == "TESTCALJOB_A" for e in eventsA)
        assert not any(e["title"] == "TESTCALJOB_A" for e in eventsB)


# ---------- Auth guard sanity for previously-touched paths ----------
class TestAuthGuardRegression:
    @pytest.mark.parametrize("path", ["/customers", "/jobs", "/quotes", "/invoices",
                                       "/payments", "/documents", "/reports", "/calendar",
                                       "/search"])
    def test_requires_bearer(self, path):
        r = requests.get(f"{API}{path}")
        assert r.status_code == 401, f"{path} returned {r.status_code}"

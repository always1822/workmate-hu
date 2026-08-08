"""WorkMate HU – demo adatok generálása (közös logika a REST endpointhoz és a CLI szkripthez)."""
from datetime import datetime, timezone, timedelta

from models import Customer, Job, Quote, Invoice, WorkLog, Document, Payment, Company, LineItem

COLLECTIONS = ["customers", "jobs", "quotes", "invoices", "worklogs", "documents", "payments"]


async def seed_user(db, uid: str, company_name: str = "", contact_name: str = "", email: str = "",
                    with_company: bool = False) -> bool:
    """Feltölti a felhasználó fiókját demo adatokkal. False, ha már voltak adatai."""
    if await db.customers.count_documents({"user_id": uid}) > 0:
        return False

    today = datetime.now(timezone.utc).date()

    if with_company:
        await db.company.replace_one({"user_id": uid}, {"user_id": uid, **Company(
            name=company_name or "WorkMate Demo Kft.", contact_name=contact_name or "Demo Vállalkozó",
            tax_number="98765432-1-41", reg_number="01-09-123456",
            address="1136 Budapest, Hegedűs Gyula u. 8.", email=email, phone="+36 1 234 5678",
            website="workmate.hu", bank_account="12345678-12345678-12345678",
            quote_footer="Köszönjük, hogy minket választott!", onboarded=True).model_dump()}, upsert=True)

    custs = [
        Customer(user_id=uid, name="Kovács Építő Kft.", contact="Kovács Béla", email="bela@kovacsepito.hu",
                 phone="+36 30 123 4567", address="1052 Budapest, Deák Ferenc u. 12.", tax_number="12345678-2-41",
                 notes="Rendszeres partner, gyors fizető."),
        Customer(user_id=uid, name="Szabó Ingatlan Zrt.", contact="Szabó Anna", email="anna@szaboingatlan.hu",
                 phone="+36 20 987 6543", address="6720 Szeged, Kárász u. 4."),
        Customer(user_id=uid, name="Nagy Autószerviz", contact="Nagy Péter", email="info@nagyszerviz.hu",
                 phone="+36 70 555 1212", address="4025 Debrecen, Piac u. 45."),
    ]
    await db.customers.insert_many([c.model_dump() for c in custs])

    jobs = [
        Job(user_id=uid, title="Tetőszigetelés felújítás", customer_id=custs[0].id, customer_name=custs[0].name,
            status="folyamatban", priority="magas", value=1250000, deadline=str(today + timedelta(days=20)),
            description="Teljes tetőfelület szigetelése és cserépcsere."),
        Job(user_id=uid, title="Iroda festés – 3. emelet", customer_id=custs[1].id, customer_name=custs[1].name,
            status="tervezett", value=480000, deadline=str(today + timedelta(days=8))),
        Job(user_id=uid, title="Villanyszerelés bővítés", customer_id=custs[2].id, customer_name=custs[2].name,
            status="elkeszult", value=320000, deadline=str(today - timedelta(days=5))),
        Job(user_id=uid, title="Kerítés építés", customer_id=custs[0].id, customer_name=custs[0].name,
            status="elkeszult", value=890000, deadline=str(today - timedelta(days=30))),
    ]
    await db.jobs.insert_many([j.model_dump() for j in jobs])

    quotes = [
        Quote(user_id=uid, number=f"AJ-{today.year}-001", customer_id=custs[0].id, customer_name=custs[0].name,
              title="Tetőfelújítás komplett", status="letrehozva", valid_until=str(today + timedelta(days=30)),
              notes="Az ár tartalmazza az anyagot és a munkadíjat.",
              items=[LineItem(description="Bontás és hordalék elszállítás", quantity=1, unit="alk", unit_price=180000),
                     LineItem(description="Tetőcserép csere", quantity=120, unit="m2", unit_price=6500),
                     LineItem(description="Szigetelés", quantity=120, unit="m2", unit_price=3200)]),
        Quote(user_id=uid, number=f"AJ-{today.year}-002", customer_id=custs[1].id, customer_name=custs[1].name,
              title="Irodafestés", status="letrehozva", valid_until=str(today + timedelta(days=45)),
              items=[LineItem(description="Falfestés 2 rétegben", quantity=340, unit="m2", unit_price=1450)]),
    ]
    await db.quotes.insert_many([q.model_dump() for q in quotes])

    invoices = [
        Invoice(user_id=uid, number=f"SZ-{today.year}-001", customer_id=custs[0].id, customer_name=custs[0].name,
                job_id=jobs[3].id, title="Kerítés építés", status="fizetve",
                issue_date=str(today.replace(day=1)), due_date=str(today),
                items=[LineItem(description="Kerítés építés", quantity=1, unit="alk", unit_price=700787)]),
        Invoice(user_id=uid, number=f"SZ-{today.year}-002", customer_id=custs[2].id, customer_name=custs[2].name,
                job_id=jobs[2].id, title="Villanyszerelés bővítés", status="kiallitva",
                issue_date=str(today), due_date=str(today + timedelta(days=8)),
                items=[LineItem(description="Villanyszerelés", quantity=16, unit="óra", unit_price=15748)]),
    ]
    await db.invoices.insert_many([i.model_dump() for i in invoices])

    await db.worklogs.insert_many([w.model_dump() for w in [
        WorkLog(user_id=uid, date=str(today - timedelta(days=2)), job_id=jobs[0].id, job_title=jobs[0].title,
                worker="Kis János", hours=8, description="Bontási munkák"),
        WorkLog(user_id=uid, date=str(today - timedelta(days=1)), job_id=jobs[0].id, job_title=jobs[0].title,
                worker="Kis János", hours=6.5, description="Szigetelés előkészítés"),
        WorkLog(user_id=uid, date=str(today - timedelta(days=1)), job_id=jobs[1].id, job_title=jobs[1].title,
                worker="Tóth Gábor", hours=4, description="Felmérés"),
    ]])

    await db.documents.insert_many([d.model_dump() for d in [
        Document(user_id=uid, name="Vállalkozói szerződés – Kovács.pdf", category="szerzodes",
                 customer_id=custs[0].id, customer_name=custs[0].name, size_kb=340),
        Document(user_id=uid, name="Teljesítésigazolás.pdf", category="igazolas",
                 customer_id=custs[2].id, customer_name=custs[2].name, size_kb=120),
        Document(user_id=uid, name="Anyagszámla – tetőcserép.pdf", category="szamla",
                 customer_id=custs[0].id, customer_name=custs[0].name, size_kb=88),
    ]])

    await db.payments.insert_many([p.model_dump() for p in [
        Payment(user_id=uid, kind="kiadas", title="Anyagbeszerzés – tetőcserép", category="anyag",
                amount=420000, date=str(today.replace(day=1)), customer_id=custs[0].id, customer_name=custs[0].name),
        Payment(user_id=uid, kind="kiadas", title="Üzemanyag", category="uzemanyag", amount=68000, date=str(today)),
        Payment(user_id=uid, kind="bevetel", title="Kiszállási díj (készpénz)", category="szolgaltatas",
                amount=35000, date=str(today), customer_id=custs[2].id, customer_name=custs[2].name),
    ]])
    return True

#!/usr/bin/env python3
"""WorkMate HU – demo adat generátor.

Használat (a backend könyvtárból, aktív virtuális környezettel):

    python seed_db.py                      # demo fiók + demo adatok létrehozása
    python seed_db.py --reset              # a demo fiók adatainak törlése és újragenerálása
    python seed_db.py --email a@b.hu --password Titok123 --company "Saját Kft."
    python seed_db.py --wipe               # a TELJES adatbázis törlése (megerősítést kér)

Teljesen üres adatbázisból is futtatható. A demo adatok tartalma megegyezik a
felületen automatikusan betöltődő adatokkal (közös forrás: seed_data.py).
"""
import argparse
import asyncio
import os
import sys
import uuid
from pathlib import Path

import bcrypt
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")
sys.path.insert(0, str(ROOT))

from models import now_iso  # noqa: E402
from seed_data import seed_user, COLLECTIONS  # noqa: E402


def log(msg):
    print(f"  {msg}")


async def run(db, email, password, name, company_name, reset):
    user = await db.users.find_one({"email": email})

    if user and reset:
        for c in COLLECTIONS:
            await db[c].delete_many({"user_id": user["id"]})
        await db.users.update_one({"id": user["id"]}, {"$set": {"seeded": False}})
        log(f"Meglévő adatok törölve: {email}")

    if not user:
        uid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": uid, "name": name, "email": email, "company_name": company_name,
            "password_hash": bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode(),
            "seeded": False, "created_at": now_iso()})
        log(f"Felhasználó létrehozva: {email} / {password}")
    else:
        uid = user["id"]
        log(f"Meglévő felhasználó: {email}")

    created = await seed_user(db, uid, company_name=company_name, contact_name=name,
                              email=email, with_company=True)
    if created:
        await db.users.update_one({"id": uid}, {"$set": {"seeded": True}})
        log("Demo adatok létrehozva: 3 ügyfél, 4 munka, 2 ajánlat, 2 számla, 3 munkanapló, 3 dokumentum, 3 pénzügyi tétel")
    else:
        log("A felhasználónak már vannak adatai – kihagyva (--reset a felülíráshoz)")


async def main():
    ap = argparse.ArgumentParser(description="WorkMate HU demo adat generátor")
    ap.add_argument("--email", default=os.environ.get("DEMO_EMAIL", "demo@workmate.hu"))
    ap.add_argument("--password", default=os.environ.get("DEMO_PASSWORD", "workmate123"))
    ap.add_argument("--name", default="Demo Vállalkozó")
    ap.add_argument("--company", default="WorkMate Demo Kft.")
    ap.add_argument("--reset", action="store_true", help="a felhasználó meglévő adatainak törlése és újragenerálása")
    ap.add_argument("--wipe", action="store_true", help="a TELJES adatbázis törlése")
    args = ap.parse_args()

    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    print(f"Adatbázis: {os.environ['DB_NAME']} ({os.environ['MONGO_URL']})")

    if args.wipe:
        if input("Biztosan törlöd a TELJES adatbázist? (igen/nem): ").strip().lower() != "igen":
            print("Megszakítva.")
            return
        for c in COLLECTIONS + ["users", "company", "contacts", "password_reset_tokens"]:
            await db[c].delete_many({})
        print("Adatbázis kiürítve.")

    await run(db, args.email.lower(), args.password, args.name, args.company, args.reset)
    print(f"\nKész. Belépés: {args.email} / {args.password}")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())

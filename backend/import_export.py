#!/usr/bin/env python3
"""WorkMate HU – a data_export/ mappában lévő JSON adatok betöltése a MongoDB-be.

Használat (a backend könyvtárból, aktív virtuális környezettel):

    python import_export.py              # a hiányzó rekordok beszúrása
    python import_export.py --replace    # a meglévő azonos id-jű rekordok felülírása

A mappa a demo fiók teljes adatállományát tartalmazza (felhasználó, céges profil,
ügyfelek, munkák, ajánlatok, számlák, pénzügy, dokumentumok, munkanapló).
Belépés az importált fiókkal: demo@workmate.hu / workmate123
"""
import argparse
import asyncio
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")
DATA_DIR = ROOT.parent / "data_export"

FILES = ["users", "company", "customers", "jobs", "quotes", "invoices",
         "payments", "documents", "worklogs"]


async def main():
    ap = argparse.ArgumentParser(description="WorkMate HU JSON adat import")
    ap.add_argument("--replace", action="store_true", help="meglévő rekordok felülírása")
    args = ap.parse_args()

    if not DATA_DIR.exists():
        print(f"Nem található a mappa: {DATA_DIR}")
        return

    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]
    print(f"Adatbázis: {os.environ['DB_NAME']}")

    for name in FILES:
        path = DATA_DIR / f"{name}.json"
        if not path.exists():
            continue
        docs = json.loads(path.read_text(encoding="utf-8"))
        inserted = skipped = 0
        for doc in docs:
            doc.pop("_id", None)
            key = {"id": doc["id"]} if "id" in doc else {"user_id": doc["user_id"]}
            existing = await db[name].find_one(key)
            if existing and not args.replace:
                skipped += 1
                continue
            if existing:
                await db[name].replace_one(key, doc)
            else:
                await db[name].insert_one(doc)
            inserted += 1
        print(f"  {name}: {inserted} betöltve, {skipped} kihagyva")

    print("\nKész. Belépés: demo@workmate.hu / workmate123")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())

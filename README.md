# WorkMate HU

**Magyar vállalkozók digitális munkatársa** – prémium, magyar nyelvű vállalkozáskezelő rendszer (SaaS / Business OS) kisvállalkozóknak: festőknek, burkolóknak, villanyszerelőknek, építőipari szakembereknek, karbantartóknak és egyéni vállalkozóknak.

A rendszer kiváltja a szétszórt Excel táblákat, a papíralapú ajánlatokat és a telefonban tárolt ügyféladatokat. Egyetlen felületen kezelhető a teljes napi adminisztráció:

> Regisztráció → Céges profil → Ügyfél → Ajánlat → PDF ajánlat / e-mail → Elfogadás → Munka → Munka lezárása → Számla → PDF számla / e-mail → Bevételi és profit riportok

## Modulok

| Modul | Funkció |
|---|---|
| **Dashboard** | ügyfél-, munka-, ajánlat- és számlaszám, havi és éves bevétel, gyors műveletek, legutóbbi munkák és ajánlatok, pipeline áttekintés |
| **Ügyfelek** | lista, keresés, létrehozás, módosítás, törlés + **ügyfél-történet** (munkák, ajánlatok, számlák, fizetések, dokumentumok, összegzés) |
| **Munkák** | lista és kanban nézet, 6 lépcsős státusz (Érdeklődő → Ajánlat elküldve → Elfogadva → Folyamatban → Kész → Lezárva), határidő, érték, prioritás |
| **Ajánlatok** | tételes szerkesztő ÁFA-számítással, státuszok (Piszkozat → Elküldve → Elfogadva → Munka létrehozva), PDF generálás, e-mail küldés, munka létrehozása egy kattintással |
| **Számlák** | lezárt munkából automatikus számla-előkészítés, tételek átvétele, PDF számla, e-mail küldés, státuszok (Vázlat → Kiállítva → Fizetve) |
| **Pénzügy** | bevétel/kiadás nyilvántartás kategóriákkal, profit számítás |
| **Riportok** | havi bevétel/kiadás diagram, éves bevétel, befolyt összeg, kintlévőség, ajánlat elfogadási arány, top ügyfelek |
| **Naptár** | munka határidők, ajánlat érvényességek, fizetési határidők; lejárt és közelgő határidők |
| **Munkanapló** | napi óraelszámolás munkára bontva |
| **Dokumentumok** | fájlfeltöltés kategóriákkal, letöltés, ügyfélhez rendelés |
| **Céges profil** | cégadatok és logó – automatikusan bekerülnek minden PDF-be |
| **Beállítások** | fiókadatok, világos/sötét téma, kijelentkezés |

További jellemzők: globális keresés minden modulban, jelszó-visszaállítás e-mailben, publikus Kapcsolat / ÁSZF / Adatkezelés / Impresszum oldalak, teljes mobil támogatás, világos és sötét téma.

## Technológia

| Réteg | Technológia |
|---|---|
| Frontend | React 19 (CRA + CRACO), react-router 7, TanStack Query, Tailwind CSS, shadcn/ui, lucide-react, sonner |
| Backend | FastAPI (Python 3.11), motor (async MongoDB), PyJWT, bcrypt, reportlab (PDF), httpx |
| Adatbázis | MongoDB 7 |
| Integrációk | object storage (fájlfeltöltés), Resend (e-mail) – mindkettő opcionális |

> Megjegyzés: a projekt eredetileg PHP + MySQL környezetben indult, a megvalósítás React + FastAPI + MongoDB stacken készült. Ezért nincs `workmatehu.sql`; a hordozható adatbázis-mentést a `scripts/export_db.sh` és `scripts/import_db.sh` biztosítja (`mongodump`/`mongorestore`).

## Projekt felépítése

```
WorkMateHU/
├── backend/
│   ├── server.py            # FastAPI app: auth, CRUD, PDF, riportok, naptár, keresés
│   ├── services.py          # object storage + e-mail integráció, e-mail sablonok
│   ├── seed_db.py           # demo adat generátor (üres adatbázisból is)
│   ├── requirements.txt
│   ├── .env.example
│   └── tests/               # pytest API tesztek (62 teszt)
├── frontend/
│   ├── src/
│   │   ├── App.js           # publikus és védett route-ok
│   │   ├── components/      # Shell (sidebar), Fields (UI elemek), GlobalSearch, PublicShell, SendMailModal
│   │   ├── context/         # AuthContext
│   │   ├── pages/           # 17 oldal (Dashboard, Customers, CustomerDetail, Jobs, Quotes, Invoices,
│   │   │                    #  Finance, Reports, Calendar, WorkLog, Documents, Company, Settings,
│   │   │                    #  Auth, ResetPassword, Contact, Legal)
│   │   └── lib/api.js       # axios kliens, státusz szótárak, formázók
│   ├── package.json
│   └── .env.example
├── docs/
│   ├── INSTALLATION.md      # részletes Windows telepítés
│   ├── DATABASE_SCHEMA.md   # kollekciók, mezők, kapcsolatok, indexek
│   └── EXPORT.md            # projekt átadás, letöltés, saját gépen futtatás
├── data_export/             # a demo fiók adatai JSON-ben + import útmutató
├── scripts/                 # adatbázis export / import
├── memory/PRD.md            # termékterv és backlog
└── README.md
```

## Telepítés röviden

Részletes, lépésről lépésre útmutató (tiszta Windows géphez is): **[docs/INSTALLATION.md](docs/INSTALLATION.md)**
A projekt átvétele, letöltése és saját gépen való futtatása: **[docs/EXPORT.md](docs/EXPORT.md)**

Előfeltételek: Node.js 20, Yarn, Python 3.11, MongoDB 7.

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate      # Windows: .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env                                  # töltsd ki (JWT_SECRET kötelező!)
python seed_db.py                                     # demo adatok (opcionális)
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Frontend (új terminál)
cd frontend
cp .env.example .env                                  # REACT_APP_BACKEND_URL=http://localhost:8001
yarn install
yarn start                                            # http://localhost:3000
```

Demo belépés: `demo@workmate.hu` / `workmate123`

## Fejlesztési folyamat

- **Backend**: a `--reload` kapcsolóval a mentés után automatikusan újraindul. Interaktív API dokumentáció: http://localhost:8001/docs
- **Frontend**: hot reload; a Tailwind osztályok a `tailwind.config.js` alapján generálódnak.
- **Kódstílus**: backend PEP8 (ruff), frontend funkcionális React komponensek, oldalanként default export, komponenseknél named export.
- **UI komponensek**: `frontend/src/components/Fields.jsx` (Button, Input, Select, Textarea, Modal, táblázat) és `Shell.jsx` (layout, Card, Badge, PageHeader). Új oldalnál ezeket használd, hogy egységes maradjon a dizájn.
- **Tesztelés**:
  ```bash
  cd backend
  pytest tests/backend_test.py tests/backend_test_v3.py tests/backend_test_v4.py -v
  ```
- **Új modul hozzáadása**: modell + `crud("utvonal", "kollekcio", Modell, ModellIn)` a `server.py`-ban (automatikusan user-scope-olt), majd oldal a `frontend/src/pages/` alatt és menüpont a `Shell.jsx` `NAV` tömbjében.

## Adatbázis

Séma, mezők, kapcsolatok és indexek: **[docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)**

Mentés / visszatöltés:
```bash
./scripts/export_db.sh
./scripts/import_db.sh backup/workmatehu-2026-06-01_1200
```

Példaadatok betöltése JSON-ből (`data_export/` mappa – a demo fiók teljes adatállománya):
```bash
cd backend && python import_export.py
```

## Biztonság

- Jelszavak kizárólag bcrypt hash-ként tárolódnak.
- JWT alapú munkamenet (7 nap), a token a `JWT_SECRET`-tel van aláírva.
- **Minden** üzleti lekérdezés a bejelentkezett felhasználóra szűkít (`user_id`) – idegen rekord azonosítójára 404 a válasz, így egy felhasználó soha nem látja más adatait.
- A feltöltött fájlok is felhasználóhoz kötöttek; idegen fájl elérése 404.
- Jelszó-visszaállító tokenek egyszer használhatók, 1 óra után lejárnak (TTL index takarítja).

## Production telepítés előkészítés

1. **MongoDB**: saját szerveren telepítve vagy MongoDB Atlas – a `MONGO_URL`-t kell átírni.
2. **Backend**: `gunicorn server:app -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8001`, systemd service-ként futtatva.
3. **Frontend**: `yarn build` → a `build/` mappa statikusan kiszolgálható.
4. **Nginx**: `/api` → `127.0.0.1:8001`, minden más → `build/index.html` (SPA fallback).
5. **HTTPS**: `certbot --nginx`.
6. **Élesítés előtti ellenőrzőlista**:
   - [ ] új, véletlen `JWT_SECRET`
   - [ ] `CORS_ORIGINS` a saját domainre szűkítve
   - [ ] `DEMO_EMAIL` / `DEMO_PASSWORD` kiürítve
   - [ ] `CONTACT_EMAIL` a saját címre állítva
   - [ ] rendszeres adatbázis mentés (cron + `scripts/export_db.sh`)
   - [ ] Adatkezelési tájékoztató, ÁSZF és Impresszum tartalmának kitöltése (`frontend/src/pages/Legal.jsx`)

## Későbbi AI bővítés (előkészítve)

A `backend/services.py` külön integrációs réteg, az LLM kulcs pedig környezeti változóból jön. Egy új `/api/ai/*` router hozzáadásával megvalósítható: ajánlat tételek generálása, munkaleírás írása, ügyfél válasz fogalmazása, árkalkuláció-javaslat. Az adatmodell módosítása nem szükséges.

## Licenc és tulajdonjog

A WorkMate HU forráskódja, dokumentációja és adatbázis-sémája a projekt tulajdonosáé. A rendszer nem függ külső fejlesztői platformtól: a `frontend/`, `backend/`, `docs/`, `scripts/` könyvtárak és a konfigurációs minták együtt teljes, önállóan futtatható alkalmazást alkotnak.

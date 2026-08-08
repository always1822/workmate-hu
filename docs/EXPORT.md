# WorkMate HU – Projekt átadási és export útmutató

Ez a dokumentum végigvezet azon, hogyan veszed át a teljes WorkMate HU projektet, hogyan indítod el a saját Windows gépeden, és hogyan fejleszted tovább.

---

## 1. Mit tartalmaz az export

A teljes projekt önállóan futtatható, nincs platform-függősége. Az alábbi könyvtárak és fájlok alkotják:

```
WorkMateHU/
├── frontend/                     # teljes React forráskód
│   ├── src/                      #   App.js, components/, context/, pages/, lib/, hooks/
│   ├── public/
│   ├── package.json              #   függőségek (yarn install)
│   ├── yarn.lock                 #   pontos verziók
│   ├── tailwind.config.js, postcss.config.js, craco.config.js, jsconfig.json
│   └── .env.example              #   környezeti változó minta
├── backend/                      # teljes FastAPI forráskód
│   ├── server.py                 #   API: auth, CRUD, PDF, riportok, naptár, keresés
│   ├── models.py                 #   Pydantic adatmodellek
│   ├── services.py               #   fájltárolás + e-mail integráció
│   ├── seed_data.py              #   demo adatok (közös logika)
│   ├── seed_db.py                #   demo adat generátor CLI
│   ├── requirements.txt          #   Python függőségek
│   ├── pytest.ini
│   ├── tests/                    #   69 automata teszt
│   └── .env.example
├── docs/
│   ├── INSTALLATION.md           # részletes Windows telepítés
│   ├── DATABASE_SCHEMA.md        # kollekciók, mezők, kapcsolatok, indexek
│   └── EXPORT.md                 # ez a fájl
├── data_export/                  # a demo fiók adatai JSON-ben + import útmutató
├── scripts/
│   ├── export_db.sh              # adatbázis mentés
│   └── import_db.sh              # adatbázis visszatöltés
├── README.md                     # projekt bemutatás és összefoglaló
└── .gitignore
```

### Amit az export NEM tartalmaz (szándékosan)

| Elem | Miért | Mi a teendő |
|---|---|---|
| `backend/.env`, `frontend/.env` | titkos kulcsokat tartalmaz, `.gitignore`-ban van | másold le a `.env.example` fájlokat és töltsd ki (lásd 4. pont) |
| `node_modules/`, `venv/` | több száz MB, újragenerálható | `yarn install` és `pip install -r requirements.txt` |
| adatbázis tartalom | a MongoDB külön szolgáltatás | a `data_export/` mappa tartalmazza a demo fiók adatait JSON-ben (`cd backend && python import_export.py`), vagy generálj újat: `python seed_db.py` |
| `build/` | fordítási eredmény | `yarn build` |

---

## 2. A projekt letöltése

A platform felületéről kétféleképp juthatsz a kódhoz (a pontos, kattintásszintű lépéseket a platform súgója írja le):

- **GitHub push** – a kód egy saját GitHub repositoryba kerül; innen `git clone`-nal bármikor letöltheted és verziózhatod. Továbbfejlesztéshez ez az ajánlott út.
- **ZIP letöltés** – egyszeri, teljes csomag letöltése.

Letöltés után csomagold ki például ide: `C:\projects\WorkMateHU`

Git használata esetén:
```powershell
cd C:\projects
git clone https://github.com/<felhasznalo>/<repo>.git WorkMateHU
cd WorkMateHU
```

---

## 3. Szükséges programok (Windows)

| Program | Verzió | Letöltés |
|---|---|---|
| Node.js | 20.x LTS | https://nodejs.org |
| Yarn | 1.22+ | `npm install -g yarn` |
| Python | 3.11.x | https://www.python.org/downloads/windows/ (pipáld be az *Add python.exe to PATH*-t) |
| MongoDB Community Server | 7.0 | https://www.mongodb.com/try/download/community (*Install as a Service* bekapcsolva) |
| MongoDB Database Tools | legfrissebb | https://www.mongodb.com/try/download/database-tools |
| Git | legfrissebb | https://git-scm.com/download/win |

Ellenőrzés PowerShellben:
```powershell
node -v; yarn -v; python --version; mongod --version
```

Részletes telepítési leírás képernyőnként: **[INSTALLATION.md](INSTALLATION.md)**

---

## 4. Adatbázis beállítása

Nem kell adatbázist létrehoznod – a backend az első íráskor automatikusan létrehozza a `DB_NAME`-ben megadott adatbázist és az indexeket.

```powershell
Get-Service MongoDB      # fut-e
net start MongoDB        # ha nem
mongosh                  # kapcsolat teszt, majd: exit
```

Ha felhőben tárolnád: hozz létre egy MongoDB Atlas klasztert, és a connection stringet írd a `MONGO_URL`-be – más változtatás nem kell.

---

## 5. Környezeti változók

```powershell
cd C:\projects\WorkMateHU\backend
copy .env.example .env
notepad .env
```

Kötelezően kitöltendő:
- `MONGO_URL` – pl. `mongodb://localhost:27017`
- `DB_NAME` – pl. `workmatehu`
- `JWT_SECRET` – saját véletlen érték, generálás:
  ```powershell
  python -c "import secrets;print(secrets.token_hex(32))"
  ```

Opcionális: `DEMO_EMAIL` / `DEMO_PASSWORD` (demo fiók), `CONTACT_EMAIL`, `EMERGENT_LLM_KEY` (fájlfeltöltés), `EMERGENT_EMAIL_KEY` (e-mail küldés). Ha az utóbbi kettőt üresen hagyod, **minden más funkció működik** – csak a fájlfeltöltés és az e-mail küldés lesz kikapcsolva.

```powershell
cd ..\frontend
copy .env.example .env
notepad .env        # REACT_APP_BACKEND_URL=http://localhost:8001
```

---

## 6. Indítás

**1. terminál – backend:**
```powershell
cd C:\projects\WorkMateHU\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
Ellenőrzés: http://localhost:8001/api/ → `{"message":"WorkMate HU API","status":"ok"}`
API dokumentáció: http://localhost:8001/docs

**2. terminál – frontend:**
```powershell
cd C:\projects\WorkMateHU\frontend
yarn install
yarn start
```
Megnyílik: http://localhost:3000

**Demo adatok betöltése (opcionális):**
```powershell
cd C:\projects\WorkMateHU\backend
.\venv\Scripts\Activate.ps1
python seed_db.py                # friss demo adatok (dátumok a mai naphoz igazítva)
# vagy a mellékelt valós példaadatok betöltése:
python import_export.py
```
Belépés: `demo@workmate.hu` / `workmate123`

Vagy egyszerűen regisztrálj a felületen – az új fiók automatikusan kap demo adatokat.

---

## 7. Adatbázis mentés és visszatöltés

Git Bash / WSL:
```bash
./scripts/export_db.sh                                  # backup/workmatehu-<dátum>/
./scripts/import_db.sh backup/workmatehu-2026-06-01_1200
```

PowerShell közvetlenül:
```powershell
mongodump --uri="mongodb://localhost:27017" --db=workmatehu --out=backup
mongorestore --uri="mongodb://localhost:27017" --db=workmatehu --drop backup\workmatehu
```

A mentés BSON és olvasható JSON formátumban is készül, így bármilyen MongoDB példányba visszatölthető.

---

## 8. Továbbfejlesztés

**Fejlesztői ciklus:** mindkét szolgáltatás hot reloaddal fut – mentés után azonnal frissül.

**Új mező hozzáadása:** `backend/models.py`-ban bővítsd a modellt (a `crud()` generátor automatikusan kezeli), majd a megfelelő oldalon a `frontend/src/pages/` alatt vedd fel az űrlapmezőt.

**Új modul hozzáadása:**
1. `backend/models.py`: `Modell(Owned)` és `ModellIn(BaseModel)` osztály
2. `backend/server.py`: `crud("utvonal", "kollekcio", Modell, ModellIn)` – automatikusan felhasználóra szűrt CRUD
3. `frontend/src/pages/UjOldal.jsx` – a `components/Fields.jsx` és `components/Shell.jsx` elemeit használva marad egységes a dizájn
4. `frontend/src/App.js`: új `<Route>`
5. `frontend/src/components/Shell.jsx`: új elem a `NAV` tömbben

**Tesztek futtatása:**
```powershell
cd backend
.\venv\Scripts\Activate.ps1
pytest tests\ -v
```

**Verziókezelés:**
```powershell
git add .
git commit -m "Új funkció: ..."
git push
```

**Fontos szabályok, hogy ne törjön el semmi:**
- Minden backend útvonal `/api` előtaggal kezdődjön.
- Minden adatbázis-lekérdezés tartalmazza a `"user_id": user["id"]` szűrőt (ez biztosítja, hogy a felhasználók ne lássák egymás adatait).
- A frontend mindig a `REACT_APP_BACKEND_URL` változóból építse az API címet, soha ne legyen bedrótozva.
- Frontend csomagokhoz `yarn`-t használj, ne `npm`-et (a `yarn.lock` konzisztenciája miatt).

---

## 9. Élesítés saját tárhelyre / VPS-re

1. Ubuntu szerver: `apt install python3.11 python3.11-venv nodejs npm mongodb-org nginx`
2. Backend systemd service-ként: `gunicorn server:app -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8001`
3. Frontend: `yarn build` → a `build/` mappa statikus kiszolgálása
4. Nginx: `/api` → `127.0.0.1:8001`, minden más → `build/index.html` (SPA fallback)
5. HTTPS: `certbot --nginx`
6. Élesítés előtt: új `JWT_SECRET`, `CORS_ORIGINS` a saját domainre, `DEMO_EMAIL` kiürítése, napi automatikus adatbázis mentés (cron + `scripts/export_db.sh`)

---

## 10. Átadási ellenőrzőlista

- [ ] A projekt letöltve (GitHub clone vagy ZIP)
- [ ] Node.js, Yarn, Python, MongoDB telepítve és ellenőrizve
- [ ] `backend/.env` és `frontend/.env` létrehozva a `.example` fájlokból, `JWT_SECRET` lecserélve
- [ ] `pip install -r requirements.txt` lefutott
- [ ] `yarn install` lefutott
- [ ] Backend válaszol: http://localhost:8001/api/
- [ ] Frontend betölt: http://localhost:3000
- [ ] Regisztráció és belépés működik
- [ ] Demo adatok betöltve (`python seed_db.py`)
- [ ] Ajánlat PDF letöltés működik
- [ ] Adatbázis mentés kipróbálva (`scripts/export_db.sh`)
- [ ] Tesztek lefutnak (`pytest tests/`)

# WorkMate HU – Telepítési útmutató (Windows)

Ez az útmutató nulláról, egy tiszta Windows 10/11 gépen végigvezet a WorkMate HU elindításán.

---

## 1. Szükséges programok

| Program | Ajánlott verzió | Letöltés | Miért kell |
|---|---|---|---|
| Node.js | **20.x LTS** (min. 18) | https://nodejs.org/en/download | frontend futtatása |
| Yarn | 1.22+ | Node telepítése után: `npm install -g yarn` | frontend csomagkezelő (npm helyett) |
| Python | **3.11.x** (3.10–3.12 jó) | https://www.python.org/downloads/windows/ | backend futtatása |
| MongoDB Community Server | **7.0** (min. 6.0) | https://www.mongodb.com/try/download/community | adatbázis |
| MongoDB Database Tools | legfrissebb | https://www.mongodb.com/try/download/database-tools | `mongodump` / `mongorestore` mentéshez |
| Git | legfrissebb | https://git-scm.com/download/win | kód letöltése (opcionális) |
| VS Code | legfrissebb | https://code.visualstudio.com | szerkesztés (opcionális) |

### Fontos telepítési beállítások
- **Python**: a telepítő első képernyőjén pipáld be az **"Add python.exe to PATH"** opciót.
- **Node.js**: alapbeállításokkal telepíthető.
- **MongoDB**: a telepítőben hagyd bepipálva az *"Install MongoDB as a Service"* opciót – így a Windows indulásakor automatikusan fut. A MongoDB Compass (grafikus felület) telepítése ajánlott.

### Telepítés ellenőrzése
Nyiss egy **PowerShell** ablakot és futtasd:

```powershell
node -v      # v20.x.x
yarn -v      # 1.22.x
python --version   # Python 3.11.x
mongod --version   # db version v7.0.x
```

Ha a `mongod` nem található, add hozzá a PATH-hoz: `C:\Program Files\MongoDB\Server\7.0\bin`

---

## 2. A projekt letöltése

**Git-tel:**
```powershell
cd C:\projects
git clone <a-repo-url> WorkMateHU
cd WorkMateHU
```

**ZIP-ből:** csomagold ki például ide: `C:\projects\WorkMateHU`

A könyvtárszerkezet így néz ki:
```
WorkMateHU\
  backend\
  frontend\
  docs\
  scripts\
  README.md
```

---

## 3. Adatbázis beállítása

A MongoDB szolgáltatásnak futnia kell. Ellenőrzés PowerShellben:

```powershell
Get-Service MongoDB
```

Ha nem fut:
```powershell
net start MongoDB
```

Kapcsolódás teszt:
```powershell
mongosh
> show dbs
> exit
```

Külön adatbázist **nem kell** létrehoznod: a backend az első íráskor automatikusan létrehozza a `.env`-ben megadott `DB_NAME` adatbázist és a szükséges indexeket.

Ha MongoDB Atlas felhőt használnál, csak a `MONGO_URL`-t kell kicserélni az Atlas connection stringre.

---

## 4. Backend beállítása és indítása

```powershell
cd C:\projects\WorkMateHU\backend

# 1) Virtuális környezet (ajánlott)
python -m venv venv
.\venv\Scripts\Activate.ps1
# Ha hibát ír PowerShell futtatási policy miatt:
#   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

# 2) Csomagok telepítése
pip install -r requirements.txt

# 3) Környezeti változók
copy .env.example .env
notepad .env        # töltsd ki (lásd lentebb)

# 4) Indítás
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

Ha minden rendben, ezt látod:
```
INFO:     Uvicorn running on http://0.0.0.0:8001
INFO:     Application startup complete.
```

Ellenőrzés böngészőben: http://localhost:8001/api/ → `{"message":"WorkMate HU API"}`
Interaktív API dokumentáció: http://localhost:8001/docs

### `backend/.env` kitöltése

| Változó | Kötelező | Példa / magyarázat |
|---|---|---|
| `MONGO_URL` | igen | `mongodb://localhost:27017` – helyi MongoDB |
| `DB_NAME` | igen | `workmatehu` – az adatbázis neve |
| `CORS_ORIGINS` | igen | fejlesztéskor `*`, élesben `https://sajatdomain.hu` |
| `JWT_SECRET` | igen | hosszú véletlen érték, generálás: `python -c "import secrets;print(secrets.token_hex(32))"` |
| `DEMO_EMAIL` / `DEMO_PASSWORD` | nem | ha ki van töltve, induláskor létrejön egy demo fiók |
| `CONTACT_EMAIL` | nem | ide érkeznek a Kapcsolat oldal üzenetei |
| `EMERGENT_LLM_KEY` | nem | fájlfeltöltés (object storage) és későbbi AI funkciók |
| `EMERGENT_EMAIL_KEY` | nem | e-mail küldés (ajánlat/számla/jelszó-visszaállítás) |
| `EMAIL_FROM_NAME` | nem | a kimenő levelek feladóneve |

> Ha az `EMERGENT_*` kulcsokat üresen hagyod, a rendszer **minden más funkciója működik**, csak a fájlfeltöltés és az e-mail küldés lesz kikapcsolva (hibaüzenetet ad, de nem áll le).

---

## 5. Frontend beállítása és indítása

Nyiss egy **új** PowerShell ablakot (a backend maradjon futva):

```powershell
cd C:\projects\WorkMateHU\frontend

copy .env.example .env
notepad .env      # REACT_APP_BACKEND_URL=http://localhost:8001

yarn install      # NE npm install-t használj
yarn start
```

A böngésző automatikusan megnyílik: http://localhost:3000

> **Fontos:** minden `REACT_APP_` előtagú változó csak **indításkor** olvasódik be. Ha módosítod a `.env`-et, állítsd le (`Ctrl+C`) és indítsd újra a `yarn start`-ot.

---

## 6. Demo adatok betöltése

Üres adatbázisból is tesztelhető a rendszer:

```powershell
cd C:\projects\WorkMateHU\backend
.\venv\Scripts\Activate.ps1
python seed_db.py
```

Ez létrehoz:
- demo felhasználót (alapértelmezés: `demo@workmate.hu` / `workmate123`)
- céges profilt, 3 ügyfelet, 4 munkát, 2 ajánlatot, 2 számlát, munkanapló bejegyzéseket, dokumentumokat, pénzügyi tételeket

Hasznos kapcsolók:
```powershell
python seed_db.py --reset                       # törli és újragenerálja a demo felhasználó adatait
python seed_db.py --email en@ceg.hu --password Titok123
python seed_db.py --wipe                        # TELJES adatbázis törlés (vigyázat!)
```

A felületen belépve az alkalmazás első megnyitásakor is betöltődnek a demo adatok, ha a fiók még üres.

---

## 7. Első használat

1. Nyisd meg: http://localhost:3000
2. Lépj be a demo fiókkal, vagy kattints a **Regisztrálj** gombra.
3. Első belépés után a Dashboard tetején lévő sávval ugorj a **Céges profil** oldalra és töltsd ki az adataidat (ezek kerülnek a PDF-ekre).
4. Végigjárható folyamat: Ügyfél → Ajánlat → PDF/e-mail → „Munka" gomb → munka `Kész` állapotba → „Számla" gomb → PDF számla → Riportok.

---

## 8. Adatbázis mentés és visszatöltés

Git Bash-ből vagy WSL-ből:
```bash
./scripts/export_db.sh                       # backup/workmatehu-<dátum>/
./scripts/import_db.sh backup/workmatehu-2026-06-01_1200
```

Windows PowerShellből közvetlenül:
```powershell
mongodump --uri="mongodb://localhost:27017" --db=workmatehu --out=backup
mongorestore --uri="mongodb://localhost:27017" --db=workmatehu --drop backup\workmatehu
```

---

## 9. Gyakori hibák

| Hiba | Megoldás |
|---|---|
| `ModuleNotFoundError: No module named 'fastapi'` | nem aktív a venv → `.\venv\Scripts\Activate.ps1`, majd `pip install -r requirements.txt` |
| `pymongo.errors.ServerSelectionTimeoutError` | nem fut a MongoDB → `net start MongoDB` |
| A frontend „Network Error"-t ír | rossz vagy hiányzó `REACT_APP_BACKEND_URL`, vagy nem fut a backend a 8001-es porton |
| CORS hiba a konzolban | `CORS_ORIGINS` a backend `.env`-ben legyen `*` vagy a frontend pontos címe |
| `401 Nincs bejelentkezve` minden híváskor | lejárt token → jelentkezz ki és be újra |
| A PDF-ben kérdőjelek vannak ékezetek helyett | hiányzik a DejaVu font → Windows alatt automatikusan a beépített fontra vált; teljes ékezetes megjelenéshez másold a `DejaVuSans.ttf`-et a `C:\Windows\Fonts` mappába |
| `yarn: command not found` | `npm install -g yarn` |
| A 3000-es port foglalt | `set PORT=3001 && yarn start` |

---

## 10. Éles telepítés (VPS / tárhely) – összefoglaló

1. Ubuntu VPS-en: `apt install python3.11 python3.11-venv nodejs npm mongodb-org nginx`
2. Backend: `gunicorn server:app -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8001` (systemd service-ként)
3. Frontend: `yarn build` → a `build/` mappa statikus kiszolgálása
4. Nginx: `/api` → `127.0.0.1:8001`, minden más → `build/index.html` (SPA fallback)
5. HTTPS: `certbot --nginx`
6. Élesítés előtt: új `JWT_SECRET`, `CORS_ORIGINS` a saját domainre, `DEMO_EMAIL` kiürítése

Részletek: `README.md` → *Éles környezet* fejezet.

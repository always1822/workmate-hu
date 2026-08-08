# WorkMate HU – PRD

## Termék
Prémium, magyar nyelvű vállalkozáskezelő SaaS (Business OS) kisvállalkozóknak (festők, burkolók, villanyszerelők, karbantartók, egyéni vállalkozók). Kiváltja az Excelt, a papíralapú ajánlatokat és a szétszórt ügyféladatokat.

Teljes üzleti folyamat: Regisztráció → Céges profil → Ügyfél → Ajánlat → PDF ajánlat / e-mail → Elfogadás → Munka → Munka lezárása → Számla → PDF számla / e-mail → Bevételi és profit riportok.

> A felhasználó eredetileg PHP + MySQL + XAMPP környezetben indult. Az Emergent platform ezt nem támogatja, ezért a rendszer React + FastAPI + MongoDB stacken készült (a felhasználó jóváhagyta). A `workmatehu.sql` helyett `scripts/export_db.sh` és `scripts/import_db.sh` biztosítja a hordozható adatbázis-mentést; a teljes telepítési és éles üzemeltetési leírás a `README.md`-ben.

## Architektúra
- Backend: FastAPI + MongoDB (motor), JWT auth (bcrypt), generikus `crud()` **kötelező `user_id` szűréssel**, reportlab PDF (DejaVu font + feltöltött logó), `services.py` (Emergent object storage + Resend e-mail, retry-vel).
- Frontend: React + react-router + TanStack Query + Tailwind. `Gate` (publikus + védett route-ok), `Shell` (fix sidebar 12 menüponttal, globális keresés, téma váltó), `PublicShell` + `PublicFooter`, `Fields` UI primitívek.
- Design: Outfit + Plus Jakarta Sans, 20px radius kártyák, cián #06b6d4 primary, világos + sötét téma, mobil optimalizálás.

## Elkészült
### 1. fázis – prémium UI alap
Design rendszer, fix sidebar, dark/light mode, mobil nézet. Dashboard, Ügyfelek, Munkák (lista + kanban), Ajánlatok (tételes + PDF), Munkanapló, Dokumentumok, Céges profil.

### 2. fázis – többfelhasználós SaaS + számlázás
Regisztráció / belépés / kijelentkezés (bcrypt + JWT), teljes felhasználónkénti adatszeparáció, onboarding, számlázási modul (lezárt munkából számla, PDF), ajánlatból munka, Riportok, Beállítások.

### 3. fázis – fájlok, e-mail, pénzügy
Object storage fájlfeltöltés (dokumentumok + céges logó a PDF-eken), ajánlat/számla e-mailben, elfelejtett jelszó e-mailes visszaállítással, bővített munka- és ajánlat státuszok, Pénzügy modul (bevétel/kiadás/profit).

### 4. fázis – production véglegesítés
- Ügyfél-történet nézet: egy ügyfélnél a munkák, ajánlatok, számlák, fizetések, dokumentumok + összegzés (számlázott, befolyt, kintlévőség, munkaórák)
- Naptár modul: hónapnézet munka határidőkkel, ajánlat érvényességekkel és fizetési határidőkkel, lejárt + közelgő határidők panel
- Globális keresés: fejléc kereső valós találatokkal 6 modulból, felhasználóra szűrve
- Prémium marketing login oldal (hero + előnylista + jogi linkek)
- Publikus oldalak: Kapcsolat (működő e-mail küldés), Adatkezelési tájékoztató, ÁSZF, Impresszum + footer automatikus évszámmal
- Dokumentáció (`README.md`: adatmodell, telepítés, env változók, API lista, VPS deploy), `backend/.env.example`, adatbázis export/import szkriptek
- Referenciális integritás: `customer_id` a payments és documents rekordokon is

## Tesztelés
5 iteráció. Backend 69/69 pytest zöld (`backend/tests/`), frontend Playwright kritikus flow-k zöldek, cross-user izoláció minden kollekcióra igazolva.

## 5. fázis – hordozhatóság és dokumentáció (export readiness)
- `docs/INSTALLATION.md`: részletes Windows telepítés (programverziók, MongoDB, venv, env változók, demo adatok, hibaelhárítás, VPS összefoglaló)
- `docs/DATABASE_SCHEMA.md`: minden kollekció mezőkkel, típusokkal, kapcsolatokkal, indexekkel
- `backend/.env.example` és `frontend/.env.example` magyarázatokkal minden változóhoz
- `backend/seed_db.py` CLI demo generátor (`--reset`, `--wipe`, egyedi email/jelszó/cégnév) – üres adatbázisból is
- Kód tisztítás: modellek külön `backend/models.py`-ba, a duplikált demo-adat logika közös `backend/seed_data.py`-ba (a REST `/api/seed` és a CLI ugyanazt használja, relatív dátumokkal); `server.py` 1070 → 795 sor; cache/ideiglenes fájlok törölve, `.gitignore` bővítve
- Visszakerült a `GET /api/` health endpoint; e-mail küldés retry logikával az átmeneti upstream hibákra
- `README.md`: bemutatás, modultábla, technológia, projektfelépítés, rövid telepítés, fejlesztési folyamat, biztonság, production checklist, tulajdonjog

## 6. fázis – egyszerűsítés és üzleti modell
- Munka státuszok 6 → **3**: Tervezett / Folyamatban / Elkészült; ajánlat státuszok 5 → **3**: Létrehozva / Elfogadva / Elutasítva (idempotens startup migráció a régi értékekre)
- Dashboard: személyes üdvözlés napszak szerint („Szép napot, Demo!") és 4 kártya – aktív munkák, ügyfelek, havi bevétel, következő határidők
- Ajánlat egyszerűsítés: anyagköltség + munkadíj + leírás mezők, tételek már nem kötelezők, opcionális kép/PDF csatolmány; a PDF automatikusan tartalmazza az Anyagköltség és Munkadíj sorokat
- Valós, esemény alapú értesítések (`GET /api/notifications`): lejárt/közelgő határidő, számlázható munka, elfogadott ajánlat, lejárt fizetési határidő – nincs állandó jelzés, üres állapotban „minden rendben" üzenet
- Előfizetési oldal (`/arak`): START 2 990 / PRO 5 990 / BUSINESS 9 990 Ft, 14 napos ingyenes próba, GYIK; link a footerben és a belépés oldalon
- Kódminőség: teszt-credentialök env változóból, `AuthContext` `useMemo` + `useCallback`, stabil React key-ek a tétellistákban, `useMemo` a kanban csoportosításhoz, e-mail retry gateway-kompatibilis időzítéssel
- Tesztelés: 80/80 backend pytest zöld, frontend kritikus flow-k 100%, 0 konzolhiba

## Backlog
- P1: kapcsolati üzenetek admin nézete + rate limit a publikus űrlapon, ügyfél-történet PDF export, MongoDB text index a kereséshez nagyobb adatmennyiségnél
- P2: AI asszisztens (`/api/ai/*`: ajánlat tétel generálás, munkaleírás, ügyfél válasz, árkalkuláció – az `EMERGENT_LLM_KEY` már elérhető), NAV online számla integráció, előfizetés/Stripe billing, szerződés és munkalap PDF sablonok

# WorkMate HU – exportált adatok

Ez a mappa a **demo fiók teljes adatállományát** tartalmazza olvasható JSON formátumban, hogy a projekt átvételekor ne csak a kód, hanem valós példaadat is a rendelkezésedre álljon.

| Fájl | Tartalom |
|---|---|
| `users.json` | a demo felhasználó (jelszó bcrypt hash-ként: `workmate123`) |
| `company.json` | céges profil |
| `customers.json` | 3 ügyfél |
| `jobs.json` | 4 munka |
| `quotes.json` | 2 ajánlat tételekkel |
| `invoices.json` | 2 számla tételekkel |
| `payments.json` | 3 pénzügyi tétel |
| `documents.json` | 3 dokumentum |
| `worklogs.json` | 3 munkanapló bejegyzés |

## Betöltés a saját MongoDB-be

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python import_export.py              # hiányzó rekordok beszúrása
python import_export.py --replace    # meglévő rekordok felülírása
```

Belépés az importált fiókkal: `demo@workmate.hu` / `workmate123`

## Alternatíva: friss demo adatok generálása

Ha nincs szükséged pontosan ezekre az adatokra, generálhatsz újat (a dátumok a mai naphoz igazodnak):

```powershell
python seed_db.py            # vagy: python seed_db.py --reset
```

## Teljes adatbázis mentés

Éles használat közben a teljes adatbázisról a `scripts/export_db.sh` készít BSON + JSON mentést, amelyet a `scripts/import_db.sh` tölt vissza.

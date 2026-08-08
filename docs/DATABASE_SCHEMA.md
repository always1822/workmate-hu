# WorkMate HU – Adatbázis séma (MongoDB)

Az adatbázis MongoDB, a kollekciók sémamentesek, de az alkalmazás Pydantic modellekkel kényszeríti ki az alábbi szerkezetet (`backend/server.py`).

## Alapelvek

1. **Azonosítók**: minden rekord `id` mezője UUID4 string (nem MongoDB ObjectId), így az adat exportálható és hordozható marad.
2. **Tulajdonos**: minden üzleti rekord tartalmaz `user_id` mezőt, és **minden** lekérdezés erre szűr → egy felhasználó soha nem látja más adatait.
3. **Dátumok**: ISO formátumú stringek (`YYYY-MM-DD` naptári dátumnál, `YYYY-MM-DDTHH:MM:SS+00:00` időbélyegnél, UTC).
4. **Pénzösszegek**: `float`, forintban, nettó egységáron tárolva; a bruttó számítás az `items[]` és a `vat_rate` alapján történik.

## Kapcsolatok

```
users (1) ──< company            (1 céges profil / felhasználó)
users (1) ──< customers ──< jobs ──< worklogs
                  │          │
                  │          └──< invoices
                  ├──< quotes ──(job_id)──> jobs
                  ├──< payments
                  └──< documents
users (1) ──< password_reset_tokens
contacts  (nyilvános, felhasználóhoz nem kötött)
```

- `jobs.customer_id` → `customers.id`
- `quotes.customer_id` → `customers.id`, `quotes.job_id` → `jobs.id` (ajánlatból létrehozott munka)
- `jobs.quote_id` → `quotes.id` (visszamutató)
- `invoices.customer_id` → `customers.id`, `invoices.job_id` → `jobs.id`
- `worklogs.job_id` → `jobs.id`
- `payments.customer_id` / `documents.customer_id` → `customers.id`

A MongoDB nem kényszerít ki idegen kulcsot; az alkalmazás az összerendelést a lekérdezésekben végzi (`GET /api/customers/{id}/history`).

---

## `users` – felhasználói fiókok

| Mező | Típus | Leírás |
|---|---|---|
| `id` | string (UUID4) | elsődleges azonosító |
| `name` | string | a vállalkozó neve |
| `email` | string | egyedi, kisbetűsítve tárolva – belépési azonosító |
| `company_name` | string | regisztrációkor megadott cégnév |
| `password_hash` | string | bcrypt hash (soha nem kerül vissza API válaszban) |
| `seeded` | bool | demo adatok betöltve-e (atomikus flag) |
| `created_at` | string (ISO) | létrehozás időpontja |

**Index:** `email` (unique)

---

## `company` – céges profil (1 / felhasználó)

| Mező | Típus | Leírás |
|---|---|---|
| `user_id` | string | tulajdonos |
| `name` | string | cégnév (PDF fejlécben) |
| `contact_name` | string | kapcsolattartó |
| `tax_number` | string | adószám |
| `reg_number` | string | cégjegyzékszám |
| `address` | string | székhely |
| `email`, `phone`, `website` | string | elérhetőségek |
| `bank_account` | string | bankszámlaszám (számlán) |
| `logo_path` | string | feltöltött logó tárolási útvonala (object storage) |
| `logo_url` | string | külső logó URL (alternatíva) |
| `quote_footer` | string | PDF lábjegyzet |
| `onboarded` | bool | befejezte-e a kezdeti beállítást |

---

## `customers` – ügyfelek

| Mező | Típus | Leírás |
|---|---|---|
| `id` | string | azonosító |
| `user_id` | string | tulajdonos |
| `name` | string | cég- vagy ügyfélnév (kötelező) |
| `contact` | string | kapcsolattartó |
| `email`, `phone`, `address` | string | elérhetőségek |
| `tax_number` | string | adószám |
| `notes` | string | megjegyzés |
| `created_at` | string (ISO) | rögzítés ideje |

**Index:** `user_id`

---

## `jobs` – munkák

| Mező | Típus | Leírás |
|---|---|---|
| `id`, `user_id`, `created_at` | string | alapmezők |
| `title` | string | munka megnevezése (kötelező) |
| `customer_id` | string | → `customers.id` |
| `customer_name` | string | denormalizált ügyfélnév (listákhoz) |
| `status` | string | `erdeklodo` \| `ajanlat_elkuldve` \| `elfogadva` \| `folyamatban` \| `kesz` \| `lezarva` |
| `priority` | string | `alacsony` \| `kozepes` \| `magas` |
| `value` | float | munka értéke (Ft, bruttó) |
| `deadline` | string (`YYYY-MM-DD`) | határidő – a naptárban jelenik meg |
| `description` | string | leírás |
| `quote_id` | string | → `quotes.id`, ha ajánlatból jött létre |

**Index:** `user_id`

---

## `quotes` – ajánlatok

| Mező | Típus | Leírás |
|---|---|---|
| `id`, `user_id`, `created_at` | string | alapmezők |
| `number` | string | ajánlatszám (pl. `AJ-2026-001`) |
| `customer_id` / `customer_name` | string | ügyfél |
| `title` | string | megnevezés |
| `status` | string | `piszkozat` \| `elkuldve` \| `elfogadva` \| `munka_letrehozva` \| `elutasitva` |
| `valid_until` | string (`YYYY-MM-DD`) | érvényesség – naptárban |
| `vat_rate` | float | ÁFA % (alap: 27) |
| `notes` | string | megjegyzés (PDF-en is) |
| `items` | array&lt;LineItem&gt; | tételek |
| `job_id` | string | → `jobs.id`, ha munka készült belőle |

**`LineItem` altípus** (ajánlat és számla tételek):

| Mező | Típus | Leírás |
|---|---|---|
| `description` | string | tétel megnevezése |
| `quantity` | float | mennyiség |
| `unit` | string | mértékegység (`db`, `m2`, `óra`, `alk`…) |
| `unit_price` | float | nettó egységár (Ft) |

**Index:** `user_id`

---

## `invoices` – számlák

| Mező | Típus | Leírás |
|---|---|---|
| `id`, `user_id`, `created_at` | string | alapmezők |
| `number` | string | számlaszám (pl. `SZ-2026-001`) |
| `customer_id` / `customer_name` | string | vevő |
| `job_id` | string | → `jobs.id` (melyik munkából készült) |
| `title` | string | megnevezés |
| `status` | string | `vazlat` \| `kiallitva` \| `fizetve` |
| `issue_date` | string (`YYYY-MM-DD`) | kelt – a bevételi riportok ez alapján számolnak |
| `due_date` | string (`YYYY-MM-DD`) | fizetési határidő – naptárban |
| `payment_method` | string | `atutalas` \| `keszpenz` |
| `vat_rate` | float | ÁFA % |
| `notes` | string | megjegyzés |
| `items` | array&lt;LineItem&gt; | tételek |

**Index:** `user_id`

> A bevétel a `kiallitva` és `fizetve` státuszú számlák bruttó összegéből számolódik.

---

## `payments` – bevétel / kiadás tételek

| Mező | Típus | Leírás |
|---|---|---|
| `id`, `user_id`, `created_at` | string | alapmezők |
| `kind` | string | `bevetel` \| `kiadas` |
| `title` | string | megnevezés |
| `category` | string | `anyag` \| `uzemanyag` \| `berlet` \| `alvallalkozo` \| `szolgaltatas` \| `ber` \| `egyeb` |
| `amount` | float | összeg (Ft) |
| `date` | string (`YYYY-MM-DD`) | teljesítés dátuma |
| `customer_id` / `customer_name` | string | opcionális ügyfél-kapcsolat |
| `job_id`, `invoice_id` | string | opcionális kapcsolatok |
| `notes` | string | megjegyzés |

**Index:** `user_id`

---

## `documents` – dokumentumok

| Mező | Típus | Leírás |
|---|---|---|
| `id`, `user_id`, `created_at` | string | alapmezők |
| `name` | string | fájlnév |
| `category` | string | `szerzodes` \| `szamla` \| `igazolas` \| `terv` \| `egyeb` |
| `customer_id` / `customer_name` | string | kapcsolt ügyfél |
| `job_id` | string | kapcsolt munka |
| `size_kb` | float | méret |
| `storage_path` | string | object storage útvonal (feltöltött fájlnál) |
| `content_type` | string | MIME típus |
| `url` | string | külső link (feltöltés nélküli rögzítésnél) |

---

## `worklogs` – munkanapló

| Mező | Típus | Leírás |
|---|---|---|
| `id`, `user_id`, `created_at` | string | alapmezők |
| `date` | string (`YYYY-MM-DD`) | munkanap |
| `job_id` / `job_title` | string | → `jobs.id` + denormalizált cím |
| `worker` | string | dolgozó neve |
| `hours` | float | ledolgozott óra |
| `description` | string | elvégzett munka |

---

## `contacts` – nyilvános kapcsolati üzenetek

| Mező | Típus | Leírás |
|---|---|---|
| `id` | string | azonosító |
| `name`, `email`, `subject`, `message` | string | az űrlap mezői |
| `phone` | string | előkészítve későbbi bővítéshez |
| `handled` | bool | feldolgozva-e |
| `created_at` | string (ISO) | beérkezés ideje |

> Ez az egyetlen kollekció, amely nem kötődik felhasználóhoz (a bejelentkezés nélküli Kapcsolat oldalról érkezik).

---

## `password_reset_tokens` – jelszó-visszaállítás

| Mező | Típus | Leírás |
|---|---|---|
| `token` | string | véletlen, URL-biztos token |
| `user_id` | string | → `users.id` |
| `expires_at` | date | lejárat (1 óra) |
| `used` | bool | egyszer használható |

**Index:** `expires_at` (TTL, 24 óra után automatikus takarítás)

---

## Indexek összefoglalása

| Kollekció | Index | Típus |
|---|---|---|
| `users` | `email` | unique |
| `customers`, `jobs`, `quotes`, `invoices`, `payments` | `user_id` | egyszerű |
| `password_reset_tokens` | `expires_at` | TTL (86400 s) |

Az indexeket a backend indulásakor automatikusan létrehozza (`@app.on_event("startup")`), külön migráció nem szükséges.

## Adatmigráció

Induláskor lefut egy idempotens migráció, amely a korábbi státuszértékeket az aktuális munkafolyamatra írja át
(`jobs`: `uj`→`erdeklodo`, `szamlazva`→`lezarva`; `quotes`: `vazlat`→`piszkozat`, munkával rendelkező `elfogadva`→`munka_letrehozva`).

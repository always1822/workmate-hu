import { PublicShell } from "../components/PublicShell";

const CONTENT = {
  adatkezeles: {
    title: "Adatkezelési tájékoztató",
    intro: "A WorkMate HU a felhasználók adatait a GDPR elveinek megfelelően kezeli. Ez a tájékoztató minta jellegű, élesítés előtt egészítsd ki a saját cégadataiddal.",
    sections: [
      ["Kezelt adatok", "Regisztrációnál: név, e-mail cím, cégnév, jelszó (kizárólag titkosított formában, bcrypt algoritmussal). A rendszer használata során a felhasználó által rögzített ügyfél-, munka-, ajánlat-, számla-, dokumentum- és pénzügyi adatok."],
      ["Az adatkezelés célja", "A szolgáltatás nyújtása: vállalkozói adminisztráció, ajánlat- és számlakészítés, dokumentumtárolás, bevételi kimutatások."],
      ["Adatok elkülönítése", "Minden felhasználó kizárólag a saját adatait látja. A rendszer minden adatbázis-lekérdezést a bejelentkezett felhasználóra szűkít."],
      ["Adatfeldolgozók", "E-mail kiküldés és fájltárolás céljából a rendszer külső szolgáltatókat vesz igénybe. Élesítés előtt sorold fel a tényleges szolgáltatókat."],
      ["Megőrzési idő", "Az adatokat a fiók fennállásáig kezeljük. Törlési kérelem esetén az adatok véglegesen törlésre kerülnek."],
      ["Érintetti jogok", "Tájékoztatás, hozzáférés, helyesbítés, törlés, adatkezelés korlátozása, adathordozhatóság, tiltakozás. Kérésed a kapcsolati űrlapon jelezheted."],
    ],
  },
  aszf: {
    title: "Általános Szerződési Feltételek",
    intro: "Az alábbi feltételek a WorkMate HU szolgáltatás használatára vonatkoznak. Minta tartalom – élesítés előtt jogi ellenőrzés javasolt.",
    sections: [
      ["A szolgáltatás tárgya", "A WorkMate HU felhőalapú vállalkozáskezelő szoftver, amely ügyfél-, munka-, ajánlat-, számla- és pénzügyi nyilvántartást biztosít."],
      ["Regisztráció és fiók", "A szolgáltatás használatához regisztráció szükséges. A felhasználó felel a megadott adatok helyességéért és a jelszava biztonságáért."],
      ["Díjazás", "A csomagok és díjak a mindenkori árlistában szerepelnek. Az előfizetés a megjelölt időszakra szól."],
      ["A felhasználó felelőssége", "A rendszerben rögzített adatok tartalmáért, valamint a kiállított dokumentumok jogszabályi megfelelőségéért a felhasználó felel."],
      ["Felelősség korlátozása", "A szolgáltató törekszik a folyamatos, hibamentes működésre, de nem vállal felelősséget a közvetett károkért."],
      ["Felmondás", "A felhasználó a fiókját bármikor megszüntetheti. Súlyos szerződésszegés esetén a szolgáltató jogosult a fiók felfüggesztésére."],
    ],
  },
  impresszum: {
    title: "Impresszum",
    intro: "Az üzemeltető adatai. Élesítés előtt töltsd ki a saját cégadataiddal.",
    sections: [
      ["Szolgáltató neve", "— (töltsd ki)"],
      ["Székhely", "— (töltsd ki)"],
      ["Adószám", "— (töltsd ki)"],
      ["Cégjegyzékszám", "— (töltsd ki)"],
      ["E-mail", "— (töltsd ki)"],
      ["Tárhelyszolgáltató", "— (töltsd ki)"],
    ],
  },
};

export default function Legal({ page }) {
  const c = CONTENT[page] || CONTENT.impresszum;
  return (
    <PublicShell>
      <div data-testid={`legal-${page}-page`}>
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">{c.title}</h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground">{c.intro}</p>
        <div className="mt-10 space-y-5">
          {c.sections.map(([title, body], i) => (
            <div key={title} className="wm-card p-6 sm:p-7">
              <div className="wm-label">{String(i + 1).padStart(2, "0")}</div>
              <h2 className="mt-2 font-display text-xl font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </PublicShell>
  );
}

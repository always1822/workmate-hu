import { Link } from "react-router-dom";
import { Check, Sparkles, ArrowRight } from "lucide-react";
import { PublicShell } from "../components/PublicShell";
import { Button } from "../components/Fields";

const PLANS = [
  {
    id: "start", name: "START", price: "2 990", tag: "Egyéni vállalkozóknak",
    features: ["Ügyfélkezelés", "Munkák nyilvántartása", "Ajánlatok készítése", "PDF ajánlat és számla", "Munkanapló"],
  },
  {
    id: "pro", name: "PRO", price: "5 990", tag: "Legnépszerűbb", highlight: true,
    features: ["Minden START funkció", "Bevételi és profit riportok", "Extra PDF beállítások", "E-mail küldés ügyfeleknek", "Naptár és határidő figyelés", "Pénzügyi kimutatások"],
  },
  {
    id: "business", name: "BUSINESS", price: "9 990", tag: "Kis csapatoknak",
    features: ["Minden PRO funkció", "Csapat használat", "Több felhasználó", "Extra jogosultságok", "Kiemelt támogatás"],
  },
];

export default function Pricing() {
  return (
    <PublicShell>
      <div data-testid="pricing-page">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-primary">
            <Sparkles className="h-3.5 w-3.5" /> 14 NAP INGYENES PRÓBA
          </div>
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">Kevesebb adminisztráció.<br />Több idő a munkára.</h1>
          <p className="mt-4 text-base text-muted-foreground">
            Válaszd ki a vállalkozásodhoz illő csomagot. Az első 14 nap minden funkcióval ingyenes, bankkártya nélkül.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.id}
              data-testid={`plan-${p.id}`}
              className={`wm-card relative flex flex-col p-7 transition-transform duration-200 hover:-translate-y-1 ${p.highlight ? "border-primary/50 ring-1 ring-primary/20" : ""}`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground">
                  {p.tag}
                </span>
              )}
              <div className="wm-label">{p.highlight ? "Ajánlott" : p.tag}</div>
              <div className="mt-2 font-display text-2xl font-semibold">{p.name}</div>
              <div className="mt-4 flex items-end gap-1">
                <span className="font-display text-4xl font-semibold">{p.price}</span>
                <span className="pb-1 text-sm text-muted-foreground">Ft / hó</span>
              </div>
              <ul className="mt-7 flex-1 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <Link to="/belepes" className="mt-8">
                <Button variant={p.highlight ? "primary" : "secondary"} className="w-full" data-testid={`plan-cta-${p.id}`}>
                  Próba indítása <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          ))}
        </div>

        <div className="wm-card mt-10 p-7">
          <h2 className="font-display text-xl font-semibold">Gyakori kérdések</h2>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {[
              ["Kell bankkártya a próbához?", "Nem. A 14 napos próba alatt minden funkciót kipróbálhatsz regisztráció után, fizetési adatok megadása nélkül."],
              ["Váltahatok csomagot később?", "Igen, bármikor lépehetsz feljebb vagy lejjebb, az elszámolás időarányos."],
              ["Az adataim biztonságban vannak?", "Minden vállalkozó saját, elkülönített környezetet kap – más felhasználó nem látja az adataidat."],
              ["Mi történik a próba után?", "Ha nem választasz csomagot, az adataid megmaradnak, csak írási műveletek szűnnek meg – bármikor folytathatod."],
            ].map(([q, a]) => (
              <div key={q}>
                <div className="text-sm font-semibold">{q}</div>
                <p className="mt-1.5 text-sm text-muted-foreground">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PublicShell>
  );
}

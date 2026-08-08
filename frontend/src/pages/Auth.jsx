import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Hammer, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api, apiErr } from "../lib/api";
import { Button, Field, Input } from "../components/Fields";

const PERKS = [
  "Ügyfelek, munkák, ajánlatok és pénzügyek egyetlen rendszerben",
  "PDF ajánlat és számla pár kattintással, e-mailben is küldhető",
  "Bevételi és profit riportok automatikusan, Excel nélkül",
  "Határidők naptárban – semmiről nem feledkezel meg",
];

export default function Auth() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", company_name: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        await api.post("/auth/forgot-password", { email: form.email });
        toast.success("Ha létezik a fiók, elküldtük a visszaállító linket e-mailben");
        setMode("login");
      } else if (mode === "login") {
        await login({ email: form.email, password: form.password });
        toast.success("Sikeres belépés");
      } else {
        await register(form);
        toast.success("Sikeres belépés");
      }
    } catch (err) {
      toast.error(apiErr(err, "Sikertelen művelet"));
    } finally {
      setBusy(false);
    }
  };

  const titles = { login: "Belépés", register: "Regisztráció", forgot: "Elfelejtett jelszó" };
  const subtitles = {
    login: "Üdv újra! Add meg az adataidat.",
    register: "Készítsd el a saját vállalkozói környezetedet.",
    forgot: "Add meg az email címed, és küldünk egy visszaállító linket.",
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2" data-testid="auth-page">
      <div className="relative hidden flex-col justify-between bg-[#083344] p-14 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary"><Hammer className="h-5 w-5" /></div>
          <div>
            <div className="font-display text-lg font-semibold">WorkMate</div>
            <div className="text-[11px] tracking-[0.16em] text-cyan-200/70">HU · BUSINESS OS</div>
          </div>
        </div>
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3.5 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-cyan-100">
            MAGYAR VÁLLALKOZÓKNAK
          </div>
          <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">Vezesd vállalkozásodat<br />egyszerűbben.</h1>
          <p className="mt-4 max-w-md text-sm text-cyan-100/70">
            A WorkMate HU segít egyszerűen kezelni az ügyfeleidet, munkáidat, ajánlataidat és számláidat – egyetlen átlátható rendszerben. 14 napig ingyen kipróbálható.
          </p>
          <ul className="mt-8 space-y-3">
            {PERKS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm text-cyan-50/90">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-cyan-100/40">
          <span>© {new Date().getFullYear()} WorkMate HU</span>
          <Link to="/arak" className="transition-colors hover:text-cyan-100">Árak</Link>
          <Link to="/kapcsolat" className="transition-colors hover:text-cyan-100">Kapcsolat</Link>
          <Link to="/adatkezeles" className="transition-colors hover:text-cyan-100">Adatkezelés</Link>
          <Link to="/aszf" className="transition-colors hover:text-cyan-100">ÁSZF</Link>
          <Link to="/impresszum" className="transition-colors hover:text-cyan-100">Impresszum</Link>
        </div>
      </div>

      <div className="flex items-center justify-center bg-background p-6 sm:p-10">
        <div className="w-full max-w-md">
          <h2 className="font-display text-3xl font-semibold">{titles[mode]}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{subtitles[mode]}</p>

          <form className="mt-8 space-y-5" onSubmit={submit}>
            {mode === "register" && (
              <>
                <Field label="Név"><Input required value={form.name} onChange={set("name")} data-testid="auth-name-input" /></Field>
                <Field label="Cégnév"><Input required value={form.company_name} onChange={set("company_name")} data-testid="auth-company-input" /></Field>
              </>
            )}
            <Field label="Email cím"><Input required type="email" value={form.email} onChange={set("email")} data-testid="auth-email-input" /></Field>
            {mode !== "forgot" && (
              <Field label="Jelszó"><Input required type="password" value={form.password} onChange={set("password")} data-testid="auth-password-input" /></Field>
            )}
            <Button type="submit" className="w-full" disabled={busy} data-testid="auth-submit-btn">
              {mode === "login" ? "Belépés" : mode === "register" ? "Fiók létrehozása" : "Visszaállító link kérése"} <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <div className="mt-6 space-y-2 text-center">
            <button
              className="w-full text-sm text-muted-foreground transition-colors hover:text-primary"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              data-testid="auth-toggle-btn"
            >
              {mode === "login" ? "Még nincs fiókod? Regisztrálj" : "Van már fiókod? Jelentkezz be"}
            </button>
            {mode !== "forgot" && (
              <button className="w-full text-sm text-muted-foreground transition-colors hover:text-primary"
                onClick={() => setMode("forgot")} data-testid="auth-forgot-btn">
                Elfelejtettem a jelszavamat
              </button>
            )}
          </div>

          <div className="mt-8 rounded-2xl border border-border bg-card p-5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Demo fiók:</span> demo@workmate.hu / workmate123
            <div className="mt-2">Csomagok és árak: <Link to="/arak" className="font-semibold text-primary hover:underline" data-testid="auth-pricing-link">megnézem</Link></div>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground lg:hidden">
            <span>© {new Date().getFullYear()} WorkMate HU</span>
            <Link to="/arak" className="hover:text-primary">Árak</Link>
            <Link to="/kapcsolat" className="hover:text-primary">Kapcsolat</Link>
            <Link to="/adatkezeles" className="hover:text-primary">Adatkezelés</Link>
            <Link to="/aszf" className="hover:text-primary">ÁSZF</Link>
            <Link to="/impresszum" className="hover:text-primary">Impresszum</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

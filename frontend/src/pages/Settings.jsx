import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Moon, Sun, LogOut, User, Shield, Palette, Building2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader } from "../components/Shell";
import { Button, Field, Input } from "../components/Fields";

export default function Settings() {
  const { user, logout } = useAuth();
  const [dark, setDark] = useState(() => localStorage.getItem("wm-theme") === "dark");

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("wm-theme", next ? "dark" : "light");
    toast.success(next ? "Sötét téma bekapcsolva" : "Világos téma bekapcsolva");
  };

  return (
    <div data-testid="settings-page">
      <PageHeader title="Beállítások" subtitle="Fiók, megjelenés és biztonság" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card data-testid="account-card">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><User className="h-5 w-5" /></div>
            <h2 className="font-display text-xl font-semibold">Fiók</h2>
          </div>
          <div className="space-y-5">
            <Field label="Név"><Input value={user?.name || ""} readOnly data-testid="settings-name" /></Field>
            <Field label="Email cím"><Input value={user?.email || ""} readOnly data-testid="settings-email" /></Field>
            <Field label="Cégnév"><Input value={user?.company_name || ""} readOnly data-testid="settings-company" /></Field>
          </div>
          <Link to="/ceges-profil" className="mt-5 inline-flex" data-testid="settings-company-link">
            <Button variant="secondary"><Building2 className="h-4 w-4" /> Céges profil szerkesztése</Button>
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">A céges adatok (név, adószám, bankszámla, logo) automatikusan megjelennek a számlákon és az ajánlatokon.</p>
        </Card>

        <div className="space-y-5">
          <Card data-testid="appearance-card">
            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><Palette className="h-5 w-5" /></div>
              <h2 className="font-display text-xl font-semibold">Megjelenés</h2>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-border p-4">
              <div>
                <div className="text-sm font-semibold">Sötét mód</div>
                <div className="text-xs text-muted-foreground">Kímélje a szemed esti munkánál</div>
              </div>
              <Button variant="secondary" onClick={toggle} data-testid="settings-theme-btn">
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} {dark ? "Világos" : "Sötét"}
              </Button>
            </div>
          </Card>

          <Card data-testid="security-card">
            <div className="mb-6 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><Shield className="h-5 w-5" /></div>
              <h2 className="font-display text-xl font-semibold">Biztonság</h2>
            </div>
            <p className="text-sm text-muted-foreground">Az adataid kizárólag a saját fiókodhoz tartoznak, más vállalkozó nem látja őket.</p>
            <Button variant="secondary" className="mt-5 text-destructive" onClick={logout} data-testid="settings-logout-btn">
              <LogOut className="h-4 w-4" /> Kijelentkezés
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

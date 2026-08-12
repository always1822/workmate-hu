import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users, Hammer, FileText, Wallet, ArrowUpRight, Plus, TrendingUp, Sparkles, Receipt, CalendarRange,
} from "lucide-react";
import { api, fmtHuf, fmtDate, JOB_STATUS, QUOTE_STATUS, INVOICE_STATUS } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Card, PageHeader, Badge, Empty } from "../components/Shell";
import { Button } from "../components/Fields";

const StatCard = ({ icon: Icon, label, value, sub, delay, testid }) => (
  <Card className="wm-rise group transition-transform duration-200 hover:-translate-y-[3px]" style={{ animationDelay: `${delay}ms` }} data-testid={testid}>
    <div className="flex items-start justify-between">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
    <div className="mt-6">
      <div className="wm-label">{label}</div>
      <div className="mt-2 font-display text-3xl font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  </Card>
);

// „Mit kell most csinálnom?” – a fő folyamat lépései, közvetlen művelettel
const STEPS = (d) => [
  { to: "/ajanlatok", label: "Elfogadásra váró ajánlatok", icon: FileText, count: d.open_quotes ?? 0, desc: "Elfogadáskor a munka automatikusan létrejön" },
  { to: "/szamlak", label: "Számlázásra váró munkák", icon: Receipt, count: d.to_invoice ?? 0, desc: "Kész munka – számla 1 kattintással" },
  { to: "/szamlak", label: "Kifizetetlen számlák", icon: Wallet, count: d.unpaid_invoices ?? 0, desc: `Összesen ${fmtHuf(d.unpaid_value)}` },
  { to: "/munkak", label: "Folyamatban lévő munkák", icon: Hammer, count: d.active_jobs ?? 0, desc: "Kövesd nyomon a határidőket" },
];

const greetingFor = (name) => {
  const h = new Date().getHours();
  const part = h < 10 ? "Jó reggelt" : h < 18 ? "Szép napot" : "Jó estét";
  return `${part}, ${(name || "Vállalkozó").trim().split(" ")[0]}!`;
};

export default function Dashboard() {
  const qc = useQueryClient();
  const seedRef = useRef(false);
  const { user } = useAuth();
  const greeting = greetingFor(user?.name);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get("/dashboard")).data,
  });

  useEffect(() => {
    if (seedRef.current) return;
    seedRef.current = true;
    api.post("/seed").then((r) => {
      if (r.data.seeded) qc.invalidateQueries();
    });
  }, [qc]);

  const { data: company } = useQuery({ queryKey: ["company"], queryFn: async () => (await api.get("/company")).data });
  const { data: cal } = useQuery({ queryKey: ["calendar"], queryFn: async () => (await api.get("/calendar")).data });
  const todayIso = new Date().toISOString().slice(0, 10);
  const deadlines = (cal?.events || []).filter((e) => String(e.date).slice(0, 10) >= todayIso).slice(0, 5);
  const d = data || {};
  const statuses = d.jobs_by_status || {};
  const totalJobs = Object.values(statuses).reduce((a, b) => a + b, 0) || 1;

  return (
    <div data-testid="dashboard-page">
      <PageHeader title={greeting} subtitle="Íme a vállalkozásod mai állapota – kevesebb adminisztráció, több idő a munkára.">
        <Link to="/riportok"><Button variant="secondary" data-testid="dashboard-report-btn"><TrendingUp className="h-4 w-4" /> Riport</Button></Link>
        <Link to="/ajanlatok"><Button data-testid="dashboard-new-quote-btn"><Plus className="h-4 w-4" /> Új ajánlat</Button></Link>
      </PageHeader>

      {company && !company.onboarded && (
        <Link to="/ceges-profil" className="wm-card mb-6 flex flex-wrap items-center gap-4 border-primary/40 bg-primary/5 p-6 transition-colors hover:bg-primary/10" data-testid="onboarding-banner">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground"><Sparkles className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg font-semibold">Első lépés: állítsd be a céges profilt</div>
            <div className="text-sm text-muted-foreground">Ezek az adatok automatikusan megjelennek az ajánlat és számla PDF-eken.</div>
          </div>
          <ArrowUpRight className="h-5 w-5 text-primary" />
        </Link>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Hammer} label="Aktív munkák" value={isLoading ? "—" : d.active_jobs ?? 0} sub={`Folyamatban: ${fmtHuf(d.pipeline)}`} delay={0} testid="stat-jobs" />
        <StatCard icon={Users} label="Ügyfelek" value={isLoading ? "—" : d.customers ?? 0} sub={`${d.open_quotes ?? 0} nyitott ajánlat`} delay={70} testid="stat-customers" />
        <StatCard icon={Wallet} label="Havi bevétel" value={isLoading ? "—" : fmtHuf(d.monthly_revenue)} sub={`Éves: ${fmtHuf(d.yearly_revenue)}`} delay={140} testid="stat-monthly-revenue" />
        <StatCard icon={CalendarRange} label="Következő határidők" value={isLoading ? "—" : (deadlines.length || 0)} sub={deadlines[0] ? `Legközelebbi: ${fmtDate(deadlines[0].date)}` : "Nincs közelgő határidő"} delay={210} testid="stat-deadlines" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card className="wm-rise lg:col-span-8" style={{ animationDelay: "260ms" }} data-testid="recent-jobs-card">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold">Legutóbbi munkák</h2>
              <p className="mt-1 text-sm text-muted-foreground">A legfrissebb projektek állapota</p>
            </div>
            <Link to="/munkak" className="text-sm font-semibold text-primary hover:underline" data-testid="all-jobs-link">Összes</Link>
          </div>
          {(d.recent_jobs || []).length === 0 ? (
            <Empty text="Még nincs rögzített munka." icon={Hammer} />
          ) : (
            <div className="divide-y divide-border">
              {(d.recent_jobs || []).map((j) => (
                <div key={j.id} className="flex items-center gap-4 py-4 transition-colors hover:bg-accent/50">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-muted-foreground">
                    <Hammer className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{j.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{j.customer_name || "—"} · határidő: {fmtDate(j.deadline)}</div>
                  </div>
                  <div className="hidden text-right sm:block">
                    <div className="font-display font-semibold">{fmtHuf(j.value)}</div>
                  </div>
                  <Badge cls={(JOB_STATUS[j.status] || {}).cls}>{(JOB_STATUS[j.status] || {}).label || j.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="wm-rise lg:col-span-4" style={{ animationDelay: "320ms" }} data-testid="next-steps-card">
          <div className="mb-6 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-display text-xl font-semibold">Következő lépések</h2>
          </div>
          <div className="space-y-3">
            {STEPS(d).map(({ to, label, desc, count, icon: Icon }) => (
              <Link
                key={label}
                to={to}
                data-testid={`step-${to.slice(1)}`}
                className="group flex items-center gap-4 rounded-2xl border border-border p-4 transition-all duration-200 hover:-translate-y-[2px] hover:border-primary/40 hover:bg-accent/50"
              >
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{label}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${count > 0 ? "bg-primary/10 text-primary" : "bg-accent text-muted-foreground"}`}>{count}</span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-5 border-t border-border pt-4">
            <Link to="/penzugy" className="text-sm font-semibold text-primary hover:underline" data-testid="dash-finance-link">Pénzügy</Link>
            <Link to="/riportok" className="text-sm font-semibold text-primary hover:underline" data-testid="dash-reports-link">Riportok</Link>
          </div>
        </Card>

        <Card className="wm-rise lg:col-span-5" style={{ animationDelay: "380ms" }} data-testid="pipeline-card">
          <h2 className="font-display text-xl font-semibold">Munka pipeline</h2>
          <div className="mt-6 space-y-5">
            {Object.entries(JOB_STATUS).map(([k, v]) => (
              <div key={k}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">{v.label}</span>
                  <span className="text-muted-foreground">{statuses[k] || 0}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-accent">
                  <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${((statuses[k] || 0) / totalJobs) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="wm-rise lg:col-span-7" style={{ animationDelay: "500ms" }} data-testid="recent-invoices-card">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Friss számlák</h2>
            <Link to="/szamlak" className="text-sm font-semibold text-primary hover:underline" data-testid="all-invoices-link">Összes</Link>
          </div>
          {(d.recent_invoices || []).length === 0 ? (
            <Empty text="Még nincs számla." icon={Receipt} />
          ) : (
            <div className="divide-y divide-border">
              {(d.recent_invoices || []).map((inv) => (
                <div key={inv.id} className="flex items-center gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{inv.title || inv.number}</div>
                    <div className="truncate text-xs text-muted-foreground">{inv.customer_name || "—"} · {inv.number} · {fmtDate(inv.issue_date)}</div>
                  </div>
                  <div className="font-display font-semibold">{fmtHuf(inv.total)}</div>
                  <Badge cls={(INVOICE_STATUS[inv.status] || {}).cls}>{(INVOICE_STATUS[inv.status] || {}).label || inv.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="wm-rise lg:col-span-12" style={{ animationDelay: "440ms" }} data-testid="recent-quotes-card">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Friss ajánlatok</h2>
            <Link to="/ajanlatok" className="text-sm font-semibold text-primary hover:underline">Összes</Link>
          </div>
          {(d.recent_quotes || []).length === 0 ? (
            <Empty text="Még nincs ajánlat." icon={FileText} />
          ) : (
            <div className="divide-y divide-border">
              {(d.recent_quotes || []).map((q) => (
                <div key={q.id} className="flex items-center gap-4 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{q.title || q.number}</div>
                    <div className="truncate text-xs text-muted-foreground">{q.customer_name || "—"} · {q.number}</div>
                  </div>
                  <div className="font-display font-semibold">{fmtHuf(q.total)}</div>
                  <Badge cls={(QUOTE_STATUS[q.status] || {}).cls}>{(QUOTE_STATUS[q.status] || {}).label || q.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

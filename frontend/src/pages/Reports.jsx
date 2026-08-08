import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Wallet, Receipt, CheckCircle2, Percent } from "lucide-react";import { api, fmtHuf } from "../lib/api";
import { Card, PageHeader, Empty } from "../components/Shell";

const MONTHS = ["Jan", "Feb", "Már", "Ápr", "Máj", "Jún", "Júl", "Aug", "Sze", "Okt", "Nov", "Dec"];

const Stat = ({ icon: Icon, label, value, testid }) => (
  <Card data-testid={testid}>
    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
    <div className="mt-5 wm-label">{label}</div>
    <div className="mt-2 font-display text-2xl font-semibold">{value}</div>
  </Card>
);

export default function Reports() {
  const { data } = useQuery({ queryKey: ["reports"], queryFn: async () => (await api.get("/reports")).data });
  const d = data || { months: [], top_customers: [] };
  const max = Math.max(1, ...d.months.map((m) => Math.max(m.revenue, m.expense || 0)));

  return (
    <div data-testid="reports-page">
      <PageHeader title="Riportok" subtitle={`${d.year || ""} évi bevételi áttekintés`} />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
        <Stat icon={Wallet} label="Éves bevétel" value={fmtHuf(d.yearly_revenue)} testid="report-yearly" />
        <Stat icon={CheckCircle2} label="Befolyt összeg" value={fmtHuf(d.paid_revenue)} testid="report-paid" />
        <Stat icon={Receipt} label="Kintlévőség" value={fmtHuf(d.unpaid_revenue)} testid="report-unpaid" />
        <Stat icon={TrendingUp} label="Profit" value={fmtHuf(d.yearly_profit)} testid="report-profit" />
        <Stat icon={Percent} label="Ajánlat elfogadás" value={`${d.quote_acceptance || 0}%`} testid="report-acceptance" />
      </div>

      <Card className="mt-6" data-testid="revenue-chart">
        <div className="mb-8 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h2 className="font-display text-xl font-semibold">Havi bevétel és kiadás</h2>
        </div>
        <div className="mb-6 flex items-center gap-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-primary/60" /> Bevétel</span>
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-red-400/60" /> Kiadás</span>
        </div>
        <div className="flex h-56 items-stretch gap-2 sm:gap-4">
          {d.months.map((m, i) => (
            <div key={m.month} className="group flex h-full flex-1 flex-col items-center gap-3">
              <div className="relative flex w-full flex-1 items-end gap-1">
                <div
                  className="w-full rounded-t-lg bg-primary/30 transition-all duration-500 group-hover:bg-primary"
                  style={{ height: `${Math.max(2, (m.revenue / max) * 100)}%` }}
                />
                <div
                  className="w-full rounded-t-lg bg-red-400/30 transition-all duration-500 group-hover:bg-red-400"
                  style={{ height: `${Math.max(2, ((m.expense || 0) / max) * 100)}%` }}
                />
                <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground px-2 py-1 text-[10px] font-semibold text-background opacity-0 transition-opacity group-hover:opacity-100">
                  {fmtHuf(m.revenue)} / −{fmtHuf(m.expense || 0)}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">{MONTHS[i]}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card data-testid="top-customers-card">
          <h2 className="font-display text-xl font-semibold">Legnagyobb ügyfelek</h2>
          {(d.top_customers || []).length === 0 ? (
            <Empty text="Még nincs bevételi adat." icon={Wallet} />
          ) : (
            <div className="mt-6 space-y-5">
              {d.top_customers.map((c) => (
                <div key={c.name}>
                  <div className="mb-2 flex justify-between text-sm"><span className="font-medium">{c.name}</span><span className="text-muted-foreground">{fmtHuf(c.revenue)}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-accent">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(c.revenue / d.top_customers[0].revenue) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card data-testid="report-summary-card">
          <h2 className="font-display text-xl font-semibold">Összegzés</h2>
          <div className="mt-6 divide-y divide-border">
            {[["Kiállított számlák", d.invoice_count || 0], ["Lezárt munkák", d.closed_jobs || 0], ["Éves bevétel", fmtHuf(d.yearly_revenue)], ["Éves kiadás", fmtHuf(d.yearly_expense)], ["Profit", fmtHuf(d.yearly_profit)], ["Kintlévőség", fmtHuf(d.unpaid_revenue)]].map(([k, v]) => (
              <div key={k} className="flex justify-between py-4 text-sm">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-display font-semibold">{v}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

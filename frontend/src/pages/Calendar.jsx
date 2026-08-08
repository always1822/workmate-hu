import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Hammer, FileText, Receipt, CalendarDays } from "lucide-react";
import { api, fmtDate, JOB_STATUS, QUOTE_STATUS, INVOICE_STATUS } from "../lib/api";
import { Card, Empty, PageHeader, Badge } from "../components/Shell";
import { Button } from "../components/Fields";

const DAYS = ["H", "K", "Sze", "Cs", "P", "Szo", "V"];
const MONTHS = ["Január", "Február", "Március", "Április", "Május", "Június", "Július", "Augusztus", "Szeptember", "Október", "November", "December"];
const KIND = {
  munka: { label: "Munka határidő", icon: Hammer, dot: "bg-primary", statuses: JOB_STATUS },
  ajanlat: { label: "Ajánlat érvényesség", icon: FileText, dot: "bg-violet-500", statuses: QUOTE_STATUS },
  szamla: { label: "Fizetési határidő", icon: Receipt, dot: "bg-amber-500", statuses: INVOICE_STATUS },
};

export default function Calendar() {
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const { data } = useQuery({ queryKey: ["calendar"], queryFn: async () => (await api.get("/calendar")).data });
  const events = data?.events || [];

  const byDate = useMemo(() => {
    const map = {};
    events.forEach((e) => {
      const key = String(e.date).slice(0, 10);
      (map[key] = map[key] || []).push(e);
    });
    return map;
  }, [events]);

  const first = new Date(cursor.y, cursor.m, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const iso = (d) => `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const todayIso = today.toISOString().slice(0, 10);

  const move = (delta) => {
    const d = new Date(cursor.y, cursor.m + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() });
  };

  const upcoming = events.filter((e) => String(e.date).slice(0, 10) >= todayIso).slice(0, 8);
  const overdue = events.filter((e) => String(e.date).slice(0, 10) < todayIso &&
    !["kesz", "lezarva", "fizetve"].includes(e.status)).slice(0, 6);

  return (
    <div data-testid="calendar-page">
      <PageHeader title="Naptár" subtitle="Munka határidők, ajánlat érvényességek és fizetési határidők">
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="h-11 w-11 px-0" onClick={() => move(-1)} data-testid="calendar-prev"><ChevronLeft className="h-4 w-4" /></Button>
          <div className="min-w-[168px] text-center font-display text-lg font-semibold" data-testid="calendar-month">{MONTHS[cursor.m]} {cursor.y}</div>
          <Button variant="secondary" className="h-11 w-11 px-0" onClick={() => move(1)} data-testid="calendar-next"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </PageHeader>

      <div className="mb-6 flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
        {Object.entries(KIND).map(([k, v]) => (
          <span key={k} className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${v.dot}`} /> {v.label}</span>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-8" data-testid="calendar-grid">
          <div className="mb-3 grid grid-cols-7 gap-2">
            {DAYS.map((d) => <div key={d} className="wm-label text-center">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {cells.map((d, i) => {
              if (!d) return <div key={`e${i}`} />;
              const key = iso(d);
              const list = byDate[key] || [];
              const isToday = key === todayIso;
              return (
                <div
                  key={key}
                  data-testid={`calendar-day-${key}`}
                  className={`min-h-[86px] rounded-xl border p-2 transition-colors ${isToday ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50"}`}
                >
                  <div className={`text-xs font-semibold ${isToday ? "text-primary" : "text-muted-foreground"}`}>{d}</div>
                  <div className="mt-1.5 space-y-1">
                    {list.slice(0, 3).map((e) => (
                      <Link key={`${e.kind}-${e.id}`} to={e.route} className="flex items-center gap-1.5" title={e.title}>
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${KIND[e.kind].dot}`} />
                        <span className="truncate text-[11px] text-foreground/80">{e.title}</span>
                      </Link>
                    ))}
                    {list.length > 3 && <div className="text-[10px] text-muted-foreground">+{list.length - 3} további</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="space-y-5 lg:col-span-4">
          {overdue.length > 0 && (
            <Card className="border-destructive/40 bg-destructive/5" data-testid="calendar-overdue">
              <h2 className="font-display text-lg font-semibold text-destructive">Lejárt határidők</h2>
              <div className="mt-4 divide-y divide-border">
                {overdue.map((e) => (
                  <Link key={`${e.kind}-${e.id}`} to={e.route} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{e.title}</div>
                      <div className="text-xs text-muted-foreground">{fmtDate(e.date)} · {e.subtitle || "—"}</div>
                    </div>
                    <Badge cls={(KIND[e.kind].statuses[e.status] || {}).cls || "bg-accent text-muted-foreground"}>
                      {(KIND[e.kind].statuses[e.status] || {}).label || e.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            </Card>
          )}
          <Card data-testid="calendar-upcoming">
            <h2 className="font-display text-lg font-semibold">Közelgő határidők</h2>
            {upcoming.length === 0 ? (
              <Empty text="Nincs közelgő határidő." icon={CalendarDays} />
            ) : (
              <div className="mt-4 divide-y divide-border">
                {upcoming.map((e) => {
                  const Icon = KIND[e.kind].icon;
                  return (
                    <Link key={`${e.kind}-${e.id}`} to={e.route} className="flex items-center gap-3 py-3 transition-colors hover:bg-accent/40">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-muted-foreground"><Icon className="h-4 w-4" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{e.title}</div>
                        <div className="truncate text-xs text-muted-foreground">{fmtDate(e.date)} · {e.subtitle || "—"}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

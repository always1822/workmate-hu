import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Mail, Phone, MapPin, Hammer, FileText, Receipt, Wallet, Clock, FolderOpen, Building2,
} from "lucide-react";
import { api, fmtHuf, fmtDate, JOB_STATUS, QUOTE_STATUS, INVOICE_STATUS } from "../lib/api";
import { Badge, Card, Empty, PageHeader } from "../components/Shell";
import { Button } from "../components/Fields";

const Stat = ({ label, value, testid }) => (
  <div className="rounded-2xl border border-border p-4" data-testid={testid}>
    <div className="wm-label">{label}</div>
    <div className="mt-1.5 font-display text-xl font-semibold">{value}</div>
  </div>
);

const Row = ({ title, subtitle, right, badge }) => (
  <div className="flex items-center gap-4 py-3.5">
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-semibold">{title}</div>
      <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
    </div>
    {right && <div className="font-display text-sm font-semibold">{right}</div>}
    {badge}
  </div>
);

export default function CustomerDetail() {
  const { id } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["customer-history", id],
    queryFn: async () => (await api.get(`/customers/${id}/history`)).data,
  });

  if (isLoading || !data) return <div className="py-20 text-center text-sm text-muted-foreground">Betöltés…</div>;
  const { customer: c, stats: s, jobs, quotes, invoices, payments, documents } = data;

  return (
    <div data-testid="customer-detail-page">
      <Link to="/ugyfelek" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary" data-testid="back-to-customers">
        <ArrowLeft className="h-4 w-4" /> Vissza az ügyfelekhez
      </Link>

      <PageHeader title={c.name} subtitle={c.contact ? `Kapcsolattartó: ${c.contact}` : "Ügyfél történet"}>
        {c.email && <a href={`mailto:${c.email}`}><Button variant="secondary" data-testid="customer-mail-btn"><Mail className="h-4 w-4" /> E-mail</Button></a>}
        {c.phone && <a href={`tel:${c.phone}`}><Button variant="secondary" data-testid="customer-call-btn"><Phone className="h-4 w-4" /> Hívás</Button></a>}
      </PageHeader>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-4" data-testid="customer-info-card">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 font-display text-lg font-semibold text-primary">
              {(c.name || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate font-display text-lg font-semibold">{c.name}</div>
              <div className="text-xs text-muted-foreground">Ügyfél óta: {fmtDate(c.created_at)}</div>
            </div>
          </div>
          <div className="mt-6 space-y-3 text-sm">
            {c.email && <div className="flex items-center gap-3 text-muted-foreground"><Mail className="h-4 w-4 shrink-0" /><span className="truncate">{c.email}</span></div>}
            {c.phone && <div className="flex items-center gap-3 text-muted-foreground"><Phone className="h-4 w-4 shrink-0" />{c.phone}</div>}
            {c.address && <div className="flex items-center gap-3 text-muted-foreground"><MapPin className="h-4 w-4 shrink-0" /><span className="truncate">{c.address}</span></div>}
            {c.tax_number && <div className="flex items-center gap-3 text-muted-foreground"><Building2 className="h-4 w-4 shrink-0" />{c.tax_number}</div>}
          </div>
          {c.notes && <p className="mt-6 rounded-2xl bg-accent/60 p-4 text-sm text-muted-foreground">{c.notes}</p>}
        </Card>

        <Card className="lg:col-span-8" data-testid="customer-stats-card">
          <h2 className="font-display text-xl font-semibold">Összegzés</h2>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label="Munkák" value={s.jobs} testid="cust-stat-jobs" />
            <Stat label="Nyitott munka" value={s.open_jobs} testid="cust-stat-open-jobs" />
            <Stat label="Ajánlatok" value={s.quotes} testid="cust-stat-quotes" />
            <Stat label="Számlázott" value={fmtHuf(s.invoiced)} testid="cust-stat-invoiced" />
            <Stat label="Befolyt" value={fmtHuf(s.paid)} testid="cust-stat-paid" />
            <Stat label="Kintlévőség" value={fmtHuf(s.outstanding)} testid="cust-stat-outstanding" />
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> {s.hours} naplózott munkaóra
          </div>
        </Card>

        <Card className="lg:col-span-6" data-testid="customer-jobs-card">
          <div className="mb-4 flex items-center gap-2">
            <Hammer className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-semibold">Munkák</h2>
          </div>
          {jobs.length === 0 ? <Empty text="Még nincs munka." icon={Hammer} /> : (
            <div className="divide-y divide-border">
              {jobs.map((j) => (
                <Row key={j.id} title={j.title} subtitle={`Határidő: ${fmtDate(j.deadline)}`} right={fmtHuf(j.value)}
                  badge={<Badge cls={(JOB_STATUS[j.status] || {}).cls}>{(JOB_STATUS[j.status] || {}).label || j.status}</Badge>} />
              ))}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-6" data-testid="customer-quotes-card">
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-semibold">Ajánlatok</h2>
          </div>
          {quotes.length === 0 ? <Empty text="Még nincs ajánlat." icon={FileText} /> : (
            <div className="divide-y divide-border">
              {quotes.map((q) => (
                <Row key={q.id} title={q.title || q.number} subtitle={`${q.number} · érvényes: ${fmtDate(q.valid_until)}`} right={fmtHuf(q.total)}
                  badge={<Badge cls={(QUOTE_STATUS[q.status] || {}).cls}>{(QUOTE_STATUS[q.status] || {}).label || q.status}</Badge>} />
              ))}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-6" data-testid="customer-invoices-card">
          <div className="mb-4 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-semibold">Számlák</h2>
          </div>
          {invoices.length === 0 ? <Empty text="Még nincs számla." icon={Receipt} /> : (
            <div className="divide-y divide-border">
              {invoices.map((i) => (
                <Row key={i.id} title={i.title || i.number} subtitle={`${i.number} · kelt: ${fmtDate(i.issue_date)}`} right={fmtHuf(i.total)}
                  badge={<Badge cls={(INVOICE_STATUS[i.status] || {}).cls}>{(INVOICE_STATUS[i.status] || {}).label || i.status}</Badge>} />
              ))}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-6" data-testid="customer-payments-card">
          <div className="mb-4 flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-semibold">Fizetések és dokumentumok</h2>
          </div>
          {payments.length === 0 && documents.length === 0 ? <Empty text="Nincs tétel." icon={Wallet} /> : (
            <div className="divide-y divide-border">
              {payments.map((p) => (
                <Row key={p.id} title={p.title} subtitle={`${p.kind === "bevetel" ? "Bevétel" : "Kiadás"} · ${fmtDate(p.date)}`}
                  right={<span className={p.kind === "bevetel" ? "text-emerald-600" : "text-red-500"}>{p.kind === "bevetel" ? "+" : "−"}{fmtHuf(p.amount)}</span>} />
              ))}
              {documents.map((d) => (
                <Row key={d.id} title={d.name} subtitle={`Dokumentum · ${fmtDate(d.created_at)}`}
                  badge={<FolderOpen className="h-4 w-4 text-muted-foreground" />} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

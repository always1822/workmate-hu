import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Receipt, FileDown, X, CheckCircle2, Mail, CircleDollarSign, Check, Wallet,
} from "lucide-react";
import { api, openPdf, fmtHuf, fmtDate, invTotal, INVOICE_STATUS, quoteTotals, apiErr } from "../lib/api";
import { Badge, Empty, PageHeader } from "../components/Shell";
import { SendMailModal } from "../components/SendMailModal";
import { Button, Field, Input, Modal, Select, TableWrap, Td, Textarea, Th } from "../components/Fields";

const EMPTY = {
  number: "", customer_id: "", customer_name: "", job_id: "", title: "", status: "kiallitva",
  issue_date: new Date().toISOString().slice(0, 10), due_date: "", payment_method: "atutalas",
  vat_rate: 27, notes: "", items: [{ description: "", quantity: 1, unit: "db", unit_price: 0 }],
};

// A Lejárt csak megjelenített státusz – szerkesztéskor visszaáll a kiállítottra
const rawStatus = (s) => (s === "lejart" ? "kiallitva" : s);
const ISSUABLE = ["vazlat", "kiallitva", "fizetve"];

const AmountEditor = ({ inv, onSave, testid }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState("");
  const commit = () => {
    setEditing(false);
    const n = Number(val);
    if (Number.isFinite(n) && n >= 0 && Math.abs(n - invTotal(inv)) > 0.01) onSave(n);
  };
  if (!editing) {
    return (
      <button
        onClick={() => { setVal(String(invTotal(inv))); setEditing(true); }}
        data-testid={testid}
        title="Összeg szerkesztése"
        className="group inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-display font-semibold transition-colors hover:bg-accent"
      >
        {fmtHuf(invTotal(inv))}
        <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    );
  }
  return (
    <input
      type="number"
      autoFocus
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
      className="w-32 rounded-lg border border-primary bg-card px-2 py-1 text-right font-display font-semibold outline-none"
      data-testid={`amount-input-${inv.id}`}
    />
  );
};

export default function Invoices() {
  const qc = useQueryClient();
  const [form, setForm] = useState(null);
  const [tab, setTab] = useState("pending");
  const [mailFor, setMailFor] = useState(null);
  const { data = [] } = useQuery({ queryKey: ["invoices"], queryFn: async () => (await api.get("/invoices")).data });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: async () => (await api.get("/customers")).data });
  const { data: jobs = [] } = useQuery({ queryKey: ["jobs"], queryFn: async () => (await api.get("/jobs")).data });

  // Számlázásra vár: kész munkák, amelyekhez még NINCS számla
  const pending = jobs.filter((j) => j.status === "elkeszult" && !data.some((i) => i.job_id === j.id));
  const totalIssued = data.reduce((s, i) => s + invTotal(i), 0);

  const save = useMutation({
    mutationFn: async (v) => {
      const body = {
        ...v, status: rawStatus(v.status), vat_rate: Number(v.vat_rate || 0),
        // A tételszerkesztés mindig konzisztens: az összeg a tételekből számolódik
        total: quoteTotals(v).gross,
        customer_name: customers.find((c) => c.id === v.customer_id)?.name || v.customer_name,
        items: (v.items || []).map((i) => ({ ...i, quantity: Number(i.quantity || 0), unit_price: Number(i.unit_price || 0) })),
      };
      return v.id ? api.put(`/invoices/${v.id}`, body) : api.post("/invoices", body);
    },
    onSuccess: () => { qc.invalidateQueries(); setForm(null); toast.success("Számla mentve"); },
    onError: (e) => toast.error(apiErr(e, "Mentés sikertelen")),
  });
  const del = useMutation({ mutationFn: async (id) => api.delete(`/invoices/${id}`), onSuccess: () => { qc.invalidateQueries(); toast.success("Számla törölve"); } });

  // Egykattintásos számla-kiállítás: az adatok a munkából/ügyfélből automatikusan töltődnek
  const createFromJob = useMutation({
    mutationFn: async (jobId) => (await api.post("/invoices", { job_id: jobId })).data,
    onSuccess: () => { qc.invalidateQueries(); setTab("issued"); toast.success("Számla kiállítva – az összeget bármikor módosíthatod"); },
    onError: (e) => toast.error(apiErr(e, "Nem sikerült")),
  });
  const markPaid = useMutation({
    mutationFn: async (inv) => (await api.put(`/invoices/${inv.id}`, { ...inv, status: "fizetve", total: invTotal(inv) })).data,
    onSuccess: () => { qc.invalidateQueries(); toast.success("Számla fizetve – a riportok frissültek"); },
    onError: (e) => toast.error(apiErr(e, "Nem sikerült")),
  });
  const setAmount = useMutation({
    mutationFn: async ({ inv, total }) => (await api.put(`/invoices/${inv.id}`, { ...inv, total })).data,
    onSuccess: () => { qc.invalidateQueries(); toast.success("Összeg frissítve – Dashboard, Pénzügy és Riportok frissültek"); },
    onError: (e) => toast.error(apiErr(e, "Nem sikerült")),
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setItem = (i, k, v) => setForm({ ...form, items: form.items.map((it, x) => (x === i ? { ...it, [k]: v } : it)) });
  const t = form ? quoteTotals(form) : null;

  return (
    <div data-testid="invoices-page">
      <PageHeader title="Számlák" subtitle={tab === "pending" ? "Kész munkák, amelyekhez még nem készült számla" : `${data.length} kiállított számla · összesen ${fmtHuf(totalIssued)}`}>
        <Link to="/penzugy" data-testid="invoices-finance-link"><Button variant="secondary"><Wallet className="h-4 w-4" /> Pénzügy</Button></Link>
        <Button onClick={() => setForm({ ...EMPTY })} data-testid="add-invoice-btn">
          <Plus className="h-4 w-4" /> Új számla
        </Button>
      </PageHeader>

      {/* Fülek */}
      <div className="mb-6 flex w-full max-w-md rounded-xl border border-border bg-card p-1" data-testid="invoice-tabs">
        <button onClick={() => setTab("pending")} data-testid="tab-pending"
          className={`inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${tab === "pending" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <Wallet className="h-4 w-4" /> Számlázásra vár
          {pending.length > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-xs ${tab === "pending" ? "bg-white/20" : "bg-primary/10 text-primary"}`}>{pending.length}</span>
          )}
        </button>
        <button onClick={() => setTab("issued")} data-testid="tab-issued"
          className={`inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${tab === "issued" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          <Receipt className="h-4 w-4" /> Kiállított számlák
          <span className={`rounded-full px-2 py-0.5 text-xs ${tab === "issued" ? "bg-white/20" : "bg-primary/10 text-primary"}`}>{data.length}</span>
        </button>
      </div>

      {tab === "pending" ? (
        pending.length === 0 ? (
          <div className="wm-card"><Empty text="Nincs számlázásra váró munka – minden kész munkához készült számla." icon={CheckCircle2} /></div>
        ) : (
          <div className="space-y-3" data-testid="pending-invoices">
            {pending.map((j) => (
              <div key={j.id} className="wm-card flex flex-wrap items-center gap-4 p-5" data-testid={`pending-job-${j.id}`}>
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{j.title}</div>
                  <div className="text-xs text-muted-foreground">{j.customer_name || "—"} · {fmtHuf(j.value)}</div>
                </div>
                <Button onClick={() => createFromJob.mutate(j.id)} data-testid={`issue-invoice-${j.id}`} className="h-12 px-6">
                  <Receipt className="h-4 w-4" /> Számla kiállítása
                </Button>
              </div>
            ))}
          </div>
        )
      ) : data.length === 0 ? (
        <div className="wm-card"><Empty text="Még nincs kiállított számla." icon={Receipt} /></div>
      ) : (
        <TableWrap>
          <thead><tr><Th>Számla</Th><Th>Ügyfél</Th><Th>Állapot</Th><Th>Kelt</Th><Th>Határidő</Th><Th className="text-right">Összeg</Th><Th className="text-right">Műveletek</Th></tr></thead>
          <tbody>
            {data.map((inv) => (
              <tr key={inv.id} className="transition-colors hover:bg-accent/50" data-testid={`invoice-row-${inv.id}`}>
                <Td><div className="font-semibold">{inv.title || "Számla"}</div><div className="text-xs text-muted-foreground">{inv.number} · {(inv.items || []).length} tétel</div></Td>
                <Td className="text-muted-foreground">{inv.customer_name || "—"}</Td>
                <Td><Badge cls={(INVOICE_STATUS[inv.status] || {}).cls}>{(INVOICE_STATUS[inv.status] || {}).label || inv.status}</Badge></Td>
                <Td className="text-muted-foreground">{fmtDate(inv.issue_date)}</Td>
                <Td className="text-muted-foreground">{fmtDate(inv.due_date)}</Td>
                <Td className="text-right">
                  <AmountEditor inv={inv} testid={`amount-edit-${inv.id}`} onSave={(total) => setAmount.mutate({ inv, total })} />
                </Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" className="h-9 px-3" onClick={() => openPdf(`/invoices/${inv.id}/pdf`)} data-testid={`pdf-invoice-${inv.id}`}><FileDown className="h-4 w-4" /> PDF</Button>
                    {inv.status !== "fizetve" && (
                      <Button variant="secondary" className="h-9 px-3 text-emerald-600" onClick={() => markPaid.mutate(inv)} data-testid={`pay-invoice-${inv.id}`}>
                        <Check className="h-4 w-4" /> Fizetve
                      </Button>
                    )}
                    <Button variant="secondary" className="h-9 w-9 px-0" onClick={() => setMailFor(inv)} data-testid={`send-invoice-${inv.id}`}><Mail className="h-4 w-4" /></Button>
                    <Button variant="secondary" className="h-9 w-9 px-0" onClick={() => setForm({ ...EMPTY, ...inv, status: rawStatus(inv.status), items: inv.items?.length ? inv.items : EMPTY.items })} data-testid={`edit-invoice-${inv.id}`}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="secondary" className="h-9 w-9 px-0 text-destructive" onClick={() => del.mutate(inv.id)} data-testid={`delete-invoice-${inv.id}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      <SendMailModal
        open={!!mailFor}
        onClose={() => setMailFor(null)}
        kind="invoice"
        doc={mailFor || {}}
        defaultEmail={customers.find((c) => c.id === mailFor?.customer_id)?.email || ""}
        onSent={() => qc.invalidateQueries()}
      />

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Számla szerkesztése" : "Új számla"} subtitle="A számlaszám automatikus, a határidő a kiállítás napja + 8 nap" wide>
        {form && (
          <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Számla száma"><Input value={form.number || "Automatikus (SZ-ÉV-SSS)"} disabled data-testid="invoice-number-input" /></Field>
              <Field label="Megnevezés *"><Input required value={form.title} onChange={set("title")} data-testid="invoice-title-input" /></Field>
              <Field label="Ügyfél">
                <Select value={form.customer_id} onChange={set("customer_id")} data-testid="invoice-customer-select">
                  <option value="">— Válassz —</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Állapot">
                <Select value={rawStatus(form.status)} onChange={set("status")} data-testid="invoice-status-select">
                  {ISSUABLE.map((k) => <option key={k} value={k}>{(INVOICE_STATUS[k] || {}).label || k}</option>)}
                </Select>
              </Field>
              <Field label="Kelt"><Input type="date" value={form.issue_date || ""} onChange={set("issue_date")} data-testid="invoice-issue-input" /></Field>
              <Field label="Fizetési határidő (alapból +8 nap)"><Input type="date" value={form.due_date || ""} onChange={set("due_date")} data-testid="invoice-due-input" /></Field>
              <Field label="Fizetési mód">
                <Select value={form.payment_method} onChange={set("payment_method")} data-testid="invoice-payment-select">
                  <option value="atutalas">Átutalás</option>
                  <option value="keszpenz">Készpénz</option>
                </Select>
              </Field>
              <Field label="ÁFA (%)"><Input type="number" value={form.vat_rate} onChange={set("vat_rate")} data-testid="invoice-vat-input" /></Field>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="wm-label">Tételek</span>
                <Button type="button" variant="secondary" className="h-9 px-3" data-testid="add-invoice-item-btn"
                  onClick={() => setForm({ ...form, items: [...form.items, { _k: crypto.randomUUID(), description: "", quantity: 1, unit: "db", unit_price: 0 }] })}>
                  <Plus className="h-4 w-4" /> Tétel
                </Button>
              </div>
              <div className="space-y-3">
                {form.items.map((it, i) => (
                  <div key={it._k || `inv-item-${i}`} className="grid grid-cols-12 gap-2 rounded-2xl border border-border p-3">
                    <Input className="col-span-12 sm:col-span-5" placeholder="Megnevezés" value={it.description} onChange={(e) => setItem(i, "description", e.target.value)} data-testid={`inv-item-desc-${i}`} />
                    <Input className="col-span-4 sm:col-span-2" type="number" value={it.quantity} onChange={(e) => setItem(i, "quantity", e.target.value)} data-testid={`inv-item-qty-${i}`} />
                    <Input className="col-span-3 sm:col-span-1" value={it.unit} onChange={(e) => setItem(i, "unit", e.target.value)} data-testid={`inv-item-unit-${i}`} />
                    <Input className="col-span-4 sm:col-span-3" type="number" value={it.unit_price} onChange={(e) => setItem(i, "unit_price", e.target.value)} data-testid={`inv-item-price-${i}`} />
                    <button type="button" className="col-span-1 grid place-items-center rounded-lg text-muted-foreground hover:text-destructive"
                      onClick={() => setForm({ ...form, items: form.items.filter((_, x) => x !== i) })} data-testid={`remove-inv-item-${i}`}><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            </div>

            <Field label="Megjegyzés"><Textarea value={form.notes} onChange={set("notes")} data-testid="invoice-notes-input" /></Field>

            <div className="rounded-2xl bg-accent/60 p-5" data-testid="invoice-totals">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Nettó</span><span className="font-semibold">{fmtHuf(t.net)}</span></div>
              <div className="mt-2 flex justify-between text-sm"><span className="text-muted-foreground">ÁFA</span><span className="font-semibold">{fmtHuf(t.vat)}</span></div>
              <div className="mt-3 flex justify-between border-t border-border pt-3"><span className="font-display font-semibold">Bruttó összesen</span><span className="font-display text-lg font-semibold text-primary">{fmtHuf(t.gross)}</span></div>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              {form.id && <Button type="button" variant="secondary" onClick={() => openPdf(`/invoices/${form.id}/pdf`)} data-testid="invoice-pdf-btn"><FileDown className="h-4 w-4" /> PDF számla</Button>}
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>Mégse</Button>
              <Button type="submit" data-testid="save-invoice-btn">Mentés</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

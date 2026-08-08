import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Receipt, FileDown, X, CheckCircle2, Mail } from "lucide-react";
import { api, openPdf, fmtHuf, fmtDate, INVOICE_STATUS, quoteTotals, apiErr } from "../lib/api";
import { Badge, Empty, PageHeader } from "../components/Shell";
import { SendMailModal } from "../components/SendMailModal";
import { Button, Field, Input, Modal, Select, TableWrap, Td, Textarea, Th } from "../components/Fields";

const EMPTY = {
  number: "", customer_id: "", customer_name: "", job_id: "", title: "", status: "vazlat",
  issue_date: new Date().toISOString().slice(0, 10), due_date: "", payment_method: "atutalas",
  vat_rate: 27, notes: "", items: [{ description: "", quantity: 1, unit: "db", unit_price: 0 }],
};

export default function Invoices() {
  const qc = useQueryClient();
  const [form, setForm] = useState(null);
  const [mailFor, setMailFor] = useState(null);
  const { data = [] } = useQuery({ queryKey: ["invoices"], queryFn: async () => (await api.get("/invoices")).data });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: async () => (await api.get("/customers")).data });
  const { data: jobs = [] } = useQuery({ queryKey: ["jobs"], queryFn: async () => (await api.get("/jobs")).data });

  const save = useMutation({
    mutationFn: async (v) => {
      const body = {
        ...v, vat_rate: Number(v.vat_rate || 0),
        customer_name: customers.find((c) => c.id === v.customer_id)?.name || v.customer_name,
        items: (v.items || []).map((i) => ({ ...i, quantity: Number(i.quantity || 0), unit_price: Number(i.unit_price || 0) })),
      };
      return v.id ? api.put(`/invoices/${v.id}`, body) : api.post("/invoices", body);
    },
    onSuccess: () => { qc.invalidateQueries(); setForm(null); toast.success("Számla mentve"); },
    onError: (e) => toast.error(apiErr(e, "Mentés sikertelen")),
  });
  const del = useMutation({ mutationFn: async (id) => api.delete(`/invoices/${id}`), onSuccess: () => { qc.invalidateQueries(); toast.success("Számla törölve"); } });
  const fromJob = useMutation({
    mutationFn: async (jobId) => (await api.post(`/jobs/${jobId}/invoice`)).data,
    onSuccess: (inv) => { qc.invalidateQueries(); setForm({ ...EMPTY, ...inv }); toast.success("Számla előkészítve a munkából"); },
    onError: (e) => toast.error(apiErr(e, "Nem sikerült")),
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setItem = (i, k, v) => setForm({ ...form, items: form.items.map((it, x) => (x === i ? { ...it, [k]: v } : it)) });
  const t = form ? quoteTotals(form) : null;
  const closable = jobs.filter((j) => j.status === "elkeszult");

  return (
    <div data-testid="invoices-page">
      <PageHeader title="Számlák" subtitle={`${data.length} számla · összesen ${fmtHuf(data.reduce((s, i) => s + quoteTotals(i).gross, 0))}`}>
        <Button onClick={() => setForm({ ...EMPTY, number: `SZ-${new Date().getFullYear()}-${String(data.length + 1).padStart(3, "0")}` })} data-testid="add-invoice-btn">
          <Plus className="h-4 w-4" /> Új számla
        </Button>
      </PageHeader>

      {closable.length > 0 && (
        <div className="wm-card mb-6 p-6" data-testid="closable-jobs-card">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <h2 className="font-display text-lg font-semibold">Lezárt munkák – számlázásra várnak</h2>
          </div>
          <div className="space-y-3">
            {closable.map((j) => (
              <div key={j.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border p-4">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{j.title}</div>
                  <div className="text-xs text-muted-foreground">{j.customer_name || "—"} · {fmtHuf(j.value)}</div>
                </div>
                <Button onClick={() => fromJob.mutate(j.id)} data-testid={`invoice-from-job-${j.id}`}>
                  <Receipt className="h-4 w-4" /> Számla készítése
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.length === 0 ? (
        <div className="wm-card"><Empty text="Még nincs kiállított számla." icon={Receipt} /></div>
      ) : (
        <TableWrap>
          <thead><tr><Th>Számla</Th><Th>Ügyfél</Th><Th>Állapot</Th><Th>Kelt</Th><Th>Határidő</Th><Th className="text-right">Bruttó</Th><Th className="text-right">Műveletek</Th></tr></thead>
          <tbody>
            {data.map((inv) => (
              <tr key={inv.id} className="transition-colors hover:bg-accent/50" data-testid={`invoice-row-${inv.id}`}>
                <Td><div className="font-semibold">{inv.title || "Számla"}</div><div className="text-xs text-muted-foreground">{inv.number} · {(inv.items || []).length} tétel</div></Td>
                <Td className="text-muted-foreground">{inv.customer_name || "—"}</Td>
                <Td><Badge cls={(INVOICE_STATUS[inv.status] || {}).cls}>{(INVOICE_STATUS[inv.status] || {}).label || inv.status}</Badge></Td>
                <Td className="text-muted-foreground">{fmtDate(inv.issue_date)}</Td>
                <Td className="text-muted-foreground">{fmtDate(inv.due_date)}</Td>
                <Td className="text-right font-display font-semibold">{fmtHuf(quoteTotals(inv).gross)}</Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" className="h-9 px-3" onClick={() => openPdf(`/invoices/${inv.id}/pdf`)} data-testid={`pdf-invoice-${inv.id}`}><FileDown className="h-4 w-4" /> PDF</Button>
                    <Button variant="secondary" className="h-9 w-9 px-0" onClick={() => setMailFor(inv)} data-testid={`send-invoice-${inv.id}`}><Mail className="h-4 w-4" /></Button>
                    <Button variant="secondary" className="h-9 w-9 px-0" onClick={() => setForm({ ...EMPTY, ...inv, items: inv.items?.length ? inv.items : EMPTY.items })} data-testid={`edit-invoice-${inv.id}`}><Pencil className="h-4 w-4" /></Button>
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

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Számla szerkesztése" : "Új számla"} subtitle="Ellenőrizd az adatokat, majd generálj PDF-et" wide>
        {form && (
          <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Számla száma"><Input value={form.number} onChange={set("number")} data-testid="invoice-number-input" /></Field>
              <Field label="Megnevezés *"><Input required value={form.title} onChange={set("title")} data-testid="invoice-title-input" /></Field>
              <Field label="Ügyfél">
                <Select value={form.customer_id} onChange={set("customer_id")} data-testid="invoice-customer-select">
                  <option value="">— Válassz —</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Állapot">
                <Select value={form.status} onChange={set("status")} data-testid="invoice-status-select">
                  {Object.entries(INVOICE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </Select>
              </Field>
              <Field label="Kelt"><Input type="date" value={form.issue_date || ""} onChange={set("issue_date")} data-testid="invoice-issue-input" /></Field>
              <Field label="Fizetési határidő"><Input type="date" value={form.due_date || ""} onChange={set("due_date")} data-testid="invoice-due-input" /></Field>
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

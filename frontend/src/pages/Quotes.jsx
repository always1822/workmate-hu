import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileText, FileDown, X, Hammer, Mail, Paperclip } from "lucide-react";
import { api, openPdf, fmtHuf, fmtDate, fileUrl, QUOTE_STATUS, quoteTotals, apiErr } from "../lib/api";
import { Badge, Empty, PageHeader } from "../components/Shell";
import { SendMailModal } from "../components/SendMailModal";
import { Button, Field, Input, Modal, Select, TableWrap, Td, Textarea, Th } from "../components/Fields";

const EMPTY = {
  number: "", customer_id: "", customer_name: "", title: "", status: "letrehozva", valid_until: "",
  vat_rate: 27, notes: "", description: "", material_cost: 0, labor_cost: 0,
  attachment_path: "", attachment_name: "", items: [],
};

export default function Quotes() {
  const qc = useQueryClient();
  const [form, setForm] = useState(null);
  const [mailFor, setMailFor] = useState(null);
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const uploadAttachment = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", "terv");
    try {
      const { data: doc } = await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((f) => ({ ...f, attachment_path: doc.storage_path, attachment_name: doc.name }));
      toast.success("Csatolmány feltöltve");
    } catch (err) {
      toast.error(apiErr(err, "A feltöltés nem sikerült"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };
  const { data = [] } = useQuery({ queryKey: ["quotes"], queryFn: async () => (await api.get("/quotes")).data });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: async () => (await api.get("/customers")).data });

  const save = useMutation({
    mutationFn: async (v) => {
      const body = {
        ...v,
        vat_rate: Number(v.vat_rate || 0),
        material_cost: Number(v.material_cost || 0),
        labor_cost: Number(v.labor_cost || 0),
        customer_name: customers.find((c) => c.id === v.customer_id)?.name || v.customer_name,
        items: (v.items || []).map((i) => ({ ...i, quantity: Number(i.quantity || 0), unit_price: Number(i.unit_price || 0) })),
      };
      return v.id ? api.put(`/quotes/${v.id}`, body) : api.post("/quotes", body);
    },
    onSuccess: () => { qc.invalidateQueries(); setForm(null); toast.success("Ajánlat mentve"); },
    onError: () => toast.error("Mentés sikertelen"),
  });
  const del = useMutation({ mutationFn: async (id) => api.delete(`/quotes/${id}`), onSuccess: () => { qc.invalidateQueries(); toast.success("Ajánlat törölve"); } });
  const toJob = useMutation({
    mutationFn: async (id) => api.post(`/quotes/${id}/job`),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Munka létrehozva az ajánlatból"); },
    onError: (e) => toast.error(apiErr(e, "Nem sikerült")),
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setItem = (idx, k, val) => setForm({ ...form, items: form.items.map((it, i) => (i === idx ? { ...it, [k]: val } : it)) });
  const totals = form ? quoteTotals(form) : null;

  return (
    <div data-testid="quotes-page">
      <PageHeader title="Ajánlatok" subtitle={`${data.length} árajánlat · PDF generálás egy kattintással`}>
        <Button onClick={() => setForm({ ...EMPTY, number: `AJ-${new Date().getFullYear()}-${String(data.length + 1).padStart(3, "0")}` })} data-testid="add-quote-btn">
          <Plus className="h-4 w-4" /> Új ajánlat
        </Button>
      </PageHeader>

      {data.length === 0 ? (
        <div className="wm-card"><Empty text="Még nincs árajánlat." icon={FileText} /></div>
      ) : (
        <TableWrap>
          <thead><tr><Th>Ajánlat</Th><Th>Ügyfél</Th><Th>Állapot</Th><Th>Érvényes</Th><Th className="text-right">Bruttó</Th><Th className="text-right">Műveletek</Th></tr></thead>
          <tbody>
            {data.map((q) => {
              const t = quoteTotals(q);
              return (
                <tr key={q.id} className="transition-colors hover:bg-accent/50" data-testid={`quote-row-${q.id}`}>
                  <Td><div className="font-semibold">{q.title || "Névtelen ajánlat"}</div><div className="text-xs text-muted-foreground">{q.number} · {(q.items || []).length} tétel</div></Td>
                  <Td className="text-muted-foreground">{q.customer_name || "—"}</Td>
                  <Td><Badge cls={(QUOTE_STATUS[q.status] || {}).cls}>{(QUOTE_STATUS[q.status] || {}).label || q.status}</Badge></Td>
                  <Td className="text-muted-foreground">{fmtDate(q.valid_until)}</Td>
                  <Td className="text-right font-display font-semibold">{fmtHuf(t.gross)}</Td>
                  <Td>
                    <div className="flex justify-end gap-2">
                      <Button variant="secondary" className="h-9 px-3" onClick={() => openPdf(`/quotes/${q.id}/pdf`)} data-testid={`pdf-quote-${q.id}`}>
                        <FileDown className="h-4 w-4" /> PDF
                      </Button>
                      <Button variant="secondary" className="h-9 w-9 px-0" onClick={() => setMailFor(q)} data-testid={`send-quote-${q.id}`}><Mail className="h-4 w-4" /></Button>
                      {!q.job_id && (
                        <Button variant="secondary" className="h-9 px-3" onClick={() => toJob.mutate(q.id)} data-testid={`quote-to-job-${q.id}`}>
                          <Hammer className="h-4 w-4" /> Munka
                        </Button>
                      )}
                      <Button variant="secondary" className="h-9 w-9 px-0" onClick={() => setForm({ ...EMPTY, ...q, items: q.items || [] })} data-testid={`edit-quote-${q.id}`}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="secondary" className="h-9 w-9 px-0 text-destructive" onClick={() => del.mutate(q.id)} data-testid={`delete-quote-${q.id}`}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      )}

      <SendMailModal
        open={!!mailFor}
        onClose={() => setMailFor(null)}
        kind="quote"
        doc={mailFor || {}}
        defaultEmail={customers.find((c) => c.id === mailFor?.customer_id)?.email || ""}
        onSent={() => qc.invalidateQueries()}
      />

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Ajánlat szerkesztése" : "Új ajánlat"} subtitle="Tételek, ÁFA és PDF export" wide>
        {form && (
          <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Ajánlat száma"><Input value={form.number} onChange={set("number")} data-testid="quote-number-input" /></Field>
              <Field label="Megnevezés *"><Input required value={form.title} onChange={set("title")} data-testid="quote-title-input" /></Field>
              <Field label="Ügyfél">
                <Select value={form.customer_id} onChange={set("customer_id")} data-testid="quote-customer-select">
                  <option value="">— Válassz —</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Állapot">
                <Select value={form.status} onChange={set("status")} data-testid="quote-status-select">
                  {Object.entries(QUOTE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </Select>
              </Field>
              <Field label="Érvényesség"><Input type="date" value={form.valid_until || ""} onChange={set("valid_until")} data-testid="quote-valid-input" /></Field>
              <Field label="ÁFA (%)"><Input type="number" value={form.vat_rate} onChange={set("vat_rate")} data-testid="quote-vat-input" /></Field>
              <Field label="Anyagköltség (Ft)"><Input type="number" value={form.material_cost} onChange={set("material_cost")} data-testid="quote-material-input" /></Field>
              <Field label="Munkadíj (Ft)"><Input type="number" value={form.labor_cost} onChange={set("labor_cost")} data-testid="quote-labor-input" /></Field>
              <div className="sm:col-span-2">
                <Field label="Leírás"><Textarea rows={3} value={form.description || ""} onChange={set("description")} data-testid="quote-description-input" /></Field>
              </div>
              <div className="sm:col-span-2">
                <span className="wm-label mb-2 block">Csatolmány (kép vagy PDF, nem kötelező)</span>
                <div className="flex flex-wrap items-center gap-3">
                  <input ref={fileRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={uploadAttachment} data-testid="quote-attachment-file" />
                  <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading} data-testid="quote-attachment-btn">
                    <Paperclip className="h-4 w-4" /> {uploading ? "Feltöltés…" : "Fájl csatolása"}
                  </Button>
                  {form.attachment_name && (
                    <a href={fileUrl(form.attachment_path)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-primary hover:underline" data-testid="quote-attachment-link">
                      {form.attachment_name}
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="wm-label">Tételek (nem kötelező)</span>
                <Button type="button" variant="secondary" className="h-9 px-3" data-testid="add-item-btn"
                  onClick={() => setForm({ ...form, items: [...form.items, { _k: crypto.randomUUID(), description: "", quantity: 1, unit: "db", unit_price: 0 }] })}>
                  <Plus className="h-4 w-4" /> Tétel
                </Button>
              </div>
              <div className="space-y-3">
                {form.items.map((it, i) => (
                  <div key={it._k || `quote-item-key-${i}`} className="grid grid-cols-12 gap-2 rounded-2xl border border-border p-3" data-testid={`quote-item-${i}`}>
                    <Input className="col-span-12 sm:col-span-5" placeholder="Megnevezés" value={it.description} onChange={(e) => setItem(i, "description", e.target.value)} data-testid={`item-desc-${i}`} />
                    <Input className="col-span-4 sm:col-span-2" type="number" placeholder="Menny." value={it.quantity} onChange={(e) => setItem(i, "quantity", e.target.value)} data-testid={`item-qty-${i}`} />
                    <Input className="col-span-3 sm:col-span-1" placeholder="db" value={it.unit} onChange={(e) => setItem(i, "unit", e.target.value)} data-testid={`item-unit-${i}`} />
                    <Input className="col-span-4 sm:col-span-3" type="number" placeholder="Egységár" value={it.unit_price} onChange={(e) => setItem(i, "unit_price", e.target.value)} data-testid={`item-price-${i}`} />
                    <button type="button" className="col-span-1 grid place-items-center rounded-lg text-muted-foreground transition-colors hover:text-destructive"
                      onClick={() => setForm({ ...form, items: form.items.filter((_, x) => x !== i) })} data-testid={`remove-item-${i}`}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <Field label="Megjegyzés"><Textarea value={form.notes} onChange={set("notes")} data-testid="quote-notes-input" /></Field>

            <div className="rounded-2xl bg-accent/60 p-5" data-testid="quote-totals">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Nettó</span><span className="font-semibold">{fmtHuf(totals.net)}</span></div>
              <div className="mt-2 flex justify-between text-sm"><span className="text-muted-foreground">ÁFA</span><span className="font-semibold">{fmtHuf(totals.vat)}</span></div>
              <div className="mt-3 flex justify-between border-t border-border pt-3"><span className="font-display font-semibold">Bruttó összesen</span><span className="font-display text-lg font-semibold text-primary">{fmtHuf(totals.gross)}</span></div>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>Mégse</Button>
              <Button type="submit" data-testid="save-quote-btn">Mentés</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

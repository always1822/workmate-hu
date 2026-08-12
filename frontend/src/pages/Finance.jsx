import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";
import { api, fmtHuf, fmtDate, apiErr, PAYMENT_CATEGORIES } from "../lib/api";
import { Card, Empty, PageHeader, Badge } from "../components/Shell";
import { Button, Field, Input, Modal, Select, TableWrap, Td, Textarea, Th } from "../components/Fields";

const EMPTY = { kind: "kiadas", title: "", category: "anyag", amount: 0, date: new Date().toISOString().slice(0, 10), customer_id: "", customer_name: "", notes: "" };

const Stat = ({ icon: Icon, label, value, tone, testid }) => (
  <Card data-testid={testid}>
    <div className={`grid h-11 w-11 place-items-center rounded-2xl ${tone}`}><Icon className="h-5 w-5" /></div>
    <div className="mt-5 wm-label">{label}</div>
    <div className="mt-2 font-display text-2xl font-semibold">{value}</div>
  </Card>
);

export default function Finance() {
  const qc = useQueryClient();
  const [form, setForm] = useState(null);
  const [filter, setFilter] = useState("mind");
  const { data = [] } = useQuery({ queryKey: ["payments"], queryFn: async () => (await api.get("/payments")).data });
  const { data: stats } = useQuery({ queryKey: ["stats"], queryFn: async () => (await api.get("/stats")).data });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: async () => (await api.get("/customers")).data });

  const save = useMutation({
    mutationFn: async (v) => {
      const body = { ...v, amount: Number(v.amount || 0) };
      return v.id ? api.put(`/payments/${v.id}`, body) : api.post("/payments", body);
    },
    onSuccess: () => { qc.invalidateQueries(); setForm(null); toast.success("Tétel mentve"); },
    onError: (e) => toast.error(apiErr(e, "Mentés sikertelen")),
  });
  const del = useMutation({ mutationFn: async (id) => api.delete(`/payments/${id}`), onSuccess: () => { qc.invalidateQueries(); toast.success("Tétel törölve"); } });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const rows = filter === "mind" ? data : data.filter((p) => p.kind === filter);
  const income = data.filter((p) => p.kind === "bevetel").reduce((s, p) => s + Number(p.amount || 0), 0);
  const expense = data.filter((p) => p.kind === "kiadas").reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <div data-testid="finance-page">
      <PageHeader title="Pénzügy" subtitle="Bevételek, kiadások és profit áttekintés">
        <Button onClick={() => setForm({ ...EMPTY })} data-testid="add-payment-btn"><Plus className="h-4 w-4" /> Új tétel</Button>
      </PageHeader>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Wallet} label="Számlázott bevétel (éves)" value={fmtHuf(stats?.yearly_revenue)} tone="bg-primary/10 text-primary" testid="finance-revenue" />
        <Stat icon={TrendingUp} label="Egyéb bevétel (éves)" value={fmtHuf(stats?.extra_income)} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10" testid="finance-income" />
        <Stat icon={TrendingDown} label="Kiadás (éves)" value={fmtHuf(stats?.yearly_expense)} tone="bg-red-50 text-red-500 dark:bg-red-500/10" testid="finance-expense" />
        <Stat icon={PiggyBank} label="Profit (éves)" value={fmtHuf(stats?.profit)} tone="bg-amber-50 text-amber-600 dark:bg-amber-500/10" testid="finance-profit" />
      </div>

      <div className="mb-6 mt-8 flex flex-wrap gap-2">
        {[["mind", "Mind"], ["bevetel", "Bevételek"], ["kiadas", "Kiadások"]].map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} data-testid={`finance-filter-${k}`}
            className={`h-10 rounded-full px-4 text-sm font-semibold transition-colors ${filter === k ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:bg-accent"}`}>
            {label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card><Empty text="Még nincs pénzügyi tétel." icon={Wallet} /></Card>
      ) : (
        <TableWrap>
          <thead><tr><Th>Megnevezés</Th><Th>Típus</Th><Th>Kategória</Th><Th>Dátum</Th><Th className="text-right">Összeg</Th><Th className="text-right">Műveletek</Th></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="transition-colors hover:bg-accent/50" data-testid={`payment-row-${p.id}`}>
                <Td><div className="font-semibold">{p.title || "—"}</div><div className="text-xs text-muted-foreground">{p.customer_name || p.notes || "—"}</div></Td>
                <Td>
                  <Badge cls={p.kind === "bevetel" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300"}>
                    {p.kind === "bevetel" ? "Bevétel" : "Kiadás"}
                  </Badge>
                </Td>
                <Td className="text-muted-foreground">{PAYMENT_CATEGORIES[p.category] || p.category}</Td>
                <Td className="text-muted-foreground">{fmtDate(p.date)}</Td>
                <Td className={`text-right font-display font-semibold ${p.kind === "bevetel" ? "text-emerald-600" : "text-red-500"}`}>
                  {p.kind === "bevetel" ? "+" : "−"}{fmtHuf(p.amount)}
                </Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" className="h-9 w-9 px-0" onClick={() => setForm(p)} data-testid={`edit-payment-${p.id}`}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="secondary" className="h-9 w-9 px-0 text-destructive" onClick={() => del.mutate(p.id)} data-testid={`delete-payment-${p.id}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Tétel szerkesztése" : "Új pénzügyi tétel"} wide>
        {form && (
          <form className="grid grid-cols-1 gap-5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}>
            <Field label="Típus">
              <Select value={form.kind} onChange={set("kind")} data-testid="payment-kind-select">
                <option value="kiadas">Kiadás</option>
                <option value="bevetel">Bevétel</option>
              </Select>
            </Field>
            <Field label="Kategória">
              <Select value={form.category} onChange={set("category")} data-testid="payment-category-select">
                {Object.entries(PAYMENT_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Ügyfél (opcionális)">
                <Select value={form.customer_id || ""} onChange={(e) => setForm({
                  ...form,
                  customer_id: e.target.value,
                  customer_name: customers.find((c) => c.id === e.target.value)?.name || "",
                })} data-testid="payment-customer-select">
                  <option value="">— Nincs —</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
            </div>
            <div className="sm:col-span-2"><Field label="Megnevezés *"><Input required value={form.title} onChange={set("title")} data-testid="payment-title-input" /></Field></div>
            <Field label="Összeg (Ft) *"><Input required type="number" value={form.amount} onChange={set("amount")} data-testid="payment-amount-input" /></Field>
            <Field label="Dátum"><Input type="date" value={form.date || ""} onChange={set("date")} data-testid="payment-date-input" /></Field>
            <div className="sm:col-span-2"><Field label="Megjegyzés"><Textarea value={form.notes} onChange={set("notes")} data-testid="payment-notes-input" /></Field></div>
            <div className="flex justify-end gap-3 sm:col-span-2">
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>Mégse</Button>
              <Button type="submit" data-testid="save-payment-btn">Mentés</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

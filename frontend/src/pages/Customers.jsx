import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Mail, Phone, Users, Search, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { PageHeader, Empty } from "../components/Shell";
import { Button, Field, Input, Modal, TableWrap, Td, Textarea, Th } from "../components/Fields";

const EMPTY = { name: "", contact: "", email: "", phone: "", address: "", tax_number: "", notes: "" };

export default function Customers() {
  const qc = useQueryClient();
  const [form, setForm] = useState(null);
  const [q, setQ] = useState("");
  const { data = [] } = useQuery({ queryKey: ["customers"], queryFn: async () => (await api.get("/customers")).data });

  const save = useMutation({
    mutationFn: async (v) => (v.id ? api.put(`/customers/${v.id}`, v) : api.post("/customers", v)),
    onSuccess: () => {
      qc.invalidateQueries();
      setForm(null);
      toast.success("Ügyfél mentve");
    },
    onError: () => toast.error("Mentés sikertelen"),
  });

  const del = useMutation({
    mutationFn: async (id) => api.delete(`/customers/${id}`),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Ügyfél törölve"); },
  });

  const rows = data.filter((c) => `${c.name} ${c.contact} ${c.email}`.toLowerCase().includes(q.toLowerCase()));
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div data-testid="customers-page">
      <PageHeader title="Ügyfelek" subtitle={`${data.length} partner a rendszerben`}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input data-testid="customer-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Keresés…" className="h-11 w-full pl-10 sm:w-64" />
        </div>
        <Button onClick={() => setForm({ ...EMPTY })} data-testid="add-customer-btn"><Plus className="h-4 w-4" /> Új ügyfél</Button>
      </PageHeader>

      {rows.length === 0 ? (
        <div className="wm-card"><Empty text="Nincs megjeleníthető ügyfél." icon={Users} /></div>
      ) : (
        <TableWrap>
          <thead>
            <tr><Th>Ügyfél</Th><Th>Kapcsolattartó</Th><Th>Elérhetőség</Th><Th>Adószám</Th><Th className="text-right">Műveletek</Th></tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-accent/50" data-testid={`customer-row-${c.id}`}>
                <Td>
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 font-display text-sm font-semibold text-primary">
                      {(c.name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.address || "—"}</div>
                    </div>
                  </div>
                </Td>
                <Td className="text-muted-foreground">{c.contact || "—"}</Td>
                <Td>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {c.email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{c.email}</div>}
                    {c.phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{c.phone}</div>}
                  </div>
                </Td>
                <Td className="text-muted-foreground">{c.tax_number || "—"}</Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    <Link to={`/ugyfelek/${c.id}`} data-testid={`open-customer-${c.id}`}>
                      <Button variant="secondary" className="h-9 px-3">Történet <ArrowUpRight className="h-4 w-4" /></Button>
                    </Link>
                    <Button variant="secondary" className="h-9 w-9 px-0" onClick={() => setForm(c)} data-testid={`edit-customer-${c.id}`}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="secondary" className="h-9 w-9 px-0 text-destructive" onClick={() => del.mutate(c.id)} data-testid={`delete-customer-${c.id}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Ügyfél szerkesztése" : "Új ügyfél"} subtitle="Add meg a partner adatait" wide>
        {form && (
          <form
            className="grid grid-cols-1 gap-5 sm:grid-cols-2"
            onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}
          >
            <Field label="Cégnév *"><Input required value={form.name} onChange={set("name")} data-testid="customer-name-input" /></Field>
            <Field label="Kapcsolattartó"><Input value={form.contact} onChange={set("contact")} data-testid="customer-contact-input" /></Field>
            <Field label="E-mail"><Input type="email" value={form.email} onChange={set("email")} data-testid="customer-email-input" /></Field>
            <Field label="Telefon"><Input value={form.phone} onChange={set("phone")} data-testid="customer-phone-input" /></Field>
            <Field label="Cím"><Input value={form.address} onChange={set("address")} data-testid="customer-address-input" /></Field>
            <Field label="Adószám"><Input value={form.tax_number} onChange={set("tax_number")} data-testid="customer-tax-input" /></Field>
            <div className="sm:col-span-2"><Field label="Megjegyzés"><Textarea value={form.notes} onChange={set("notes")} data-testid="customer-notes-input" /></Field></div>
            <div className="flex justify-end gap-3 sm:col-span-2">
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>Mégse</Button>
              <Button type="submit" disabled={save.isPending} data-testid="save-customer-btn">Mentés</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

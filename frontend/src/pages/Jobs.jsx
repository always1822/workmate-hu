import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Hammer, LayoutGrid, List, Receipt } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { api, fmtHuf, fmtDate, JOB_STATUS, PRIORITY, apiErr } from "../lib/api";
import { Badge, Card, Empty, PageHeader } from "../components/Shell";
import { Button, Field, Input, Modal, Select, TableWrap, Td, Textarea, Th } from "../components/Fields";

const EMPTY = { title: "", customer_id: "", customer_name: "", status: "tervezett", priority: "kozepes", value: 0, deadline: "", description: "" };

export default function Jobs() {
  const qc = useQueryClient();
  const [form, setForm] = useState(null);
  const [view, setView] = useState("lista");
  const navigate = useNavigate();
  const { data = [] } = useQuery({ queryKey: ["jobs"], queryFn: async () => (await api.get("/jobs")).data });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: async () => (await api.get("/customers")).data });

  const save = useMutation({
    mutationFn: async (v) => {
      const body = { ...v, value: Number(v.value || 0), customer_name: customers.find((c) => c.id === v.customer_id)?.name || v.customer_name };
      return v.id ? api.put(`/jobs/${v.id}`, body) : api.post("/jobs", body);
    },
    onSuccess: () => { qc.invalidateQueries(); setForm(null); toast.success("Munka mentve"); },
    onError: () => toast.error("Mentés sikertelen"),
  });
  const del = useMutation({ mutationFn: async (id) => api.delete(`/jobs/${id}`), onSuccess: () => { qc.invalidateQueries(); toast.success("Munka törölve"); } });
  const toInvoice = useMutation({
    mutationFn: async (id) => api.post(`/jobs/${id}/invoice`),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Számla előkészítve"); navigate("/szamlak"); },
    onError: (e) => toast.error(apiErr(e, "Nem sikerült")),
  });
  const setStatus = useMutation({
    mutationFn: async ({ job, status }) => api.put(`/jobs/${job.id}`, { ...job, status }),
    onSuccess: () => qc.invalidateQueries(),
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const grouped = useMemo(
    () => Object.keys(JOB_STATUS).reduce((acc, k) => ({ ...acc, [k]: data.filter((j) => j.status === k) }), {}),
    [data],
  );

  return (
    <div data-testid="jobs-page">
      <PageHeader title="Munkák" subtitle={`${data.length} projekt · összérték ${fmtHuf(data.reduce((s, j) => s + Number(j.value || 0), 0))}`}>
        <div className="flex rounded-xl border border-border bg-card p-1">
          {[["lista", List], ["kanban", LayoutGrid]].map(([v, Icon]) => (
            <button key={v} onClick={() => setView(v)} data-testid={`view-${v}`}
              className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${view === v ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-4 w-4" /> <span className="hidden sm:inline capitalize">{v}</span>
            </button>
          ))}
        </div>
        <Button onClick={() => setForm({ ...EMPTY })} data-testid="add-job-btn"><Plus className="h-4 w-4" /> Új munka</Button>
      </PageHeader>

      {data.length === 0 ? (
        <div className="wm-card"><Empty text="Még nincs rögzített munka." icon={Hammer} /></div>
      ) : view === "lista" ? (
        <TableWrap>
          <thead><tr><Th>Munka</Th><Th>Ügyfél</Th><Th>Állapot</Th><Th>Prioritás</Th><Th>Határidő</Th><Th className="text-right">Érték</Th><Th className="text-right">Műveletek</Th></tr></thead>
          <tbody>
            {data.map((j) => (
              <tr key={j.id} className="transition-colors hover:bg-accent/50" data-testid={`job-row-${j.id}`}>
                <Td><div className="font-semibold">{j.title}</div><div className="max-w-xs truncate text-xs text-muted-foreground">{j.description || "—"}</div></Td>
                <Td className="text-muted-foreground">{j.customer_name || "—"}</Td>
                <Td><Badge cls={(JOB_STATUS[j.status] || {}).cls}>{(JOB_STATUS[j.status] || {}).label || j.status}</Badge></Td>
                <Td className="text-muted-foreground">{PRIORITY[j.priority] || j.priority}</Td>
                <Td className="text-muted-foreground">{fmtDate(j.deadline)}</Td>
                <Td className="text-right font-display font-semibold">{fmtHuf(j.value)}</Td>
                <Td>
                  <div className="flex justify-end gap-2">
                    {j.status === "elkeszult" && (
                      <Button variant="secondary" className="h-9 px-3" onClick={() => toInvoice.mutate(j.id)} data-testid={`job-to-invoice-${j.id}`}>
                        <Receipt className="h-4 w-4" /> Számla
                      </Button>
                    )}
                    <Button variant="secondary" className="h-9 w-9 px-0" onClick={() => setForm(j)} data-testid={`edit-job-${j.id}`}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="secondary" className="h-9 w-9 px-0 text-destructive" onClick={() => del.mutate(j.id)} data-testid={`delete-job-${j.id}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      ) : (
        <div className="wm-scroll flex gap-5 overflow-x-auto pb-4" data-testid="kanban-board">
          {Object.entries(JOB_STATUS).map(([k, v]) => (
            <div key={k} className="w-80 shrink-0">
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="font-display font-semibold">{v.label}</span>
                <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">{(grouped[k] || []).length}</span>
              </div>
              <div className="space-y-3">
                {(grouped[k] || []).map((j) => (
                  <Card key={j.id} className="cursor-pointer p-5 transition-transform duration-200 hover:-translate-y-[2px]" data-testid={`kanban-card-${j.id}`}>
                    <div className="font-semibold">{j.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{j.customer_name || "—"}</div>
                    <div className="mt-4 flex items-center justify-between">
                      <span className="font-display font-semibold">{fmtHuf(j.value)}</span>
                      <span className="text-xs text-muted-foreground">{fmtDate(j.deadline)}</span>
                    </div>
                    <Select className="mt-4 h-10 text-xs" value={j.status} onChange={(e) => setStatus.mutate({ job: j, status: e.target.value })} data-testid={`kanban-status-${j.id}`}>
                      {Object.entries(JOB_STATUS).map(([sk, sv]) => <option key={sk} value={sk}>{sv.label}</option>)}
                    </Select>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Munka szerkesztése" : "Új munka"} wide>
        {form && (
          <form className="grid grid-cols-1 gap-5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}>
            <div className="sm:col-span-2"><Field label="Munka megnevezése *"><Input required value={form.title} onChange={set("title")} data-testid="job-title-input" /></Field></div>
            <Field label="Ügyfél">
              <Select value={form.customer_id} onChange={set("customer_id")} data-testid="job-customer-select">
                <option value="">— Válassz —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Állapot">
              <Select value={form.status} onChange={set("status")} data-testid="job-status-select">
                {Object.entries(JOB_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
            </Field>
            <Field label="Prioritás">
              <Select value={form.priority} onChange={set("priority")} data-testid="job-priority-select">
                {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Érték (Ft)"><Input type="number" value={form.value} onChange={set("value")} data-testid="job-value-input" /></Field>
            <Field label="Határidő"><Input type="date" value={form.deadline || ""} onChange={set("deadline")} data-testid="job-deadline-input" /></Field>
            <div className="sm:col-span-2"><Field label="Leírás"><Textarea value={form.description} onChange={set("description")} data-testid="job-description-input" /></Field></div>
            <div className="flex justify-end gap-3 sm:col-span-2">
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>Mégse</Button>
              <Button type="submit" data-testid="save-job-btn">Mentés</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

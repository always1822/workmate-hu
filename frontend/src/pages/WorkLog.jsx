import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Clock, Timer, Pencil } from "lucide-react";
import { api, fmtDate } from "../lib/api";
import { Card, Empty, PageHeader } from "../components/Shell";
import { Button, Field, Input, Modal, Select, Textarea } from "../components/Fields";

const EMPTY = { date: new Date().toISOString().slice(0, 10), job_id: "", job_title: "", worker: "", hours: 8, description: "" };

export default function WorkLog() {
  const qc = useQueryClient();
  const [form, setForm] = useState(null);
  const { data = [] } = useQuery({ queryKey: ["worklogs"], queryFn: async () => (await api.get("/worklogs")).data });
  const { data: jobs = [] } = useQuery({ queryKey: ["jobs"], queryFn: async () => (await api.get("/jobs")).data });

  const save = useMutation({
    mutationFn: async (v) => {
      const body = { ...v, hours: Number(v.hours || 0), job_title: jobs.find((j) => j.id === v.job_id)?.title || v.job_title };
      return v.id ? api.put(`/worklogs/${v.id}`, body) : api.post("/worklogs", body);
    },
    onSuccess: () => { qc.invalidateQueries(); setForm(null); toast.success("Bejegyzés mentve"); },
    onError: () => toast.error("Mentés sikertelen"),
  });
  const del = useMutation({ mutationFn: async (id) => api.delete(`/worklogs/${id}`), onSuccess: () => { qc.invalidateQueries(); toast.success("Bejegyzés törölve"); } });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const totalHours = data.reduce((s, w) => s + Number(w.hours || 0), 0);
  const sorted = [...data].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return (
    <div data-testid="worklog-page">
      <PageHeader title="Munkanapló" subtitle={`${data.length} bejegyzés · összesen ${totalHours} munkaóra`}>
        <Button onClick={() => setForm({ ...EMPTY })} data-testid="add-worklog-btn"><Plus className="h-4 w-4" /> Új bejegyzés</Button>
      </PageHeader>

      {data.length === 0 ? (
        <Card><Empty text="Még nincs naplózott munkaóra." icon={Timer} /></Card>
      ) : (
        <Card data-testid="worklog-timeline">
          <div className="relative pl-6">
            <div className="absolute bottom-2 left-[9px] top-2 w-px bg-border" />
            {sorted.map((w) => (
              <div key={w.id} className="relative pb-8 last:pb-0" data-testid={`worklog-row-${w.id}`}>
                <span className="absolute -left-6 top-1.5 grid h-[19px] w-[19px] place-items-center rounded-full border-2 border-primary bg-card">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{w.job_title || "Általános munka"}</span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        <Clock className="h-3 w-3" /> {w.hours} óra
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{fmtDate(w.date)} · {w.worker || "—"}</div>
                    {w.description && <p className="mt-2 text-sm text-muted-foreground">{w.description}</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" className="h-9 w-9 px-0" onClick={() => setForm(w)} data-testid={`edit-worklog-${w.id}`}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="secondary" className="h-9 w-9 px-0 text-destructive" onClick={() => del.mutate(w.id)} data-testid={`delete-worklog-${w.id}`}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Bejegyzés szerkesztése" : "Új naplóbejegyzés"} wide>
        {form && (
          <form className="grid grid-cols-1 gap-5 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}>
            <Field label="Dátum *"><Input required type="date" value={form.date} onChange={set("date")} data-testid="worklog-date-input" /></Field>
            <Field label="Munka">
              <Select value={form.job_id} onChange={set("job_id")} data-testid="worklog-job-select">
                <option value="">— Válassz —</option>
                {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
              </Select>
            </Field>
            <Field label="Dolgozó"><Input value={form.worker} onChange={set("worker")} data-testid="worklog-worker-input" /></Field>
            <Field label="Óra"><Input type="number" step="0.5" value={form.hours} onChange={set("hours")} data-testid="worklog-hours-input" /></Field>
            <div className="sm:col-span-2"><Field label="Elvégzett munka"><Textarea value={form.description} onChange={set("description")} data-testid="worklog-desc-input" /></Field></div>
            <div className="flex justify-end gap-3 sm:col-span-2">
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>Mégse</Button>
              <Button type="submit" data-testid="save-worklog-btn">Mentés</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

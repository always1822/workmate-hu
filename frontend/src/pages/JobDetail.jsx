import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Download, FileText, FolderOpen, Hammer, Plus, Receipt, Pencil, CalendarDays, Tag, User } from "lucide-react";
import { api, fmtHuf, fmtDate, JOB_STATUS, PRIORITY, downloadFile, apiErr } from "../lib/api";
import { Badge, Card, Empty, PageHeader } from "../components/Shell";
import { Button, Field, Input, Textarea } from "../components/Fields";

export default function JobDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: job, isLoading } = useQuery({
    queryKey: ["job", id],
    queryFn: async () => (await api.get(`/jobs/${id}`)).data,
    enabled: !!id,
  });
  const { data: invoices = [] } = useQuery({ queryKey: ["invoices"], queryFn: async () => (await api.get("/invoices")).data });
  const { data: worklogs = [] } = useQuery({ queryKey: ["worklogs"], queryFn: async () => (await api.get("/worklogs")).data });
  const { data: documents = [] } = useQuery({ queryKey: ["documents"], queryFn: async () => (await api.get("/documents")).data });
  const { data: quotes = [] } = useQuery({ queryKey: ["quotes"], queryFn: async () => (await api.get("/quotes")).data });
  const invoice = invoices.find((i) => i.job_id === id);
  const quote = quotes.find((q) => q.id === job?.quote_id);
  const jobLogs = worklogs.filter((w) => w.job_id === id);
  const jobDocs = documents.filter((d) => d.job_id === id || (job?.customer_id && d.customer_id === job.customer_id));
  const [logForm, setLogForm] = useState({ date: new Date().toISOString().slice(0, 10), hours: 8, worker: "", description: "" });

  const markDone = useMutation({
    mutationFn: async () => api.put(`/jobs/${id}`, { ...job, status: "elkeszult" }),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Készre jelentve – a Számlák oldalon kiállíthatod a számlát"); },
    onError: (e) => toast.error(apiErr(e, "Nem sikerült")),
  });
  const createInvoice = useMutation({
    mutationFn: async () => (await api.post("/invoices", { job_id: id })).data,
    onSuccess: () => { qc.invalidateQueries(); toast.success("Számla kiállítva"); navigate("/szamlak"); },
    onError: (e) => toast.error(apiErr(e, "Nem sikerült")),
  });
  const addLog = useMutation({
    mutationFn: async (v) => api.post("/worklogs", { ...v, job_id: id, job_title: job?.title || "" }),
    onSuccess: () => {
      qc.invalidateQueries();
      setLogForm({ date: new Date().toISOString().slice(0, 10), hours: 8, worker: "", description: "" });
      toast.success("Bejegyzés mentve");
    },
    onError: (e) => toast.error(apiErr(e, "Nem sikerült")),
  });
  const downloadDoc = async (d) => {
    try {
      await downloadFile(d.storage_path, d.name || "fajl");
      toast.success("Letöltés elindítva");
    } catch (e) {
      toast.error(apiErr(e, "A letöltés nem sikerült"));
    }
  };

  if (isLoading) return <div className="grid h-64 place-items-center text-muted-foreground">Betöltés…</div>;
  if (!job) return <div className="wm-card"><Empty text="A munka nem található." icon={Hammer} /></div>;

  return (
    <div data-testid="job-detail-page">
      <Link to="/munkak" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary" data-testid="back-to-jobs">
        <ArrowLeft className="h-4 w-4" /> Vissza a munkákhoz
      </Link>

      <PageHeader title={job.title || "Munka"} subtitle={job.customer_name ? `Megrendelő: ${job.customer_name}` : "Személyes munka"}>
        <div className="flex flex-wrap items-center gap-3">
          <Badge cls={(JOB_STATUS[job.status] || {}).cls}>{(JOB_STATUS[job.status] || {}).label || job.status}</Badge>
          {job.status === "elkeszult" && !invoice && (
            <Button onClick={() => createInvoice.mutate()} data-testid="detail-issue-invoice">
              <Receipt className="h-4 w-4" /> Számla kiállítása
            </Button>
          )}
          {job.status !== "elkeszult" && (
            <Button onClick={() => markDone.mutate()} data-testid="detail-mark-done">
              <CheckCircle2 className="h-4 w-4" /> Készre jelentés
            </Button>
          )}
          {invoice && (
            <Link to="/szamlak" className="inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50 px-5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300" data-testid="detail-invoice-link">
              {invoice.number} <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-8" data-testid="job-info-card">
          <h2 className="font-display text-xl font-semibold">Adatok</h2>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Tag className="h-4 w-4" /></div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Érték</div>
                <div className="mt-1 font-display text-2xl font-semibold">{fmtHuf(job.value)}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="h-4 w-4" /></div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Határidő</div>
                <div className="mt-1 font-semibold">{fmtDate(job.deadline)}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><User className="h-4 w-4" /></div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ügyfél</div>
                <div className="mt-1 font-semibold">
                  {job.customer_id ? (
                    <Link to={`/ugyfelek/${job.customer_id}`} className="text-foreground transition-colors hover:text-primary hover:underline" data-testid="job-customer-link">{job.customer_name || "—"}</Link>
                  ) : (job.customer_name || "—")}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Hammer className="h-4 w-4" /></div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prioritás</div>
                <div className="mt-1 font-semibold">{PRIORITY[job.priority] || job.priority}</div>
              </div>
            </div>
          </div>
          {quote && (
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-border p-4" data-testid="job-quote-block">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-4 w-4" /></div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ajánlat</div>
                <Link to="/ajanlatok" className="mt-0.5 inline-block text-sm font-semibold text-primary hover:underline" data-testid="job-quote-link">{quote.number}{quote.status === "elfogadva" ? " · Elfogadva" : ""}</Link>
              </div>
            </div>
          )}
          {job.description && (
            <div className="mt-8">
              <div className="wm-label mb-2">Leírás</div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{job.description}</p>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-4" data-testid="job-flow-card">
          <h2 className="font-display text-xl font-semibold">Folyamat</h2>
          <div className="mt-6 space-y-4">
            {[
              { label: "Ajánlat elfogadása", done: !!job.quote_id },
              { label: "Munka", done: true },
              { label: "Készre jelentés", done: job.status === "elkeszult" },
              { label: "Számla kiállítása", done: !!invoice },
              { label: "Fizetés", done: invoice?.status === "fizetve" },
            ].map((s, i, arr) => (
              <div key={s.label} className="flex items-center gap-3">
                <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${s.done ? "bg-emerald-500 text-white" : "bg-accent text-muted-foreground"}`}>
                  {s.done ? "✓" : i + 1}
                </div>
                <span className={`text-sm ${s.done ? "font-medium text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                {i < arr.length - 1 && <div className="ml-1 h-px flex-1 bg-border" />}
              </div>
            ))}
          </div>
          <div className="mt-8">
            <Link to="/munkak" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent">
              <Pencil className="h-4 w-4" /> Szerkesztés a listában
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card className="lg:col-span-6" data-testid="job-worklog-card">
          <div className="mb-5 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <h2 className="font-display text-xl font-semibold">Munkanapló</h2>
            <span className="ml-auto text-xs text-muted-foreground">{jobLogs.length} bejegyzés</span>
          </div>
          {jobLogs.length === 0 ? (
            <Empty text="Még nincs naplózott óra ehhez a munkához." icon={Clock} />
          ) : (
            <div className="space-y-3">
              {jobLogs.map((w) => (
                <div key={w.id} className="flex items-center gap-3 rounded-2xl border border-border p-4" data-testid={`job-log-${w.id}`}>
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-muted-foreground"><Clock className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{w.hours} óra{w.worker ? ` · ${w.worker}` : ""}</div>
                    <div className="truncate text-xs text-muted-foreground">{fmtDate(w.date)}{w.description ? ` · ${w.description}` : ""}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 border-t border-border pt-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Dátum"><Input type="date" value={logForm.date} onChange={(e) => setLogForm({ ...logForm, date: e.target.value })} data-testid="joblog-date" /></Field>
              <Field label="Óra"><Input type="number" step="0.5" value={logForm.hours} onChange={(e) => setLogForm({ ...logForm, hours: e.target.value })} data-testid="joblog-hours" /></Field>
              <Field label="Dolgozó"><Input value={logForm.worker} onChange={(e) => setLogForm({ ...logForm, worker: e.target.value })} data-testid="joblog-worker" /></Field>
              <div className="sm:col-span-3"><Field label="Elvégzett munka"><Textarea rows={2} value={logForm.description} onChange={(e) => setLogForm({ ...logForm, description: e.target.value })} data-testid="joblog-desc" /></Field></div>
            </div>
            <Button className="mt-3" onClick={() => addLog.mutate(logForm)} data-testid="joblog-add">
              <Plus className="h-4 w-4" /> Bejegyzés hozzáadása
            </Button>
          </div>
        </Card>

        <Card className="lg:col-span-6" data-testid="job-documents-card">
          <div className="mb-5 flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-primary" />
            <h2 className="font-display text-xl font-semibold">Dokumentumok</h2>
            <Link to="/dokumentumok" className="ml-auto text-sm font-semibold text-primary hover:underline" data-testid="job-docs-link">Összes dokumentum</Link>
          </div>
          {jobDocs.length === 0 ? (
            <Empty text="Ehhez a munkához még nincs dokumentum – az Összes dokumentum oldalon tölthetsz fel." icon={FolderOpen} />
          ) : (
            <div className="space-y-3">
              {jobDocs.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-2xl border border-border p-4" data-testid={`job-doc-${d.id}`}>
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><FileText className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{d.name}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(d.created_at)}</div>
                  </div>
                  {d.storage_path && (
                    <Button variant="secondary" className="h-9 w-9 px-0" title="Letöltés" onClick={() => downloadDoc(d)} data-testid={`job-doc-download-${d.id}`}><Download className="h-4 w-4" /></Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

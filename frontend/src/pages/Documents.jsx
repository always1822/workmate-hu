import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, FileText, FolderOpen, Download, Upload, ExternalLink } from "lucide-react";
import { api, fmtDate, downloadFile, apiErr } from "../lib/api";
import { Card, Empty, PageHeader } from "../components/Shell";
import { Button, Field, Input, Modal, Select } from "../components/Fields";

const CATS = { szerzodes: "Szerződés", szamla: "Számla", igazolas: "Igazolás", terv: "Terv", egyeb: "Egyéb" };
const EMPTY = { name: "", category: "egyeb", customer_id: "", customer_name: "", size_kb: 0, url: "" };

export default function Documents() {
  const qc = useQueryClient();
  const [form, setForm] = useState(null);
  const [cat, setCat] = useState("mind");
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const { data = [] } = useQuery({ queryKey: ["documents"], queryFn: async () => (await api.get("/documents")).data });
  const { data: customers = [] } = useQuery({ queryKey: ["customers"], queryFn: async () => (await api.get("/customers")).data });

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", cat === "mind" ? "egyeb" : cat);
    try {
      await api.post("/uploads", fd, { headers: { "Content-Type": "multipart/form-data" } });
      qc.invalidateQueries();
      toast.success("Fájl feltöltve");
    } catch (err) {
      toast.error(apiErr(err, "A feltöltés nem sikerült"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const save = useMutation({
    mutationFn: async (v) => api.post("/documents", { ...v, size_kb: Number(v.size_kb || 0) }),
    onSuccess: () => { qc.invalidateQueries(); setForm(null); toast.success("Dokumentum rögzítve"); },
    onError: () => toast.error("Mentés sikertelen"),
  });
  const del = useMutation({ mutationFn: async (id) => api.delete(`/documents/${id}`), onSuccess: () => { qc.invalidateQueries(); toast.success("Dokumentum törölve"); } });
  const download = async (d) => {
    try {
      await downloadFile(d.storage_path, d.name || "fajl");
      toast.success("Letöltés elindítva");
    } catch (err) {
      toast.error(apiErr(err, "A letöltés nem sikerült"));
    }
  };

  const rows = cat === "mind" ? data : data.filter((d) => d.category === cat);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div data-testid="documents-page">
      <PageHeader title="Dokumentumok" subtitle={`${data.length} fájl a vállalkozás archívumában`}>
        <input ref={fileRef} type="file" className="hidden" onChange={upload} data-testid="document-file-input" />
        <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading} data-testid="upload-document-btn">
          <Upload className="h-4 w-4" /> {uploading ? "Feltöltés…" : "Fájl feltöltése"}
        </Button>
        <Button onClick={() => setForm({ ...EMPTY })} data-testid="add-document-btn"><Plus className="h-4 w-4" /> Új dokumentum</Button>
      </PageHeader>

      <div className="mb-6 flex flex-wrap gap-2">
        {["mind", ...Object.keys(CATS)].map((k) => (
          <button key={k} onClick={() => setCat(k)} data-testid={`doc-filter-${k}`}
            className={`h-10 rounded-full px-4 text-sm font-semibold transition-colors ${cat === k ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:bg-accent"}`}>
            {k === "mind" ? "Mind" : CATS[k]}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card><Empty text="Ebben a kategóriában nincs dokumentum." icon={FolderOpen} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((d) => (
            <Card key={d.id} className="group transition-transform duration-200 hover:-translate-y-[3px]" data-testid={`document-card-${d.id}`}>
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><FileText className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{d.name}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{CATS[d.category] || d.category} · {d.size_kb} KB</div>
                </div>
              </div>
              <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                <div className="min-w-0 text-xs text-muted-foreground"><div className="truncate">{d.customer_name || "—"}</div><div>{fmtDate(d.created_at)}</div></div>
                <div className="flex gap-2">
                  {d.storage_path && (
                    <Button variant="secondary" className="h-9 w-9 px-0" title="Letöltés" onClick={() => download(d)} data-testid={`download-document-${d.id}`}><Download className="h-4 w-4" /></Button>
                  )}
                  {d.url && (
                    <a href={d.url} target="_blank" rel="noreferrer" title="Megnyitás" data-testid={`open-document-${d.id}`}>
                      <Button variant="secondary" className="h-9 w-9 px-0"><ExternalLink className="h-4 w-4" /></Button>
                    </a>
                  )}
                  <Button variant="secondary" className="h-9 w-9 px-0 text-destructive" onClick={() => del.mutate(d.id)} data-testid={`delete-document-${d.id}`}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title="Új dokumentum" subtitle="Rögzítsd a fájl adatait">
        {form && (
          <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}>
            <Field label="Fájl neve *"><Input required value={form.name} onChange={set("name")} data-testid="document-name-input" /></Field>
            <Field label="Kategória">
              <Select value={form.category} onChange={set("category")} data-testid="document-category-select">
                {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
            </Field>
            <Field label="Ügyfél">
              <Select value={form.customer_id || ""} onChange={(e) => setForm({
                ...form,
                customer_id: e.target.value,
                customer_name: customers.find((c) => c.id === e.target.value)?.name || "",
              })} data-testid="document-customer-select">
                <option value="">— Nincs —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Méret (KB)"><Input type="number" value={form.size_kb} onChange={set("size_kb")} data-testid="document-size-input" /></Field>
            <Field label="Link (opcionális)"><Input value={form.url} onChange={set("url")} data-testid="document-url-input" /></Field>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>Mégse</Button>
              <Button type="submit" data-testid="save-document-btn">Mentés</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Building2, Save, Info, Upload } from "lucide-react";
import { api, fileUrl, apiErr } from "../lib/api";
import { Card, PageHeader } from "../components/Shell";
import { Button, Field, Input, Textarea } from "../components/Fields";

export default function Company() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["company"], queryFn: async () => (await api.get("/company")).data });
  const [form, setForm] = useState(null);
  const logoRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const uploadLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data: res } = await api.post("/uploads/logo", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setForm((f) => ({ ...f, logo_path: res.logo_path }));
      qc.invalidateQueries();
      toast.success("Logó feltöltve");
    } catch (err) {
      toast.error(apiErr(err, "A feltöltés nem sikerült"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async (v) => api.put("/company", { ...v, onboarded: true }),
    onSuccess: () => { qc.invalidateQueries(); toast.success("Céges adatok mentve"); },
    onError: () => toast.error("Mentés sikertelen"),
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  if (!form) return null;

  return (
    <div data-testid="company-page">
      <PageHeader title="Céges profil" subtitle="Ezek az adatok jelennek meg az árajánlat PDF-eken." />

      <form className="grid grid-cols-1 gap-5 lg:grid-cols-12" onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}>
        <Card className="lg:col-span-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></div>
            <div>
              <h2 className="font-display text-xl font-semibold">Alapadatok</h2>
              <p className="text-sm text-muted-foreground">Cégazonosítás és elérhetőségek</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2"><Field label="Cégnév"><Input value={form.name || ""} onChange={set("name")} data-testid="company-name-input" /></Field></div>
            <Field label="Kapcsolattartó neve"><Input value={form.contact_name || ""} onChange={set("contact_name")} data-testid="company-contact-input" /></Field>
            <div>
              <span className="wm-label mb-2 block">Céges logó</span>
              <div className="flex items-center gap-3">
                {form.logo_path ? (
                  <img src={fileUrl(form.logo_path)} alt="logó" className="h-12 w-12 rounded-xl border border-border object-contain p-1" data-testid="company-logo-preview" />
                ) : (
                  <div className="grid h-12 w-12 place-items-center rounded-xl border border-dashed border-border text-muted-foreground"><Upload className="h-4 w-4" /></div>
                )}
                <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={uploadLogo} data-testid="company-logo-input-file" />
                <Button type="button" variant="secondary" onClick={() => logoRef.current?.click()} disabled={uploading} data-testid="upload-logo-btn">
                  <Upload className="h-4 w-4" /> {uploading ? "Feltöltés…" : "Logó feltöltése"}
                </Button>
              </div>
            </div>
            <Field label="Adószám"><Input value={form.tax_number || ""} onChange={set("tax_number")} data-testid="company-tax-input" /></Field>
            <Field label="Cégjegyzékszám"><Input value={form.reg_number || ""} onChange={set("reg_number")} data-testid="company-reg-input" /></Field>
            <div className="sm:col-span-2"><Field label="Székhely"><Input value={form.address || ""} onChange={set("address")} data-testid="company-address-input" /></Field></div>
            <Field label="E-mail"><Input value={form.email || ""} onChange={set("email")} data-testid="company-email-input" /></Field>
            <Field label="Telefon"><Input value={form.phone || ""} onChange={set("phone")} data-testid="company-phone-input" /></Field>
            <Field label="Weboldal"><Input value={form.website || ""} onChange={set("website")} data-testid="company-website-input" /></Field>
            <Field label="Bankszámlaszám"><Input value={form.bank_account || ""} onChange={set("bank_account")} data-testid="company-bank-input" /></Field>
            <div className="sm:col-span-2"><Field label="PDF lábjegyzet"><Textarea rows={3} value={form.quote_footer || ""} onChange={set("quote_footer")} data-testid="company-footer-input" /></Field></div>
          </div>
          <div className="mt-6 flex justify-end">
            <Button type="submit" disabled={save.isPending} data-testid="save-company-btn"><Save className="h-4 w-4" /> Mentés</Button>
          </div>
        </Card>

        <div className="space-y-5 lg:col-span-4">
          <Card>
            <h3 className="font-display text-lg font-semibold">Ajánlat előnézet</h3>
            <div className="mt-5 overflow-hidden rounded-2xl border border-border">
              <div className="bg-primary px-5 py-4 text-primary-foreground">
                <div className="flex items-center gap-3">
                  {form.logo_path && <img src={fileUrl(form.logo_path)} alt="logó" className="h-8 w-8 rounded bg-white/90 object-contain p-0.5" />}
                  <div>
                    <div className="font-display text-base font-semibold">{form.name || "Cégnév"}</div>
                    <div className="text-[11px] opacity-80">ÁRAJÁNLAT</div>
                  </div>
                </div>
              </div>
              <div className="space-y-1 p-5 text-xs text-muted-foreground">
                <div>{form.address || "Székhely"}</div>
                <div>{form.email || "email@ceg.hu"}</div>
                <div>{form.phone || "+36 ..."}</div>
                <div className="pt-3 text-center text-[11px] italic">{form.quote_footer || "Lábjegyzet"}</div>
              </div>
            </div>
          </Card>
          <Card className="border-primary/30 bg-primary/5">
            <div className="flex gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-sm text-muted-foreground">A megadott adatok automatikusan bekerülnek minden generált PDF árajánlatba.</p>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
}

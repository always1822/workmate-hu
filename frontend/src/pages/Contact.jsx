import { useState } from "react";
import { toast } from "sonner";
import { Send, Mail, MessageSquare, Clock } from "lucide-react";
import { api, apiErr } from "../lib/api";
import { PublicShell } from "../components/PublicShell";
import { Button, Field, Input, Textarea } from "../components/Fields";

const EMPTY = { name: "", email: "", subject: "", message: "" };

export default function Contact() {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/contacts", form);
      toast.success(data.message || "Üzenet elküldve");
      setForm(EMPTY);
      setSent(true);
    } catch (err) {
      toast.error(apiErr(err, "Az üzenet küldése nem sikerült"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicShell>
      <div data-testid="contact-page" className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div>
          <h1 className="font-display text-4xl font-semibold sm:text-5xl">Kapcsolat</h1>
          <p className="mt-4 text-base text-muted-foreground">
            Kérdésed van a WorkMate HU-ról, vagy segítségre van szükséged a bevezetésben? Írj nekünk, és hamarosan válaszolunk.
          </p>
          <div className="mt-10 space-y-4">
            {[
              { icon: MessageSquare, title: "Bemutató kérése", desc: "Megmutatjuk, hogyan illeszkedik a napi munkádba." },
              { icon: Mail, title: "Írásos válasz", desc: "A megadott e-mail címre válaszolunk." },
              { icon: Clock, title: "Válaszidő", desc: "Munkanapokon jellemzően 24 órán belül." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="wm-card flex items-start gap-4 p-5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
                <div>
                  <div className="text-sm font-semibold">{title}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="wm-card p-7 sm:p-8">
          {sent ? (
            <div className="py-8 text-center" data-testid="contact-success">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"><Send className="h-6 w-6" /></div>
              <h2 className="mt-5 font-display text-2xl font-semibold">Köszönjük!</h2>
              <p className="mt-2 text-sm text-muted-foreground">Megkaptuk az üzenetedet, hamarosan válaszolunk.</p>
              <Button variant="secondary" className="mt-6" onClick={() => setSent(false)} data-testid="contact-new-btn">Új üzenet írása</Button>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={submit}>
              <h2 className="font-display text-2xl font-semibold">Írj nekünk</h2>
              <Field label="Név *"><Input required value={form.name} onChange={set("name")} data-testid="contact-name-input" /></Field>
              <Field label="E-mail *"><Input required type="email" value={form.email} onChange={set("email")} data-testid="contact-email-input" /></Field>
              <Field label="Tárgy *"><Input required value={form.subject} onChange={set("subject")} data-testid="contact-subject-input" /></Field>
              <Field label="Üzenet *"><Textarea required rows={6} value={form.message} onChange={set("message")} data-testid="contact-message-input" /></Field>
              <Button type="submit" className="w-full" disabled={busy} data-testid="contact-submit-btn">
                <Send className="h-4 w-4" /> {busy ? "Küldés…" : "Üzenet elküldése"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </PublicShell>
  );
}

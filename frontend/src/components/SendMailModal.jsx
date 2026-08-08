import { useState } from "react";
import { toast } from "sonner";
import { Send, Mail, X } from "lucide-react";
import { api, apiErr } from "../lib/api";
import { Button, Field, Input, Modal, Textarea } from "./Fields";

export const SendMailModal = ({ open, onClose, kind, doc, defaultEmail, onSent }) => {
  const [to, setTo] = useState(defaultEmail || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/${kind === "quote" ? "quotes" : "invoices"}/${doc.id}/send`, { to, message });
      toast.success(`Elküldve: ${to}`);
      onSent?.();
      onClose();
    } catch (err) {
      toast.error(apiErr(err, "Az e-mail küldése nem sikerült"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={kind === "quote" ? "Ajánlat küldése e-mailben" : "Számla küldése e-mailben"}
      subtitle={`${doc?.number || ""} · ${doc?.title || ""}`}>
      <form className="space-y-5" onSubmit={send}>
        <Field label="Címzett e-mail *"><Input required type="email" value={to} onChange={(e) => setTo(e.target.value)} data-testid="send-mail-to-input" /></Field>
        <Field label="Kísérő szöveg"><Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Kedves Partnerünk! Csatoltan küldjük…" data-testid="send-mail-message-input" /></Field>
        <p className="text-xs text-muted-foreground">A levél tartalmazza a tételeket, a nettó/ÁFA/bruttó összegeket és a céges adataidat.</p>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose}><X className="h-4 w-4" /> Mégse</Button>
          <Button type="submit" disabled={busy} data-testid="send-mail-submit-btn"><Send className="h-4 w-4" /> Küldés</Button>
        </div>
      </form>
    </Modal>
  );
};

export const MailIcon = Mail;

import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Hammer, KeyRound } from "lucide-react";
import { api, apiErr } from "../lib/api";
import { Button, Field, Input } from "../components/Fields";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (password !== again) return toast.error("A két jelszó nem egyezik");
    setBusy(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      toast.success("A jelszó frissítve, jelentkezz be");
      navigate("/belepes");
    } catch (err) {
      toast.error(apiErr(err, "A visszaállítás nem sikerült"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background p-6" data-testid="reset-password-page">
      <div className="wm-card w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground"><Hammer className="h-5 w-5" /></div>
          <div>
            <div className="font-display text-lg font-semibold">WorkMate HU</div>
            <div className="text-[11px] tracking-[0.14em] text-muted-foreground">ÚJ JELSZÓ</div>
          </div>
        </div>
        {!token ? (
          <p className="text-sm text-muted-foreground">Hiányzó vagy érvénytelen link. Kérj új jelszó-visszaállítást a belépés oldalon.</p>
        ) : (
          <form className="space-y-5" onSubmit={submit}>
            <Field label="Új jelszó"><Input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="reset-password-input" /></Field>
            <Field label="Új jelszó újra"><Input required type="password" value={again} onChange={(e) => setAgain(e.target.value)} data-testid="reset-password-again-input" /></Field>
            <Button type="submit" className="w-full" disabled={busy} data-testid="reset-submit-btn"><KeyRound className="h-4 w-4" /> Jelszó mentése</Button>
          </form>
        )}
        <button className="mt-6 w-full text-sm text-muted-foreground hover:text-primary" onClick={() => navigate("/belepes")} data-testid="reset-back-btn">
          Vissza a belépéshez
        </button>
      </div>
    </div>
  );
}

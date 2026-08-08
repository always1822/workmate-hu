import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, AlertTriangle, Clock, Receipt, FileText, Check } from "lucide-react";
import { api } from "../lib/api";

const ICONS = { hatarido: Clock, szamla: Receipt, ajanlat: FileText };
const TONES = {
  danger: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300",
  warning: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300",
  info: "bg-primary/10 text-primary",
};

export const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get("/notifications")).data,
    refetchInterval: 120000,
  });
  const items = data?.items || [];

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        data-testid="notifications-btn"
        className="relative grid h-11 w-11 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
      >
        <Bell className="h-[18px] w-[18px]" />
        {items.length > 0 && (
          <span
            data-testid="notifications-badge"
            className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
          >
            {items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="wm-card absolute right-0 top-[52px] z-50 w-[340px] max-h-[420px] overflow-y-auto p-2" data-testid="notifications-panel">
          <div className="px-3 py-2 wm-label">Értesítések</div>
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center" data-testid="notifications-empty">
              <Check className="h-5 w-5 text-emerald-500" />
              <p className="text-sm text-muted-foreground">Nincs új értesítés – minden rendben.</p>
            </div>
          ) : (
            items.map((n) => {
              const Icon = ICONS[n.kind] || AlertTriangle;
              return (
                <button
                  key={n.id}
                  data-testid={`notification-${n.id}`}
                  onClick={() => {
                    navigate(n.route);
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-accent"
                >
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${TONES[n.level] || TONES.info}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{n.title}</div>
                    <div className="text-xs text-muted-foreground">{n.message}</div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

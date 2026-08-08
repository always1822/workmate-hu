import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Users, Hammer, FileText, Receipt, FolderOpen, Wallet, CornerDownLeft } from "lucide-react";
import { api } from "../lib/api";

const ICONS = {
  "Ügyfél": Users, "Munka": Hammer, "Ajánlat": FileText,
  "Számla": Receipt, "Dokumentum": FolderOpen, "Pénzügy": Wallet,
};

export const GlobalSearch = () => {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (q.trim().length < 2) return setResults([]);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get("/search", { params: { q } });
        setResults(data.results || []);
        setOpen(true);
      } catch {
        setResults([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (r) => {
    navigate(r.route);
    setOpen(false);
    setQ("");
  };

  return (
    <div ref={boxRef} className="relative hidden max-w-sm flex-1 sm:block">
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        data-testid="global-search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => results.length && setOpen(true)}
        placeholder="Keresés ügyfél, munka, ajánlat…"
        className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/15"
      />
      {open && q.trim().length >= 2 && (
        <div className="wm-card absolute left-0 right-0 top-[52px] z-50 max-h-[420px] overflow-y-auto p-2" data-testid="search-results">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground" data-testid="search-empty">Nincs találat</div>
          ) : (
            results.map((r) => {
              const Icon = ICONS[r.kind] || Search;
              return (
                <button
                  key={`${r.kind}-${r.id}`}
                  onClick={() => go(r)}
                  data-testid={`search-result-${r.id}`}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-accent"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{r.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{r.kind}{r.subtitle ? ` · ${r.subtitle}` : ""}</div>
                  </div>
                  <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

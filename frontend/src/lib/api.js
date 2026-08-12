import axios from "axios";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const TOKEN_KEY = "wm-token";

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem(TOKEN_KEY);
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

export const apiErr = (e, fallback = "Hiba történt") => {
  if (e?.response) {
    const d = e.response.data?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return d.map((x) => x?.msg || "").join(" ") || fallback;
    if (typeof e.response.data === "string") return e.response.data;
    return fallback;
  }
  if (e?.request) return "A szerver nem érhető el – ellenőrizd, hogy a backend fut-e.";
  return e?.message || fallback;
};

export const pdfUrl = (path) => `${API}${path}?token=${localStorage.getItem(TOKEN_KEY) || ""}`;

export const fileUrl = (storagePath) => `${API}/files/${storagePath}?auth=${localStorage.getItem(TOKEN_KEY) || ""}`;

export const openPdf = async (path) => {
  const res = await api.get(path, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  window.open(url, "_blank");
};

export const fmtHuf = (v) =>
  new Intl.NumberFormat("hu-HU", { style: "currency", currency: "HUF", maximumFractionDigits: 0 }).format(Number(v || 0));

export const fmtDate = (v) => (v ? String(v).slice(0, 10) : "—");

export const JOB_STATUS = {
  tervezett: { label: "Tervezett", cls: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300" },
  folyamatban: { label: "Folyamatban", cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" },
  elkeszult: { label: "Elkészült", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" },
};

export const QUOTE_STATUS = {
  letrehozva: { label: "Létrehozva", cls: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/10 dark:text-cyan-300" },
  elfogadva: { label: "Elfogadva", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" },
  elutasitva: { label: "Elutasítva", cls: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300" },
};

export const PAYMENT_CATEGORIES = {
  anyag: "Anyag",
  uzemanyag: "Üzemanyag",
  berlet: "Bérlet / eszköz",
  alvallalkozo: "Alvállalkozó",
  szolgaltatas: "Szolgáltatás",
  ber: "Bér",
  egyeb: "Egyéb",
};

export const INVOICE_STATUS = {
  vazlat: { label: "Vázlat", cls: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300" },
  kiallitva: { label: "Kiállítva", cls: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" },
  lejart: { label: "Lejárt", cls: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300" },
  fizetve: { label: "Fizetve", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" },
};

export const PRIORITY = { alacsony: "Alacsony", kozepes: "Közepes", magas: "Magas" };

export const quoteTotals = (q) => {
  const net = (q.items || []).reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0)
    + Number(q.material_cost || 0) + Number(q.labor_cost || 0);
  const vat = (net * Number(q.vat_rate || 0)) / 100;
  return { net, vat, gross: net + vat };
};

export const invTotal = (inv) => Number(inv.total ?? quoteTotals(inv).gross);

export const downloadFile = async (storagePath, name = "fajl") => {
  const res = await api.get(`/files/${storagePath}`, { responseType: "blob" });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

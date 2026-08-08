import { cn } from "../lib/utils";
import { X } from "lucide-react";

const base =
  "h-12 w-full rounded-xl border border-border bg-card px-4 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/15";

export const Field = ({ label, children }) => (
  <label className="block">
    <span className="wm-label mb-2 block">{label}</span>
    {children}
  </label>
);

export const Input = ({ className, ...p }) => <input className={cn(base, className)} {...p} />;

export const Select = ({ className, children, ...p }) => (
  <select className={cn(base, "appearance-none pr-10", className)} {...p}>{children}</select>
);

export const Textarea = ({ className, ...p }) => (
  <textarea rows={4} className={cn(base, "h-auto py-3 leading-relaxed", className)} {...p} />
);

export const Button = ({ variant = "primary", className, ...p }) => (
  <button
    className={cn(
      "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-all duration-200 disabled:opacity-50",
      variant === "primary" &&
        "bg-primary text-primary-foreground shadow-[0_6px_18px_-8px_rgba(6,182,212,0.9)] hover:bg-[#0891b2] hover:-translate-y-[1px]",
      variant === "secondary" && "border border-border bg-card text-foreground hover:bg-accent",
      variant === "ghost" && "text-muted-foreground hover:bg-accent hover:text-foreground",
      variant === "danger" && "bg-destructive text-destructive-foreground hover:opacity-90",
      className,
    )}
    {...p}
  />
);

export const Modal = ({ open, onClose, title, subtitle, children, wide }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:p-8" data-testid="modal">
      <div className={cn("wm-rise wm-card my-auto w-full p-6 sm:p-8", wide ? "max-w-3xl" : "max-w-xl")}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <button onClick={onClose} data-testid="modal-close" className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

export const TableWrap = ({ children }) => (
  <div className="wm-card overflow-hidden">
    <div className="wm-scroll overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">{children}</table>
    </div>
  </div>
);

export const Th = ({ className, children }) => (
  <th className={cn("bg-accent/60 px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground", className)}>{children}</th>
);

export const Td = ({ className, children, ...p }) => (
  <td className={cn("border-t border-border px-6 py-4 align-middle", className)} {...p}>{children}</td>
);

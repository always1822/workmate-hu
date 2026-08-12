import { useEffect, useState } from "react";
import { NavLink, useLocation, Link } from "react-router-dom";
import { LayoutDashboard, Users, Hammer, FileText, FolderOpen, Menu, X, Moon, Sun, ChevronLeft, Receipt, Settings2, LogOut } from "lucide-react";
import { cn } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";
import { PublicFooter } from "./PublicShell";

// A fő menü sorrendje a fő üzleti folyamatot követi: Ügyfél → Ajánlat → Munka → Számla → Fizetve
const MAIN_NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, id: "dashboard" },
  { to: "/ugyfelek", label: "Ügyfelek", icon: Users, id: "customers" },
  { to: "/ajanlatok", label: "Ajánlatok", icon: FileText, id: "quotes" },
  { to: "/munkak", label: "Munkák", icon: Hammer, id: "jobs" },
  { to: "/szamlak", label: "Számlák", icon: Receipt, id: "invoices" },
];

// A többi funkció (Pénzügy, Riportok, Naptár, Munkanapló, Dokumentumok, Céges profil)
// a fő oldalakba van építve – a menüben csak a rendszerbeállítás marad.
const SECONDARY_NAV = [
  { to: "/beallitasok", label: "Beállítások", icon: Settings2, id: "settings" },
];

const NavItem = ({ to, label, icon: Icon, id, collapsed, main }) => (
  <NavLink
    to={to}
    end={to === "/"}
    data-testid={`nav-${id}`}
    className={({ isActive }) =>
      cn(
        "group relative flex items-center rounded-xl transition-colors duration-200",
        main ? "gap-3 px-3 py-3 text-[15px] font-bold" : "gap-2.5 px-3 py-2 text-[13px] font-medium",
        isActive
          ? "bg-primary text-primary-foreground shadow-[0_6px_18px_-8px_rgba(6,182,212,0.9)]"
          : main
            ? "text-foreground hover:bg-accent hover:text-primary"
            : "text-muted-foreground/80 hover:bg-accent hover:text-foreground",
      )
    }
  >
    <Icon className={cn("shrink-0 transition-transform duration-200 group-hover:scale-110", main ? "h-5 w-5" : "h-4 w-4")} />
    {!collapsed && <span className="truncate">{label}</span>}
  </NavLink>
);

const useTheme = () => {
  const [dark, setDark] = useState(() => localStorage.getItem("wm-theme") === "dark");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("wm-theme", dark ? "dark" : "light");
  }, [dark]);
  return [dark, setDark];
};

export const Shell = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useTheme();
  const location = useLocation();
  const { user, logout } = useAuth();

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen bg-background">
      {open && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} data-testid="sidebar-overlay" />
      )}

      <aside
        data-testid="sidebar"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-[hsl(var(--sidebar))] transition-[width,transform] duration-300 ease-out",
          collapsed ? "w-[84px]" : "w-[264px]",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-[72px] shrink-0 items-center gap-3 px-5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_6px_18px_-6px_rgba(6,182,212,0.8)]">
            <Hammer className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display text-[17px] font-semibold leading-tight">WorkMate</div>
              <div className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground">HU · BUSINESS OS</div>
            </div>
          )}
          <button className="ml-auto lg:hidden" onClick={() => setOpen(false)} data-testid="sidebar-close">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <nav className="wm-scroll flex-1 overflow-y-auto px-3 py-4">
          {!collapsed && <div className="wm-label px-3 pb-3 text-[11px] tracking-[0.16em]">FŐ MENÜ</div>}
          <div className="space-y-1">
            {MAIN_NAV.map((n) => <NavItem key={n.to} {...n} collapsed={collapsed} main />)}
          </div>
          {!collapsed ? (
            <div className="my-4 border-t border-border" />
          ) : (
            <div className="mx-auto my-4 h-6 w-px bg-border" />
          )}
          {!collapsed && <div className="wm-label px-3 pb-3 text-[11px] tracking-[0.16em]">EGYÉB</div>}
          <div className="space-y-1">
            {SECONDARY_NAV.map((n) => <NavItem key={n.to} {...n} collapsed={collapsed} />)}
          </div>
        </nav>

        <div className="shrink-0 border-t border-border p-3">
          <button
            data-testid="sidebar-collapse"
            onClick={() => setCollapsed((c) => !c)}
            className="hidden w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:flex"
          >
            <ChevronLeft className={cn("h-[18px] w-[18px] transition-transform duration-300", collapsed && "rotate-180")} />
            {!collapsed && <span>Összecsukás</span>}
          </button>
          <button
            data-testid="sidebar-logout"
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
          >
            <LogOut className="h-[18px] w-[18px]" />
            {!collapsed && <span>Kijelentkezés</span>}
          </button>
        </div>
      </aside>

      <div className={cn("transition-[padding] duration-300", collapsed ? "lg:pl-[84px]" : "lg:pl-[264px]")}>
        <header className="sticky top-0 z-20 flex h-[72px] items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-xl lg:px-10">
          <button className="lg:hidden" onClick={() => setOpen(true)} data-testid="sidebar-open">
            <Menu className="h-5 w-5" />
          </button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-2">
            <button
              data-testid="theme-toggle"
              onClick={() => setDark(!dark)}
              className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
            >
              {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>
            <NotificationBell />
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card py-1.5 pl-1.5 pr-4" data-testid="user-chip">
              <img
                alt="profil"
                src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?crop=entropy&cs=srgb&fm=jpg&w=80&q=70"
                className="h-8 w-8 rounded-lg object-cover"
              />
              <div className="hidden leading-tight sm:block">
                <div className="text-[13px] font-semibold">{user?.name || "Vállalkozó"}</div>
                <div className="text-[11px] text-muted-foreground">{user?.company_name || "Prémium csomag"}</div>
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10 lg:py-10">{children}</main>
        <PublicFooter />
      </div>
    </div>
  );
};

export const PageHeader = ({ title, subtitle, children }) => (
  <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 className="font-display text-3xl font-semibold sm:text-4xl" data-testid="page-title">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-muted-foreground sm:text-base">{subtitle}</p>}
    </div>
    {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
  </div>
);

export const Card = ({ className, children, ...rest }) => (
  <div className={cn("wm-card p-6 sm:p-7", className)} {...rest}>{children}</div>
);

export const Badge = ({ cls, children }) => (
  <span className={cn("inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold", cls)}>{children}</span>
);

export const Empty = ({ text, icon: Icon = FolderOpen }) => (
  <div className="flex flex-col items-center gap-3 py-16 text-center" data-testid="empty-state">
    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-accent text-muted-foreground"><Icon className="h-6 w-6" /></div>
    <p className="text-sm text-muted-foreground">{text}</p>
  </div>
);

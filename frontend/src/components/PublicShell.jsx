import { Link } from "react-router-dom";
import { Hammer } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export const PublicFooter = () => (
  <footer className="border-t border-border bg-card/60 px-6 py-8" data-testid="public-footer">
    <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground"><Hammer className="h-4 w-4" /></div>
        <div>
          <div className="font-display text-sm font-semibold">WorkMate HU</div>
          <div className="text-[11px] text-muted-foreground">Magyar vállalkozók digitális munkatársa</div>
        </div>
      </div>
      <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <Link to="/arak" className="transition-colors hover:text-primary" data-testid="footer-pricing-link">Árak</Link>
        <Link to="/kapcsolat" className="transition-colors hover:text-primary" data-testid="footer-contact-link">Kapcsolat</Link>
        <Link to="/adatkezeles" className="transition-colors hover:text-primary" data-testid="footer-privacy-link">Adatkezelési tájékoztató</Link>
        <Link to="/aszf" className="transition-colors hover:text-primary" data-testid="footer-terms-link">ÁSZF</Link>
        <Link to="/impresszum" className="transition-colors hover:text-primary" data-testid="footer-imprint-link">Impresszum</Link>
      </nav>
      <div className="text-xs text-muted-foreground" data-testid="footer-copyright">© {new Date().getFullYear()} WorkMate HU</div>
    </div>
  </footer>
);

export const PublicShell = ({ children }) => {
  const auth = useAuth();
  const loggedIn = !!auth?.user;
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card/70 px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link to={loggedIn ? "/" : "/belepes"} className="flex items-center gap-3" data-testid="public-logo-link">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Hammer className="h-5 w-5" /></div>
            <div>
              <div className="font-display text-base font-semibold">WorkMate</div>
              <div className="text-[10px] tracking-[0.16em] text-muted-foreground">HU · BUSINESS OS</div>
            </div>
          </Link>
          <Link to={loggedIn ? "/" : "/belepes"} className="text-sm font-semibold text-primary hover:underline" data-testid="public-login-link">
            {loggedIn ? "Vissza az alkalmazásba" : "Belépés"}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">{children}</main>
      <PublicFooter />
    </div>
  );
};

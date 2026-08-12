import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Shell } from "@/components/Shell";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import Contact from "@/pages/Contact";
import Legal from "@/pages/Legal";
import Pricing from "@/pages/Pricing";
import Dashboard from "@/pages/Dashboard";
import Customers from "@/pages/Customers";
import CustomerDetail from "@/pages/CustomerDetail";
import Jobs from "@/pages/Jobs";
import JobDetail from "@/pages/JobDetail";
import Quotes from "@/pages/Quotes";
import Invoices from "@/pages/Invoices";
import Finance from "@/pages/Finance";
import Reports from "@/pages/Reports";
import Calendar from "@/pages/Calendar";
import WorkLog from "@/pages/WorkLog";
import Documents from "@/pages/Documents";
import Company from "@/pages/Company";
import Settings from "@/pages/Settings";

const PUBLIC = [
  { path: "/arak", element: <Pricing /> },
  { path: "/kapcsolat", element: <Contact /> },
  { path: "/adatkezeles", element: <Legal page="adatkezeles" /> },
  { path: "/aszf", element: <Legal page="aszf" /> },
  { path: "/impresszum", element: <Legal page="impresszum" /> },
];

const Gate = () => {
  const { user } = useAuth();
  if (user === null) {
    return (
      <div className="grid min-h-screen place-items-center" data-testid="auth-loading">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }
  if (user === false) {
    return (
      <Routes>
        <Route path="/belepes" element={<Auth />} />
        <Route path="/uj-jelszo" element={<ResetPassword />} />
        {PUBLIC.map((r) => <Route key={r.path} path={r.path} element={r.element} />)}
        <Route path="*" element={<Navigate to="/belepes" replace />} />
      </Routes>
    );
  }
  return (
    <Routes>
      {PUBLIC.map((r) => <Route key={r.path} path={r.path} element={r.element} />)}
      <Route
        path="*"
        element={
          <Shell>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/ugyfelek" element={<Customers />} />
              <Route path="/ugyfelek/:id" element={<CustomerDetail />} />
              <Route path="/munkak" element={<Jobs />} />
              <Route path="/munkak/:id" element={<JobDetail />} />
              <Route path="/ajanlatok" element={<Quotes />} />
              <Route path="/szamlak" element={<Invoices />} />
              <Route path="/penzugy" element={<Finance />} />
              <Route path="/riportok" element={<Reports />} />
              <Route path="/naptar" element={<Calendar />} />
              <Route path="/munkanaplo" element={<WorkLog />} />
              <Route path="/dokumentumok" element={<Documents />} />
              <Route path="/ceges-profil" element={<Company />} />
              <Route path="/beallitasok" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Shell>
        }
      />
    </Routes>
  );
};

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Gate />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

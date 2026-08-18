import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ReputationBadge } from "./ReputationBadge";

const NAV_LINKS = [
  { to: "/", label: "Dashboard" },
  { to: "/report", label: "Report Threat" },
  { to: "/zero-trust", label: "Zero-Trust Sim" },
  { to: "/policies", label: "Policies" },
  { to: "/globe", label: "Threat Globe" },
  { to: "/analytics", label: "Analytics" },
  { to: "/audit", label: "Audit Trail" },
];

export function Layout() {
  const { organization, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-semibold tracking-tight">SIXSYNC</span>
            <nav className="flex gap-1">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `rounded-md px-3 py-1.5 text-sm transition-colors ${
                      isActive ? "bg-sky-500/20 text-sky-300" : "text-slate-400 hover:text-slate-200"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>
          {organization && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-300">{organization.name}</span>
              <ReputationBadge reputation={organization.reputation} />
              <button
                onClick={() => {
                  logout();
                  navigate("/onboarding");
                }}
                className="text-slate-500 hover:text-slate-300 text-xs"
              >
                sign out
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

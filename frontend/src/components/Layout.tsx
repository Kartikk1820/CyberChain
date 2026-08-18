import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3,
  FileWarning,
  Globe2,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings2,
  ShieldCheck,
  ShieldHalf,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ReputationBadge } from "./ReputationBadge";
import { Avatar, AvatarFallback } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/report", label: "Report Threat", icon: FileWarning },
  { to: "/zero-trust", label: "Zero-Trust Sim", icon: ShieldCheck },
  { to: "/policies", label: "Policies", icon: Settings2 },
  { to: "/globe", label: "Threat Globe", icon: Globe2 },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/audit", label: "Audit Trail", icon: ScrollText },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function Layout() {
  const { organization, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/80 glass">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/25 to-accent/25 ring-1 ring-primary/30">
                <ShieldHalf className="h-4 w-4 text-primary" />
              </div>
              <span className="font-semibold tracking-tight text-[15px] bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                CyberChain
              </span>
            </div>
            <nav className="flex gap-1 overflow-x-auto">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25)]"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                    )
                  }
                >
                  <link.icon className="h-3.5 w-3.5" />
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {organization && (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-full pl-1 pr-3 py-1 hover:bg-secondary/60 transition-colors shrink-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <Avatar className="h-7 w-7">
                  <AvatarFallback>{initials(organization.name)}</AvatarFallback>
                </Avatar>
                <span className="text-sm text-foreground hidden sm:inline">{organization.name}</span>
                <ReputationBadge reputation={organization.reputation} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{organization.name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => {
                    logout();
                    navigate("/onboarding");
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

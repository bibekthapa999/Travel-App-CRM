import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, KanbanSquare, Map, CalendarCheck, Building2, ReceiptIndianRupee,
  Users, ChevronsLeft, Menu, LogOut, Moon, Sun, Palmtree,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "sales", "operations", "finance"] },
  { to: "/leads", label: "Leads", icon: KanbanSquare, roles: ["admin", "sales"] },
  { to: "/itineraries", label: "Itineraries", icon: Map, roles: ["admin", "sales"] },
  { to: "/bookings", label: "Bookings", icon: CalendarCheck, roles: ["admin", "sales", "operations"] },
  { to: "/vendors", label: "Vendors", icon: Building2, roles: ["admin", "sales", "operations"] },
  { to: "/invoices", label: "Invoices", icon: ReceiptIndianRupee, roles: ["admin", "finance"] },
  { to: "/users", label: "Team", icon: Users, roles: ["admin"] },
];

const ROLE_LABELS = { admin: "Admin", sales: "Sales Agent", operations: "Operations", finance: "Finance" };

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);

  const toggleTheme = () => {
    setDark((d) => {
      document.documentElement.classList.toggle("dark", !d);
      return !d;
    });
  };

  const items = NAV.filter((n) => user && n.roles.includes(user.role));

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 px-4 h-16 border-b border-border shrink-0">
        <div className="w-8 h-8 rounded-md bg-primary grid place-items-center shrink-0">
          <Palmtree className="w-4.5 h-4.5 w-5 h-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-heading font-bold text-sm leading-tight truncate">Thapa Holidays</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Travel CRM</p>
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1" data-testid="sidebar-nav">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={() => setMobileOpen(false)}
            data-testid={`nav-${label.toLowerCase()}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              } ${collapsed ? "justify-center" : ""}`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="p-2 border-t border-border hidden lg:block">
        <Button
          variant="ghost" size="sm" className="w-full justify-center" data-testid="sidebar-collapse-btn"
          onClick={() => setCollapsed((c) => !c)}
        >
          <ChevronsLeft className={`w-4 h-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside
        className={`hidden lg:block border-r border-border bg-card shrink-0 transition-[width] duration-200 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {sidebar}
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-card border-r border-border z-50">{sidebar}</aside>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card flex items-center gap-3 px-4 lg:px-6 shrink-0">
          <Button variant="ghost" size="icon" className="lg:hidden" data-testid="mobile-menu-btn" onClick={() => setMobileOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" data-testid="theme-toggle-btn" onClick={toggleTheme}>
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted transition-colors" data-testid="user-menu-btn">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary grid place-items-center font-heading font-bold text-sm">
                  {user?.name?.[0]?.toUpperCase() || "U"}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium leading-tight">{user?.name}</p>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-full">{ROLE_LABELS[user?.role]}</Badge>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                data-testid="logout-btn"
                onClick={async () => { await logout(); navigate("/login"); }}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

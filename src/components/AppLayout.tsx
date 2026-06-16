import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Wallet, AlertTriangle, FileText, Users, Home, FileSignature, UserMinus, Bell, Calendar, UserPlus, ClipboardList, BarChart3, MessageCircle, Bot } from "lucide-react";
import logo from "@/assets/mesquita-logo.png";
import { cn } from "@/lib/utils";
import { BotBell } from "@/components/BotBell";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/crm", label: "CRM / Leads", icon: UserPlus },
  { to: "/assistente", label: "Assistente", icon: Bot },
  { to: "/agenda", label: "Agenda", icon: ClipboardList },
  { to: "/financeiro", label: "Financeiro", icon: Wallet },
  { to: "/inadimplencia", label: "Inadimplência", icon: AlertTriangle },
  { to: "/recibos", label: "Recibos", icon: FileText },
  { to: "/inquilinos", label: "Inquilinos", icon: Users },
  { to: "/imoveis", label: "Imóveis", icon: Home },
  { to: "/contratos", label: "Contratos", icon: FileSignature },
  { to: "/ex-inquilinos", label: "Ex-inquilinos", icon: UserMinus },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/alertas", label: "Alertas", icon: Bell },
  { to: "/calendario", label: "Calendário", icon: Calendar },
] as const;


export function AppLayout() {
  const { location } = useRouterState();
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-64 shrink-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="p-5 border-b border-sidebar-border">
          <img src={logo} alt="Mesquita Imóveis" className="w-full" />
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.map(item => {
            const active = item.to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 text-xs text-sidebar-foreground/60 border-t border-sidebar-border">
          Mesquita Administração de Imóveis
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="border-b bg-card">
      <div className="px-8 py-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
        <div className="flex items-center gap-3">
          <BotBell />
          {actions}
        </div>
      </div>
    </div>
  );
}

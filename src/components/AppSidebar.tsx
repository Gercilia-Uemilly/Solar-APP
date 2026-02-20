import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, ClipboardList, FileText, MessageSquare, Bell, LogOut } from "lucide-react";

const menuItems = [
  { label: "Painel", icon: LayoutDashboard, path: "/" },
  { label: "Demandas", icon: ClipboardList, path: "/demandas" },
  { label: "Ofícios", icon: FileText, path: "/oficios" },
  { label: "Scripts", icon: MessageSquare, path: "/scripts" },
];

export default function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-[160px] bg-sidebar flex flex-col border-r border-sidebar-border z-50">
      {/* Logo */}
      <div className="p-4 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
          GVF
        </div>
        <div>
          <div className="text-sm font-semibold text-foreground">GVF</div>
          <div className="text-[10px] text-muted-foreground">Gabinete do Vereador</div>
        </div>
      </div>

      {/* Menu */}
      <nav className="flex-1 px-2 mt-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-3 mb-2">Menu</div>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-sidebar-border">
        <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent w-full">
          <Bell size={16} />
          Notificações
        </button>
        <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent w-full">
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
  );
}

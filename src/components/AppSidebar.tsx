import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, FileText, MessageSquare, FolderOpen, ChevronLeft, ChevronRight, Users, BarChart3, Settings, Database, Heart } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import logoSolar from "@/assets/logo-solar.png";

const menuItems = [
  { label: "Painel", icon: LayoutDashboard, path: "/", adminOnly: false },
  { label: "Novo Ofício", icon: FileText, path: "/oficios", adminOnly: false },
  { label: "Meus Ofícios", icon: FolderOpen, path: "/meus-oficios", adminOnly: false },
  { label: "Scripts", icon: MessageSquare, path: "/scripts", adminOnly: false },
  { label: "Banco de Info", icon: Database, path: "/banco-informacoes", adminOnly: false },
  { label: "Operadores", icon: Users, path: "/operadores", adminOnly: true },
  { label: "Relatórios", icon: BarChart3, path: "/relatorios", adminOnly: true },
  { label: "Configurações", icon: Settings, path: "/configuracoes", adminOnly: false },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export default function AppSidebar({ collapsed, onToggle }: Props) {
  const location = useLocation();
  const { isAdmin } = useAuth();

  const visibleItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <motion.aside
      className="fixed left-0 top-0 bottom-0 bg-sidebar/95 backdrop-blur-xl flex flex-col border-r border-sidebar-border z-50"
      animate={{ width: collapsed ? 64 : 220 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
    >
      {/* Logo */}
      <div className="p-3 flex items-center gap-3 border-b border-sidebar-border min-h-[56px]">
        <img src={logoSolar} alt="Solar" className="w-8 h-8 rounded-lg object-contain flex-shrink-0" />
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="text-sm font-medium text-foreground leading-tight">Solar</div>
            <div className="text-[10px] text-muted-foreground">Sistema de Gerenciamento de Mandato</div>
          </motion.div>
        )}
      </div>

      {/* Menu */}
      <nav className="flex-1 px-2 mt-4 space-y-1">
        {!collapsed && (
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground px-3 mb-2 font-medium">
            Menu
          </div>
        )}
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                isActive
                  ? "bg-primary text-primary-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon size={18} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-sidebar-border">
        <button
          onClick={onToggle}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent w-full transition-colors"
        >
          {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /> <span>Recolher</span></>}
        </button>
      </div>
    </motion.aside>
  );
}

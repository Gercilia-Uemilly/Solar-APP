import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, FileText, MessageSquare, FolderOpen, ChevronLeft, ChevronRight,
  Users, BarChart3, Settings, Heart, HelpCircle, Headphones, Library, Info,
  Smartphone, MessagesSquare
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import logoSolar from "@/assets/logo-solar.png";

const menuItems = [
  { label: "Painel", icon: LayoutDashboard, path: "/", adminOnly: false },
  { label: "Novo Ofício", icon: FileText, path: "/oficios", adminOnly: false },
  { label: "Todos os Ofícios", icon: FolderOpen, path: "/meus-oficios", adminOnly: false },
  { label: "Respostas", icon: Heart, path: "/respostas", adminOnly: false },
  
  { label: "Banco de Info", icon: Library, path: "/banco-informacoes", adminOnly: false },
  { label: "WhatsApp", icon: Smartphone, path: "/whatsapp", adminOnly: false },
  { label: "Mensagens WA", icon: MessagesSquare, path: "/whatsapp-mensagens", adminOnly: false },
  { label: "Operadores", icon: Users, path: "/operadores", adminOnly: true },
  { label: "Relatórios", icon: BarChart3, path: "/relatorios", adminOnly: true },
  { label: "Configurações", icon: Settings, path: "/configuracoes", adminOnly: false },
  { label: "Sobre", icon: Info, path: "/sobre", adminOnly: false },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  onOpenTour?: () => void;
  onOpenSupport?: () => void;
}

export default function AppSidebar({ collapsed, onToggle, onOpenTour, onOpenSupport }: Props) {
  const location = useLocation();
  const { isAdmin } = useAuth();

  const visibleItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <motion.aside
      className="fixed left-0 top-0 bottom-0 bg-sidebar flex flex-col border-r border-sidebar-border z-50"
      animate={{ width: collapsed ? 56 : 220 }}
      transition={{ duration: 0.15, ease: "easeInOut" }}
    >
      {/* Logo */}
      <div className="px-3 py-4 flex items-center gap-2.5 border-b border-sidebar-border min-h-[52px]">
        <img src={logoSolar} alt="Solar" className="w-7 h-7 rounded-md object-contain flex-shrink-0" />
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.05, duration: 0.15 }}
          >
            <div className="text-[13px] font-semibold text-foreground leading-tight tracking-tight">Solar</div>
            <div className="text-2xs text-muted-foreground leading-tight">Gerenciamento de Mandato</div>
          </motion.div>
        )}
      </div>

      {/* Menu */}
      <nav className="flex-1 px-2 mt-3 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <div className="text-2xs uppercase tracking-wider text-muted-foreground/60 px-2.5 mb-2 font-medium">
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
              className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13px] transition-all duration-150 ${
                isActive
                  ? "bg-accent text-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              <item.icon size={16} strokeWidth={isActive ? 2 : 1.5} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-sidebar-border space-y-0.5">
        <button
          onClick={onOpenTour}
          title="Tutorial de uso"
          className="flex items-center justify-center gap-2 px-2.5 py-[7px] rounded-md text-[13px] text-sidebar-foreground hover:bg-accent/60 hover:text-foreground w-full transition-colors duration-150"
        >
          <HelpCircle size={15} strokeWidth={1.5} className="flex-shrink-0" />
          {!collapsed && <span>Tutorial</span>}
        </button>
        <button
          onClick={onOpenSupport}
          title="Suporte"
          className="flex items-center justify-center gap-2 px-2.5 py-[7px] rounded-md text-[13px] text-sidebar-foreground hover:bg-accent/60 hover:text-foreground w-full transition-colors duration-150"
        >
          <Headphones size={15} strokeWidth={1.5} className="flex-shrink-0" />
          {!collapsed && <span>Suporte</span>}
        </button>
        <button
          onClick={onToggle}
          className="flex items-center justify-center gap-2 px-2.5 py-[7px] rounded-md text-[13px] text-sidebar-foreground hover:bg-accent/60 hover:text-foreground w-full transition-colors duration-150"
        >
          {collapsed ? <ChevronRight size={15} strokeWidth={1.5} /> : <><ChevronLeft size={15} strokeWidth={1.5} /> <span>Recolher</span></>}
        </button>
      </div>
    </motion.aside>
  );
}

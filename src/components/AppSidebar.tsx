import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FileText, MessageSquare, FolderOpen, ChevronLeft, ChevronRight,
  Users, BarChart3, Settings, Heart, HelpCircle, Headphones, Library, Info,
  Smartphone, MessagesSquare, BookOpen, Hash, Trash2, DatabaseBackup
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import logoSolar from "@/assets/logo-solar.png";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const menuItems = [
  { label: "Painel", icon: LayoutDashboard, path: "/", adminOnly: false },
  { label: "Novo Ofício", icon: FileText, path: "/oficios", adminOnly: false, action: "openNew" },
  { label: "Todos os Ofícios", icon: FolderOpen, path: "/meus-oficios", adminOnly: false },
  { label: "Modelos", icon: BookOpen, path: "/modelos", adminOnly: false },
  { label: "Numeração", icon: Hash, path: "/numeracao", adminOnly: false },
  { label: "Respostas", icon: Heart, path: "/respostas", adminOnly: false },
  { label: "Chat", icon: MessageSquare, path: "/chat", adminOnly: false },
  { label: "Banco de Info", icon: Library, path: "/banco-informacoes", adminOnly: false },
  { label: "WhatsApp", icon: Smartphone, path: "/whatsapp", adminOnly: true },
  { label: "Mensagens WA", icon: MessagesSquare, path: "/whatsapp-mensagens", adminOnly: true },
  { label: "Operadores", icon: Users, path: "/operadores", adminOnly: true },
  { label: "Relatórios", icon: BarChart3, path: "/relatorios", adminOnly: true },
  { label: "Lixeira", icon: Trash2, path: "/lixeira", adminOnly: false },
  { label: "Backups", icon: DatabaseBackup, path: "/backups", adminOnly: true },
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
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadChat, setUnreadChat] = useState(0);

  // Fetch pending users count for admin badge
  useEffect(() => {
    if (!isAdmin) return;
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pendente")
      .then(({ count }) => setPendingCount(count || 0));
  }, [isAdmin]);

  // Fetch unread chat messages
  useEffect(() => {
    if (!user) return;
    supabase.from("mensagens").select("id", { count: "exact", head: true })
      .eq("lida", false).or(`para_user_id.eq.${user.id},para_user_id.is.null`)
      .neq("de_user_id", user.id)
      .then(({ count }) => setUnreadChat(count || 0));

    const ch = supabase.channel("sidebar-chat-badge")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens" }, () => {
        supabase.from("mensagens").select("id", { count: "exact", head: true })
          .eq("lida", false).or(`para_user_id.eq.${user.id},para_user_id.is.null`)
          .neq("de_user_id", user.id)
          .then(({ count }) => setUnreadChat(count || 0));
      })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [user]);

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
          const badge = item.path === "/operadores" && pendingCount > 0
            ? pendingCount
            : item.path === "/chat" && unreadChat > 0
            ? unreadChat
            : 0;
          const handleClick = (e: React.MouseEvent) => {
            if ((item as any).action === "openNew") {
              e.preventDefault();
              document.body.style.overflow = 'auto';
              document.body.style.pointerEvents = 'auto';
              if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
              navigate(item.path, { state: { openNew: true, ts: Date.now() } });
            }
          };
          return (
            <Link
              key={item.path + ((item as any).action || "")}
              to={item.path}
              state={(item as any).action === "openNew" ? { openNew: true, ts: Date.now() } : undefined}
              onClick={handleClick}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13px] transition-all duration-150 ${
                isActive
                  ? "bg-accent text-foreground font-medium"
                  : "text-sidebar-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
            >
              <item.icon size={16} strokeWidth={isActive ? 2 : 1.5} className="flex-shrink-0" />
              {!collapsed && <span className="truncate flex-1">{item.label}</span>}
              {badge > 0 && (
                <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
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

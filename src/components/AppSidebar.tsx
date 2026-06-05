import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FileText, MessageSquare, FolderOpen, ChevronLeft, ChevronRight,
  Users, BarChart3, Settings, Heart, HelpCircle, Library, Info,
  BookOpen, Hash, Trash2, DatabaseBackup, Bell, Upload, Download
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logoSolar from "@/assets/logo-solar.png";

const menuSections = [
  {
    title: "Principal",
    items: [
      { label: "Painel", icon: LayoutDashboard, path: "/", adminOnly: false },
      { label: "Novo Ofício", icon: FileText, path: "/oficios", adminOnly: false, action: "openNew" },
      { label: "Todos os Ofícios", icon: FolderOpen, path: "/meus-oficios", adminOnly: false },
      { label: "Subir Ofício", icon: Upload, path: "/meus-oficios?upload=1", adminOnly: false },
      { label: "Numeração", icon: Hash, path: "/numeracao", adminOnly: false },
    ],
  },
  {
    title: "Comunicação",
    items: [
      { label: "Respostas", icon: Heart, path: "/respostas", adminOnly: false },
      { label: "Chat Interno", icon: MessageSquare, path: "/chat", adminOnly: false },
      { label: "Banco de Info", icon: Library, path: "/banco-informacoes", adminOnly: false },
      { label: "Lembretes", icon: Bell, path: "/lembretes", adminOnly: false },
    ],
  },
  {
    title: "Administração",
    items: [
      { label: "Operadores", icon: Users, path: "/operadores", adminOnly: true },
      { label: "Relatórios", icon: BarChart3, path: "/relatorios", adminOnly: true },
      { label: "Backups", icon: DatabaseBackup, path: "/backups", adminOnly: true },
    ],
  },
  {
    title: "Sistema",
    items: [
      { label: "Lixeira", icon: Trash2, path: "/lixeira", adminOnly: false },
      { label: "Instalar App", icon: Download, path: "/instalar", adminOnly: false },
      { label: "Configurações", icon: Settings, path: "/configuracoes", adminOnly: false },
      { label: "Ajuda e Suporte", icon: HelpCircle, path: "/ajuda", adminOnly: false },
      { label: "Sobre", icon: Info, path: "/sobre", adminOnly: false },
    ],
  },
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

  useEffect(() => {
    if (!isAdmin) return;
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pendente")
      .then(({ count }) => setPendingCount(count || 0));
  }, [isAdmin]);

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

  const getBadge = (path: string) => {
    if (path === "/operadores" && pendingCount > 0) return pendingCount;
    if (path === "/chat" && unreadChat > 0) return unreadChat;
    return 0;
  };

  return (
    <motion.aside
      className="fixed left-0 top-0 bottom-0 z-50 flex flex-col border-r border-white/10"
      style={{ background: "hsl(var(--sidebar-background))" }}
      animate={{ width: collapsed ? 56 : 240 }}
      transition={{ duration: 0.15, ease: "easeInOut" }}
    >
      {/* Logo Header */}
      <div className="px-4 py-5 flex items-center gap-3 border-b border-white/10 min-h-[64px]">
        <img src={logoSolar} alt="Solar" className="w-8 h-8 rounded-lg flex-shrink-0 object-contain" />
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.05, duration: 0.15 }}
          >
            <div className="font-serif text-[16px] font-bold text-white leading-tight">
              Solar
            </div>
            <div className="text-[10px] text-white/50 uppercase tracking-[1.5px] leading-tight mt-0.5">
              Gerenciamento de Mandato
            </div>
          </motion.div>
        )}
      </div>

      {/* Menu */}
      <nav className="flex-1 px-2 mt-2 overflow-y-auto">
        {menuSections.map((section) => {
          const visibleItems = section.items.filter(item => !item.adminOnly || isAdmin);
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="mb-1">
              {!collapsed && (
                <div className="text-[10px] uppercase tracking-[1.5px] text-white/35 px-3 py-2 font-sans">
                  {section.title}
                </div>
              )}
              {visibleItems.map((item) => {
                const isActive = location.pathname === item.path;
                const badge = getBadge(item.path);
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
                    className={`flex items-center gap-2.5 px-3 py-[10px] text-[15px] transition-all duration-200 border-l-[3px] rounded-r-md ${
                      isActive
                        ? "bg-white/12 text-white border-l-white font-semibold"
                        : "text-white/70 hover:bg-white/8 hover:text-white border-l-transparent hover:border-l-white/40"
                    }`}
                  >
                    <item.icon size={16} strokeWidth={isActive ? 2 : 1.5} className="flex-shrink-0" />
                    {!collapsed && <span className="truncate flex-1 font-sans">{item.label}</span>}
                    {badge > 0 && (
                      <span className="ml-auto min-w-[18px] h-[18px] flex items-center justify-center rounded bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-white/10 space-y-0.5">
        <button
          onClick={onOpenTour}
          title="Tutorial"
          className="flex items-center justify-center gap-2.5 px-3 py-[9px] text-[14px] text-white/75 hover:bg-white/8 hover:text-white w-full transition-colors duration-200 border-l-[3px] border-l-transparent font-sans"
        >
          <HelpCircle size={15} strokeWidth={1.5} className="flex-shrink-0" />
          {!collapsed && <span>Tutorial</span>}
        </button>
        <button
          onClick={onToggle}
          className="flex items-center justify-center gap-2.5 px-3 py-[9px] text-[14px] text-white/75 hover:bg-white/8 hover:text-white w-full transition-colors duration-200 border-l-[3px] border-l-transparent font-sans"
        >
          {collapsed ? <ChevronRight size={15} strokeWidth={1.5} /> : <><ChevronLeft size={15} strokeWidth={1.5} /> <span>Recolher</span></>}
        </button>
      </div>
    </motion.aside>
  );
}

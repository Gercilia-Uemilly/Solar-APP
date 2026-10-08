import { ReactNode, useState, useEffect, useRef } from "react";
import AppSidebar from "./AppSidebar";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { Menu, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import UserAvatar from "@/components/UserAvatar";
import GuidedTour from "@/components/GuidedTour";
import AiSupportChat from "@/components/AiSupportChat";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLocation } from "react-router-dom";
import NotificationBell from "@/components/NotificationBell";
import LembreteBell from "@/components/LembreteBell";
import MultiDeviceWarning from "@/components/MultiDeviceWarning";
import { setOnDuplicataDetected, type DuplicataInfo } from "@/lib/exportOficio";
import { useFileTransfer } from "@/hooks/useFileTransfer";

export default function AppLayout({ children }: { children: ReactNode }) {
  useFileTransfer();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileTel, setProfileTel] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("avatar_url, full_name, telefone1").eq("id", user.id).single().then(({ data }: any) => {
      if (data) {
        setAvatarUrl(data.avatar_url || null);
        setProfileName(data.full_name || null);
        setProfileTel(data.telefone1 || null);
      }
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const key = `tutorial_visto_${user.id}`;
    if (!localStorage.getItem(key)) {
      setTourOpen(true);
      localStorage.setItem(key, "true");
    }
  }, [user]);

  useEffect(() => {
    if (isMobile) setMobileOpen(false);
  }, [children]);

  // Registrar callback global para avisar sobre duplicatas na exportação
  useEffect(() => {
    setOnDuplicataDetected((dups: DuplicataInfo[]) => {
      const campos = dups.map(d => d.campo).join(", ");
      toast.warning("Duplicatas removidas automaticamente", {
        description: `Os seguintes campos estavam duplicados no corpo e foram removidos da exportação: ${campos}. Revise o conteúdo do ofício para evitar repetições.`,
        duration: 8000,
      });
    });
    return () => setOnDuplicataDetected(null);
  }, []);

  // Cache profiles for notification names
  const [notifProfiles, setNotifProfiles] = useState<Record<string, string>>({});
  useEffect(() => {
    supabase.from("profiles").select("id, full_name, email").then(({ data }) => {
      if (data) {
        const map: Record<string, string> = {};
        for (const p of data as any[]) {
          map[p.id] = p.full_name || p.email?.split("@")[0] || "Usuário";
        }
        setNotifProfiles(map);
      }
    });
  }, []);

  const chatNotifSetupRef = useRef(false);
  const notifProfilesRef = useRef(notifProfiles);
  notifProfilesRef.current = notifProfiles;

  useEffect(() => {
    if (!user || chatNotifSetupRef.current) return;
    chatNotifSetupRef.current = true;

    const playBeep = () => {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.15;
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } catch {}
    };

    const getSenderName = (id: string) => notifProfilesRef.current[id] || "Alguém";

    const chDM = supabase
      .channel(`chat-notif-dm-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mensagens',
        filter: `para_user_id=eq.${user.id}`
      }, (payload) => {
        const msg = payload.new as any;
        if (msg.de_user_id === user.id) return;
        if (location.pathname === '/chat') return;
        const name = getSenderName(msg.de_user_id);
        toast(`💬 ${name}: ${(msg.conteudo || "").substring(0, 50)}`, { duration: 5000 });
        playBeep();
      })
      .subscribe();

    const chGeral = supabase
      .channel(`chat-notif-geral-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'mensagens',
        filter: 'para_user_id=is.null'
      }, (payload) => {
        const msg = payload.new as any;
        if (msg.de_user_id === user.id) return;
        if (location.pathname === '/chat') return;
        const name = getSenderName(msg.de_user_id);
        toast(`📢 ${name} no geral: ${(msg.conteudo || "").substring(0, 50)}`, { duration: 4000 });
        playBeep();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chDM);
      supabase.removeChannel(chGeral);
      chatNotifSetupRef.current = false;
    };
  }, [user, location.pathname]);

  const sidebarWidth = isMobile ? 0 : (collapsed ? 56 : 240);

  // Get page title from path
  const getPageTitle = () => {
    const pathMap: Record<string, string> = {
      "/": "Painel",
      "/oficios": "Ofícios",
      "/meus-oficios": "Todos os Ofícios",
      "/numeracao": "Numeração",
      "/respostas": "Respostas",
      "/chat": "Chat Interno",
      "/banco-informacoes": "Banco de Informações",
      "/whatsapp": "WhatsApp",
      "/whatsapp-mensagens": "Mensagens WhatsApp",
      "/operadores": "Operadores",
      "/relatorios": "Relatórios",
      "/lixeira": "Lixeira",
      "/backups": "Backups",
      "/configuracoes": "Configurações",
      "/lembretes": "Lembretes",
      "/sobre": "Sobre",
      "/ajuda": "Ajuda e Suporte",
    };
    return pathMap[location.pathname] || "Solar";
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      <AnimatePresence>
        {isMobile && mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/10 backdrop-blur-[2px] z-40"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      {isMobile ? (
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ duration: 0.15, ease: "easeInOut" }}
              className="fixed left-0 top-0 bottom-0 z-50"
            >
              <AppSidebar collapsed={false} onToggle={() => setMobileOpen(false)} onOpenTour={() => setTourOpen(true)} onOpenSupport={() => setSupportOpen(true)} />
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} onOpenTour={() => setTourOpen(true)} onOpenSupport={() => setSupportOpen(true)} />
      )}

      <div className="flex-1 flex flex-col" style={{ marginLeft: sidebarWidth }}>
        {/* Topbar */}
        <header className="h-[60px] border-b border-border bg-card flex items-center justify-between px-7 sticky top-0 z-30 shadow-institutional">
          <div className="flex items-center gap-3">
            <button
              onClick={() => isMobile ? setMobileOpen(!mobileOpen) : setCollapsed(!collapsed)}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-150"
            >
              <Menu size={18} strokeWidth={1.5} />
            </button>
            <h1 className="text-lg font-bold text-foreground font-serif hidden sm:block">
              {getPageTitle()}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <LembreteBell />
            <NotificationBell />
            <ThemeToggle />
            <div className="text-right hidden sm:block">
              <p className="text-[15px] font-semibold text-foreground leading-tight font-sans">
                {profileName || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário"}
              </p>
              <p className="text-2xs text-muted-foreground leading-tight font-sans">
                {profileTel ? `📱 ${profileTel}` : user?.email}
              </p>
            </div>
            <UserAvatar
              userId={user?.id}
              fullName={user?.user_metadata?.full_name || user?.email?.split("@")[0]}
              avatarUrl={avatarUrl}
              size="sm"
            />
            <button
              onClick={() => signOut()}
              className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150"
              title="Sair"
            >
              <LogOut size={15} strokeWidth={1.5} />
            </button>
          </div>
        </header>

        <MultiDeviceWarning />

        {/* Main */}
        <main className="flex-1 p-5 sm:p-7 animate-fade-in">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-border px-4 py-2.5 flex items-center justify-between">
          <p className="text-2xs text-muted-foreground font-sans">
            Desenvolvido por <span className="font-semibold text-muted-foreground/80">Solar Labs</span>
          </p>
          <span className="flex items-center gap-1.5 text-2xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Sincronizado
          </span>
        </footer>
      </div>

      <GuidedTour open={tourOpen} onClose={() => setTourOpen(false)} />
      <AiSupportChat />
    </div>
  );
}

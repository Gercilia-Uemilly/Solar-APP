import { ReactNode, useState, useEffect } from "react";
import AppSidebar from "./AppSidebar";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { Menu, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import UserAvatar from "@/components/UserAvatar";
import GuidedTour from "@/components/GuidedTour";
import SupportDrawer from "@/components/SupportDrawer";
import AiSupportChat from "@/components/AiSupportChat";
import { supabase } from "@/integrations/supabase/client";

export default function AppLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profileTel, setProfileTel] = useState<string | null>(null);

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

  // Auto-show tutorial on first login
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

  const sidebarWidth = isMobile ? 0 : (collapsed ? 56 : 220);

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
        {/* Header */}
        <header className="h-12 border-b border-border bg-card flex items-center justify-between px-4 sm:px-5 sticky top-0 z-30">
          <button
            onClick={() => isMobile ? setMobileOpen(!mobileOpen) : setCollapsed(!collapsed)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-150"
          >
            <Menu size={16} strokeWidth={1.5} />
          </button>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="text-right hidden sm:block">
              <p className="text-[13px] font-medium text-foreground leading-tight">
                {profileName || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário"}
              </p>
              <p className="text-2xs text-muted-foreground leading-tight">
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
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors duration-150"
              title="Sair"
            >
              <LogOut size={15} strokeWidth={1.5} />
            </button>
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 p-4 sm:p-6 animate-fade-in">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-border px-4 py-2.5 text-center">
          <p className="text-2xs text-muted-foreground">
            Desenvolvido por <span className="font-medium text-muted-foreground/80">Solar Labs</span>
          </p>
        </footer>
      </div>

      <GuidedTour open={tourOpen} onClose={() => setTourOpen(false)} />
      <SupportDrawer open={supportOpen} onClose={() => setSupportOpen(false)} />
      <AiSupportChat />
    </div>
  );
}

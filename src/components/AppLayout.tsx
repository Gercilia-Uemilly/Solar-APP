import { ReactNode, useState, useEffect } from "react";
import AppSidebar from "./AppSidebar";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { Menu, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";
import UserAvatar from "@/components/UserAvatar";
import GuidedTour from "@/components/GuidedTour";
import { supabase } from "@/integrations/supabase/client";

export default function AppLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
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

  // Close mobile sidebar on route change
  useEffect(() => {
    if (isMobile) {
      setMobileOpen(false);
    }
  }, [children]);

  // On mobile, sidebar is overlay; on desktop, it pushes content
  const sidebarWidth = isMobile ? 0 : (collapsed ? 64 : 220);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      <AnimatePresence>
        {isMobile && mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      {isMobile ? (
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="fixed left-0 top-0 bottom-0 z-50"
            >
              <AppSidebar collapsed={false} onToggle={() => setMobileOpen(false)} onOpenTour={() => setTourOpen(true)} />
            </motion.div>
          )}
        </AnimatePresence>
      ) : (
        <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      )}

      <div className="flex-1 flex flex-col" style={{ marginLeft: sidebarWidth }}>
        {/* Header */}
        <header className="h-14 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30">
          <button
            onClick={() => isMobile ? setMobileOpen(!mobileOpen) : setCollapsed(!collapsed)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-foreground">{profileName || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário"}</p>
              <p className="text-[10px] text-muted-foreground">{profileTel ? `📱 ${profileTel}` : user?.email}</p>
            </div>
            <UserAvatar
              userId={user?.id}
              fullName={user?.user_metadata?.full_name || user?.email?.split("@")[0]}
              avatarUrl={avatarUrl}
              size="sm"
            />
            <button
              onClick={() => signOut()}
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>
        <motion.main
          className="flex-1 p-3 sm:p-6"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}

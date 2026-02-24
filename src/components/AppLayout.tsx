import { ReactNode, useState } from "react";
import AppSidebar from "./AppSidebar";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { Menu, LogOut, User } from "lucide-react";
import { motion } from "framer-motion";

export default function AppLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const { user, signOut } = useAuth();

  const sidebarWidth = collapsed ? 64 : 220;

  return (
    <div className="min-h-screen bg-background flex">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className="flex-1 flex flex-col" style={{ marginLeft: sidebarWidth }}>
        {/* Header */}
        <header className="h-14 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-40">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-foreground">{user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário"}</p>
              <p className="text-[10px] text-muted-foreground">{user?.email}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <User size={14} className="text-primary" />
            </div>
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
          className="flex-1 p-6"
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

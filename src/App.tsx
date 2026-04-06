import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useGlobalSync } from "@/hooks/useGlobalSync";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { ReactNode, lazy, Suspense, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { supabase } from "@/integrations/supabase/client";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AppLayout = lazy(() => import("./components/AppLayout"));
const Oficios = lazy(() => import("./pages/Oficios"));
const MeusOficios = lazy(() => import("./pages/MeusOficios"));
const Operadores = lazy(() => import("./pages/Operadores"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const BancoInformacoes = lazy(() => import("./pages/BancoInformacoes"));
const Respostas = lazy(() => import("./pages/Respostas"));
const Sobre = lazy(() => import("./pages/Sobre"));
const Clipping = lazy(() => import("./pages/Clipping"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const GoogleDriveCallback = lazy(() => import("./pages/GoogleDriveCallback"));
const PoliticaPrivacidade = lazy(() => import("./pages/PoliticaPrivacidade"));
const Lixeira = lazy(() => import("./pages/Lixeira"));
const Backups = lazy(() => import("./pages/Backups"));
const WhatsAppConectar = lazy(() => import("./pages/WhatsAppConectar"));
const WhatsAppMensagens = lazy(() => import("./pages/WhatsAppMensagens"));
const ChatInterno = lazy(() => import("./pages/ChatInterno"));
const AguardandoAprovacao = lazy(() => import("./pages/AguardandoAprovacao"));
const Modelos = lazy(() => import("./pages/Modelos"));
const VerificarSMS = lazy(() => import("./pages/VerificarSMS"));
const PainelNumeracao = lazy(() => import("./pages/PainelNumeracao"));
const Lembretes = lazy(() => import("./pages/Lembretes"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 1000 * 60 * 5,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    },
    mutations: {
      retry: 2,
      retryDelay: 1000,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="animate-spin text-primary" size={32} />
  </div>
);

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, profileStatus } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (profileStatus && profileStatus !== "aprovado") return <Navigate to="/aguardando-aprovacao" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin, profileStatus } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (profileStatus && profileStatus !== "aprovado") return <Navigate to="/aguardando-aprovacao" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { user, loading, profileStatus } = useAuth();
  if (loading) return <PageLoader />;
  if (user && profileStatus === "aprovado") return <Navigate to="/" replace />;
  if (user && profileStatus && profileStatus !== "aprovado") return <Navigate to="/aguardando-aprovacao" replace />;
  return <>{children}</>;
}

function WaitingRoute({ children }: { children: ReactNode }) {
  const { user, loading, profileStatus } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (profileStatus === "aprovado") return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Keepalive ping every 4 minutes to maintain Supabase connection */
function useKeepalive() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const ping = setInterval(async () => {
      try {
        await supabase.from("profiles").select("id").eq("id", user.id).limit(1).single();
      } catch {}
    }, 240000);
    return () => clearInterval(ping);
  }, [user]);
}

const AppRoutes = () => {
  const { user } = useAuth();
  useGlobalSync();
  useSessionTimeout(!!user);
  useKeepalive();

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<PublicOnlyRoute><Auth /></PublicOnlyRoute>} />
        <Route path="/aguardando-aprovacao" element={<WaitingRoute><AguardandoAprovacao /></WaitingRoute>} />
        <Route path="/verificar-sms" element={<VerificarSMS />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/google/callback" element={<GoogleDriveCallback />} />
        <Route path="/privacidade" element={<PoliticaPrivacidade />} />
        <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
        <Route path="/oficios" element={<ProtectedRoute><AppLayout><Oficios /></AppLayout></ProtectedRoute>} />
        <Route path="/meus-oficios" element={<ProtectedRoute><AppLayout><MeusOficios /></AppLayout></ProtectedRoute>} />
        <Route path="/modelos" element={<ProtectedRoute><AppLayout><Modelos /></AppLayout></ProtectedRoute>} />
        <Route path="/respostas" element={<ProtectedRoute><AppLayout><Respostas /></AppLayout></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><AppLayout><ChatInterno /></AppLayout></ProtectedRoute>} />
        <Route path="/operadores" element={<AdminRoute><AppLayout><Operadores /></AppLayout></AdminRoute>} />
        <Route path="/relatorios" element={<AdminRoute><AppLayout><Relatorios /></AppLayout></AdminRoute>} />
        <Route path="/banco-informacoes" element={<ProtectedRoute><AppLayout><BancoInformacoes /></AppLayout></ProtectedRoute>} />
        <Route path="/configuracoes" element={<ProtectedRoute><AppLayout><Configuracoes /></AppLayout></ProtectedRoute>} />
        <Route path="/clipping" element={<ProtectedRoute><AppLayout><Clipping /></AppLayout></ProtectedRoute>} />
        <Route path="/sobre" element={<ProtectedRoute><AppLayout><Sobre /></AppLayout></ProtectedRoute>} />
        <Route path="/numeracao" element={<ProtectedRoute><AppLayout><PainelNumeracao /></AppLayout></ProtectedRoute>} />
        <Route path="/lembretes" element={<ProtectedRoute><AppLayout><Lembretes /></AppLayout></ProtectedRoute>} />
        <Route path="/lixeira" element={<ProtectedRoute><AppLayout><Lixeira /></AppLayout></ProtectedRoute>} />
        <Route path="/backups" element={<AdminRoute><AppLayout><Backups /></AppLayout></AdminRoute>} />
        <Route path="/whatsapp" element={<AdminRoute><AppLayout><WhatsAppConectar /></AppLayout></AdminRoute>} />
        <Route path="/whatsapp-mensagens" element={<AdminRoute><AppLayout><WhatsAppMensagens /></AppLayout></AdminRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const App = () => (
  <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;

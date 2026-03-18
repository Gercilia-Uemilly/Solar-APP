import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { useGlobalSync } from "@/hooks/useGlobalSync";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { ReactNode, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

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
const WhatsAppConectar = lazy(() => import("./pages/WhatsAppConectar"));
const WhatsAppMensagens = lazy(() => import("./pages/WhatsAppMensagens"));
const ChatInterno = lazy(() => import("./pages/ChatInterno"));
const AguardandoAprovacao = lazy(() => import("./pages/AguardandoAprovacao"));
const Modelos = lazy(() => import("./pages/Modelos"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      retry: 1,
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

const AppRoutes = () => {
  const { user } = useAuth();
  useGlobalSync();
  useSessionTimeout(!!user);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<PublicOnlyRoute><Auth /></PublicOnlyRoute>} />
        <Route path="/aguardando-aprovacao" element={<WaitingRoute><AguardandoAprovacao /></WaitingRoute>} />
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
        <Route path="/whatsapp" element={<ProtectedRoute><AppLayout><WhatsAppConectar /></AppLayout></ProtectedRoute>} />
        <Route path="/whatsapp-mensagens" element={<ProtectedRoute><AppLayout><WhatsAppMensagens /></AppLayout></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

const App = () => (
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
);

export default App;

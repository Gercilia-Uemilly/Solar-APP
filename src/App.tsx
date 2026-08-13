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
import { PageSkeleton } from "@/components/ui/skeletons";
import ErrorBoundary from "@/components/ErrorBoundary";

const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const DevParityAudit = lazy(() => import("./pages/DevParityAudit"));
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
const ChatInterno = lazy(() => import("./pages/ChatInterno"));
const AguardandoAprovacao = lazy(() => import("./pages/AguardandoAprovacao"));
const VerificarSMS = lazy(() => import("./pages/VerificarSMS"));
const PainelNumeracao = lazy(() => import("./pages/PainelNumeracao"));
const Lembretes = lazy(() => import("./pages/Lembretes"));
const Ajuda = lazy(() => import("./pages/Ajuda"));
const InstalarApp = lazy(() => import("./pages/InstalarApp"));
const DashboardRespostas = lazy(() => import("./pages/DashboardRespostas"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Realtime já mantém os dados sincronizados, então não precisamos
      // refazer fetch a cada navegação/foco. Isso evita o "tudo lento ao trocar de página".
      staleTime: 60_000,           // 1 min sem refetch desnecessário
      gcTime: 5 * 60_000,          // mantém cache por 5 min entre navegações
      refetchOnMount: false,       // se já temos dados frescos, não busca de novo
      refetchOnWindowFocus: false, // Realtime cobre isso
      refetchOnReconnect: true,
      retry: 1,                    // antes 3 → travava 4s em cada falha
      retryDelay: 800,
    },
    mutations: {
      retry: 1,
      retryDelay: 800,
    },
  },
});

const PageLoader = () => <PageSkeleton />;

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
    <Suspense fallback={<PageSkeleton />}>
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
        <Route path="/respostas" element={<ProtectedRoute><AppLayout><Respostas /></AppLayout></ProtectedRoute>} />
        <Route path="/respostas/dashboard" element={<ProtectedRoute><AppLayout><DashboardRespostas /></AppLayout></ProtectedRoute>} />
        <Route path="/chat" element={<ProtectedRoute><AppLayout><ChatInterno /></AppLayout></ProtectedRoute>} />
        <Route path="/operadores" element={<AdminRoute><AppLayout><Operadores /></AppLayout></AdminRoute>} />
        <Route path="/relatorios" element={<AdminRoute><AppLayout><Relatorios /></AppLayout></AdminRoute>} />
        <Route path="/banco-informacoes" element={<ProtectedRoute><AppLayout><BancoInformacoes /></AppLayout></ProtectedRoute>} />
        <Route path="/configuracoes" element={<ProtectedRoute><AppLayout><Configuracoes /></AppLayout></ProtectedRoute>} />
        <Route path="/clipping" element={<ProtectedRoute><AppLayout><Clipping /></AppLayout></ProtectedRoute>} />
        <Route path="/sobre" element={<ProtectedRoute><AppLayout><Sobre /></AppLayout></ProtectedRoute>} />
        <Route path="/numeracao" element={<ProtectedRoute><AppLayout><PainelNumeracao /></AppLayout></ProtectedRoute>} />
        <Route path="/lembretes" element={<ProtectedRoute><AppLayout><Lembretes /></AppLayout></ProtectedRoute>} />
        <Route path="/ajuda" element={<ProtectedRoute><AppLayout><Ajuda /></AppLayout></ProtectedRoute>} />
        <Route path="/instalar" element={<ProtectedRoute><AppLayout><InstalarApp /></AppLayout></ProtectedRoute>} />
        <Route path="/lixeira" element={<ProtectedRoute><AppLayout><Lixeira /></AppLayout></ProtectedRoute>} />
        <Route path="/backups" element={<AdminRoute><AppLayout><Backups /></AppLayout></AdminRoute>} />
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

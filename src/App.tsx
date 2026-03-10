import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ReactNode, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

// Lazy load all pages
const Index = lazy(() => import("./pages/Index"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AppLayout = lazy(() => import("./components/AppLayout"));
const Oficios = lazy(() => import("./pages/Oficios"));
const ScriptsPage = lazy(() => import("./pages/ScriptsPage"));
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min
      gcTime: 1000 * 60 * 30, // 30 min
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
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/login" element={<PublicOnlyRoute><Auth /></PublicOnlyRoute>} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/auth/google/callback" element={<ProtectedRoute><GoogleDriveCallback /></ProtectedRoute>} />
      <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
      <Route path="/oficios" element={<ProtectedRoute><AppLayout><Oficios /></AppLayout></ProtectedRoute>} />
      <Route path="/meus-oficios" element={<ProtectedRoute><AppLayout><MeusOficios /></AppLayout></ProtectedRoute>} />
      <Route path="/respostas" element={<ProtectedRoute><AppLayout><Respostas /></AppLayout></ProtectedRoute>} />
      <Route path="/scripts" element={<ProtectedRoute><AppLayout><ScriptsPage /></AppLayout></ProtectedRoute>} />
      <Route path="/operadores" element={<AdminRoute><AppLayout><Operadores /></AppLayout></AdminRoute>} />
      <Route path="/relatorios" element={<AdminRoute><AppLayout><Relatorios /></AppLayout></AdminRoute>} />
      <Route path="/banco-informacoes" element={<ProtectedRoute><AppLayout><BancoInformacoes /></AppLayout></ProtectedRoute>} />
      <Route path="/configuracoes" element={<ProtectedRoute><AppLayout><Configuracoes /></AppLayout></ProtectedRoute>} />
      <Route path="/clipping" element={<ProtectedRoute><AppLayout><Clipping /></AppLayout></ProtectedRoute>} />
      <Route path="/sobre" element={<ProtectedRoute><AppLayout><Sobre /></AppLayout></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
);

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

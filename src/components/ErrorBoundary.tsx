import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, TicketCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
  logged: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, logged: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Solar Error Boundary:", error, info.componentStack);
    this.logRemoto(error, info);
  }

  private async logRemoto(error: Error, info: ErrorInfo) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await (supabase as any).from("error_logs").insert({
        user_id: user?.id ?? null,
        message: error.message.slice(0, 500),
        stack: info.componentStack?.slice(0, 3000) ?? null,
        context: "ErrorBoundary",
        url: window.location.pathname,
        extra: {
          userAgent: navigator.userAgent,
          errorName: error.name,
        },
      });
      this.setState({ logged: true });
    } catch {
      // silencioso
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, logged: false });
    window.location.reload();
  };

  handleAbrirChamado = () => {
    // Navega para /ajuda e dispara o evento para abrir o modal de chamado
    window.dispatchEvent(new CustomEvent("solar:abrir-chamado"));
    window.location.href = "/ajuda";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center space-y-4 shadow-lg">
            <AlertTriangle size={48} className="mx-auto text-orange-500" />
            <h2 className="text-xl font-bold text-foreground">Algo deu errado</h2>
            <p className="text-sm text-muted-foreground">
              Ocorreu um erro inesperado. Você pode recarregar a página ou abrir um chamado para o administrador.
            </p>

            {this.state.logged && (
              <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
                ✓ O erro foi registrado automaticamente.
              </p>
            )}

            {this.state.error && (
              <details className="text-left bg-secondary rounded-lg p-3">
                <summary className="text-xs text-muted-foreground cursor-pointer">
                  Detalhes técnicos
                </summary>
                <pre className="text-xs text-destructive mt-2 whitespace-pre-wrap break-words">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-secondary text-secondary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                <RefreshCw size={16} />
                Recarregar
              </button>
              <button
                onClick={this.handleAbrirChamado}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                <TicketCheck size={16} />
                Abrir chamado
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

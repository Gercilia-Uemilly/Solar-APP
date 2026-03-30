import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Solar Error Boundary:", error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center space-y-4 shadow-lg">
            <AlertTriangle size={48} className="mx-auto text-orange-500" />
            <h2 className="text-xl font-bold text-foreground">Algo deu errado</h2>
            <p className="text-sm text-muted-foreground">
              Ocorreu um erro inesperado. Recarregue a página para continuar.
            </p>
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
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              <RefreshCw size={16} />
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message?: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Erro inesperado na aplicação.",
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error("Erro capturado pelo ErrorBoundary do Site_ABNT.", error, info);
  }

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="error-boundary" role="alert" aria-live="assertive">
        <h1>Não foi possível carregar a interface.</h1>
        <p>Ocorreu uma falha inesperada no aplicativo. Seus dados salvos localmente podem continuar no navegador.</p>
        {this.state.message && <p className="error-boundary-detail">Detalhe técnico: {this.state.message}</p>}
        <button type="button" onClick={() => window.location.reload()}>
          Recarregar página
        </button>
      </main>
    );
  }
}

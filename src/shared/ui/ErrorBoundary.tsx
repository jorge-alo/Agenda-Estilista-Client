import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error atrapado por ErrorBoundary:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="error-boundary-fallback">
            <p className="error-boundary-title">Algo salió mal</p>
            <p className="error-boundary-sub">
              Ocurrió un error inesperado en esta sección.
            </p>
            <button className="error-boundary-btn" onClick={this.handleReset}>
              Reintentar
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleReload() {
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-[100dvh] bg-white px-8 font-display">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-5">
            <span className="material-symbols-outlined text-red-400 text-[40px]">error_outline</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 text-center mb-2">
            Une erreur inattendue s'est produite
          </h2>
          <p className="text-sm text-slate-500 text-center leading-relaxed mb-6">
            L'application a rencontré un problème. Recharge la page pour continuer.
          </p>
          <button
            onClick={this.handleReload}
            className="px-8 py-3 bg-slate-900 text-white font-bold rounded-full text-sm active:scale-95 transition-all"
          >
            Recharger l'application
          </button>
          {this.state.error && (
            <details className="mt-6 max-w-full">
              <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600">
                Détails techniques
              </summary>
              <pre className="mt-2 text-[10px] text-slate-400 overflow-auto max-w-[90vw] bg-slate-50 rounded-xl p-3">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

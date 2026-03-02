import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isAutoReloading: boolean;
}

function isChunkLoadError(error: Error): boolean {
  const msg = error.message?.toLowerCase() ?? '';
  return (
    msg.includes('mime type') ||
    msg.includes('dynamically imported') ||
    msg.includes('failed to fetch dynamically') ||
    msg.includes('loading chunk') ||
    msg.includes('loading css chunk') ||
    msg.includes('unexpected token') ||
    (error.name === 'TypeError' && msg.includes('import'))
  );
}

function clearCachesAndReload() {
  const doReload = () => {
    window.location.href = window.location.href.split('?')[0] + '?_=' + Date.now();
  };

  const timeout = setTimeout(doReload, 2000);

  const cleanup = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // ignore
    }
    clearTimeout(timeout);
    doReload();
  };

  cleanup();
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isAutoReloading: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidUpdate(_: Props, prevState: State) {
    if (
      this.state.hasError &&
      !prevState.hasError &&
      this.state.error &&
      isChunkLoadError(this.state.error)
    ) {
      this.setState({ isAutoReloading: true });
      clearCachesAndReload();
    }
  }

  handleReload() {
    clearCachesAndReload();
  }

  render() {
    if (this.state.hasError) {
      if (this.state.isAutoReloading) {
        return (
          <div className="flex flex-col items-center justify-center h-screen bg-white px-8 font-display">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-green-500 text-[32px] animate-spin">
                autorenew
              </span>
            </div>
            <p className="text-sm text-slate-500 text-center">Mise à jour en cours...</p>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center h-screen bg-white px-8 font-display">
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

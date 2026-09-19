import {StrictMode, Component, type ErrorInfo, type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class AppErrorBoundary extends Component<
  {children: ReactNode},
  {error: Error | null}
> {
  state = {error: null as Error | null};

  static getDerivedStateFromError(error: Error) {
    return {error};
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[RWDNEWS] React render error', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background: '#071a2d',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <section style={{maxWidth: 560, width: '100%', textAlign: 'center'}}>
          <img src="/rwdnews-logo.svg" alt="RWDNEWS" style={{width: 'min(82vw, 320px)', margin: '0 auto 24px'}} />
          <h1 style={{fontSize: 24, margin: '0 0 10px'}}>RWDNEWS is loading with a problem</h1>
          <p style={{opacity: .78, lineHeight: 1.6, margin: '0 0 20px'}}>
            The page encountered a browser error. Refresh once to retry.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              border: 0,
              borderRadius: 999,
              padding: '12px 20px',
              fontWeight: 800,
              cursor: 'pointer',
              background: '#f59e0b',
              color: '#071a2d',
            }}
          >
            Reload RWDNEWS
          </button>
          <details style={{marginTop: 24, textAlign: 'left', opacity: .65}}>
            <summary>Technical details</summary>
            <pre style={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12}}>
              {this.state.error.message}
            </pre>
          </details>
        </section>
      </main>
    );
  }
}

const root = document.getElementById('root');

if (!root) {
  throw new Error('RWDNEWS root element is missing');
}

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);

import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ImpersonationProvider } from "@/hooks/useImpersonation";

// Initialize production services
import './utils/productionConfig';
import './utils/consoleReplacer';
import './utils/consoleLogCleaner';

// Suppress specific React defaultProps deprecation warnings originating from third-party libraries (e.g., Recharts).
// We only silence the exact deprecation message to avoid hiding other important errors.
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const _error = console.error.bind(console);
  const _warn = console.warn.bind(console);
  const needle = 'Support for defaultProps will be removed from function components';

  console.error = (...args: any[]) => {
    try {
      const m = args[0];
      const text = typeof m === 'string' ? m : (m && (m.message || m.toString())) || '';
      if (typeof text === 'string' && text.includes(needle)) {
        // swallow this specific deprecation warning
        return;
      }
    } catch (e) {
      // fall through to default
    }
    _error(...args);
  };

  // Also guard console.warn just in case some libraries use warn
  console.warn = (...args: any[]) => {
    try {
      const m = args[0];
      const text = typeof m === 'string' ? m : (m && (m.message || m.toString())) || '';
      if (typeof text === 'string' && text.includes(needle)) {
        return;
      }
    } catch (e) {
      // ignore
    }
    _warn(...args);
  };
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ImpersonationProvider>
      <App />
    </ImpersonationProvider>
  </React.StrictMode>
);

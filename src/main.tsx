import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { ImpersonationProvider } from "@/hooks/useImpersonation";

// Initialize production services
import './utils/productionConfig';
import './utils/consoleReplacer';
import './utils/consoleLogCleaner';

// Suppress noisy React warning about defaultProps used inside third-party function components
// (appears for Recharts in development). We only silence this specific message to avoid
// hiding other useful warnings.
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  const _warn = console.warn.bind(console);
  console.warn = (...args: any[]) => {
    try {
      const m = args[0];
      const text = typeof m === 'string' ? m : (m && m.message) || JSON.stringify(m || '');
      if (typeof text === 'string' && text.includes('Support for defaultProps will be removed from function components')) {
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

import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { ImpersonationProvider } from "@/hooks/useImpersonation";

// Initialize production services and console cleaners before loading app code
import './utils/productionConfig';
import './utils/patchRecharts';
import './utils/consoleLogCleaner';
import './utils/consoleReplacer';

import App from './App.tsx'

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ImpersonationProvider>
      <App />
    </ImpersonationProvider>
  </React.StrictMode>
);

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load Supabase runtime defaults (for dev)
  let supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  let supabaseAnon = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  try {
    const fs = require('fs');
    const runtimePath = path.resolve(__dirname, 'supabase', 'runtime.json');
    if (!supabaseUrl || !supabaseAnon) {
      if (fs.existsSync(runtimePath)) {
        const runtime = JSON.parse(fs.readFileSync(runtimePath, 'utf-8'));
        supabaseUrl = supabaseUrl || runtime.url;
        supabaseAnon = supabaseAnon || runtime.anonKey;
      }
    }
  } catch {}

  const proxy = supabaseUrl && supabaseAnon ? {
    '/api/edge': {
      target: supabaseUrl,
      changeOrigin: true,
      secure: true,
      rewrite: (p) => p.replace(/^\/api\/edge/, '/functions/v1'),
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq, req) => {
          const auth = req.headers['authorization'];
          proxyReq.setHeader('apikey', supabaseAnon);
          proxyReq.setHeader('Authorization', auth ? String(auth) : `Bearer ${supabaseAnon}`);
          if (req.url?.includes('create-tenant-account')) proxyReq.setHeader('x-force-create', 'true');
          proxyReq.setHeader('x-requested-with', 'XMLHttpRequest');
          proxyReq.setHeader('origin', '');
        });
      }
    },
    '/api/rpc': {
      target: supabaseUrl,
      changeOrigin: true,
      secure: true,
      rewrite: (p) => p.replace(/^\/api\/rpc/, '/rest/v1/rpc'),
      configure: (proxy) => {
        proxy.on('proxyReq', (proxyReq, req) => {
          const auth = req.headers['authorization'];
          // Prefer user JWT if present; else anon
          proxyReq.setHeader('apikey', supabaseAnon);
          if (auth) proxyReq.setHeader('Authorization', String(auth));
          else proxyReq.setHeader('Authorization', `Bearer ${supabaseAnon}`);
        });
      }
    }
  } : undefined;

  return {
    base: process.env.VITE_BASE_PATH || "/",
    server: {
      host: "::",
      port: 8080,
      hmr: false,
      strictPort: true,
      proxy,
    },
    preview: {
      port: 8080,
      strictPort: true,
    },
    plugins: [
      react(),
      mode === 'development' && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});

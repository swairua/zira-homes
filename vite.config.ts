import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load Supabase runtime config (used for local dev proxy)
  let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  let supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
  try {
    const runtimePath = path.resolve(__dirname, "./supabase/runtime.json");
    if (!supabaseUrl || !supabaseAnon) {
      if (fs.existsSync(runtimePath)) {
        const runtime = JSON.parse(fs.readFileSync(runtimePath, "utf-8"));
        supabaseUrl = supabaseUrl || runtime.url || "";
        supabaseAnon = supabaseAnon || runtime.anonKey || "";
      }
    }
  } catch {}

  return {
    base: process.env.VITE_BASE_PATH || "/",
    server: {
      host: "::",
      port: 8080,
      hmr: false,
      strictPort: true,
      proxy: supabaseUrl && supabaseAnon ? {
        "/api/edge": {
          target: `${supabaseUrl.replace(/\/$/, "")}/functions/v1`,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/edge/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq, req) => {
              try {
                const hasAuth = proxyReq.getHeader("authorization");
                if (!hasAuth) proxyReq.setHeader("authorization", `Bearer ${supabaseAnon}`);
                proxyReq.setHeader("apikey", supabaseAnon);
                if ((req.url || "").endsWith("/create-tenant-account")) {
                  proxyReq.setHeader("x-force-create", "true");
                }
              } catch {}
            });
          },
        },
      } : undefined,
    },
    preview: {
      port: 8080,
      strictPort: true,
    },
    plugins: [
      react(),
      mode === 'development' &&
      componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});

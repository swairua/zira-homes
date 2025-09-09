import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Security middleware
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: '1y',
  etag: true
}));

// API routes
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

// Simple proxy for Supabase RPC calls to avoid CORS issues in the browser.
app.post('/api/supabase/rpc/:fn', express.json(), async (req, res) => {
  const fn = req.params.fn;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Supabase proxy not configured on server.' });
  }
  try {
    const target = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/' + encodeURIComponent(fn);
    const resp = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(req.body || {}),
    });
    const text = await resp.text();
    res.status(resp.status).set(Object.fromEntries(resp.headers.entries())).send(text);
  } catch (e) {
    res.status(502).json({ error: 'Supabase proxy request failed', details: String(e) });
  }
});

// Generic REST proxy (use with caution) - proxies /api/supabase/rest/<path>
app.use('/api/supabase/rest', express.json(), async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Supabase proxy not configured on server.' });
  }
  try {
    const pathSuffix = req.path || '';
    const target = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1' + pathSuffix;
    const headers = { ...req.headers };
    // overwrite auth headers
    headers.apikey = SUPABASE_ANON_KEY;
    headers.authorization = `Bearer ${SUPABASE_ANON_KEY}`;
    // delete host header
    delete headers.host;

    const resp = await fetch(target, {
      method: req.method,
      headers,
      body: ['GET','HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    });
    const text = await resp.text();
    res.status(resp.status).set(Object.fromEntries(resp.headers.entries())).send(text);
  } catch (e) {
    res.status(502).json({ error: 'Supabase REST proxy failed', details: String(e) });
  }
});

// SPA fallback - serve index.html for all non-API, non-static routes
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

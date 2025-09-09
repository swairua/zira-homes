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

// Simple helper to parse cookies
function parseCookies(req) {
  const cookie = req.headers && req.headers.cookie;
  if (!cookie) return {};
  return cookie.split(';').map(c => c.trim()).reduce((acc, pair) => {
    const parts = pair.split('=');
    acc[parts[0]] = decodeURIComponent(parts.slice(1).join('='));
    return acc;
  }, {});
}

// Auth endpoints (server-side) - sign in / sign out / get user
app.post('/api/auth/signin', express.json(), async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(500).json({ error: 'Auth not configured on server.' });
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
  try {
    const target = SUPABASE_URL.replace(/\/$/, '') + '/auth/v1/token?grant_type=password';
    const resp = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ email, password })
    });
    const data = await resp.json();
    if (!resp.ok) {
      return res.status(resp.status).json({ error: data });
    }
    // Set HttpOnly cookies for tokens
    const isSecure = process.env.NODE_ENV === 'production';
    const cookieOpts = `HttpOnly; Path=/; SameSite=Lax${isSecure ? '; Secure' : ''}`;
    if (data.access_token) res.setHeader('Set-Cookie', `sb-access-token=${data.access_token}; ${cookieOpts}`);
    if (data.refresh_token) res.setHeader('Set-Cookie', `sb-refresh-token=${data.refresh_token}; ${cookieOpts}`);
    return res.status(200).json({ user: data.user, access_token: data.access_token });
  } catch (e) {
    return res.status(502).json({ error: String(e) });
  }
});

// Signup endpoint: forwards to Supabase signUp
app.post('/api/auth/signup', express.json(), async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(500).json({ error: 'Auth not configured on server.' });
  const body = req.body || {};
  try {
    const target = SUPABASE_URL.replace(/\/$/, '') + '/auth/v1/signup';
    const resp = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(body)
    });
    const data = await resp.json();
    if (!resp.ok) return res.status(resp.status).json({ error: data });
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: String(e) });
  }
});

app.post('/api/auth/signout', express.json(), async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(500).json({ error: 'Auth not configured on server.' });
  try {
    const cookies = parseCookies(req);
    const token = cookies['sb-access-token'];
    const target = SUPABASE_URL.replace(/\/$/, '') + '/auth/v1/logout';
    await fetch(target, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: token ? `Bearer ${token}` : ''
      }
    });
    // Clear cookies
    const cookieOpts = `Path=/; Max-Age=0; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
    res.setHeader('Set-Cookie', [`sb-access-token=; ${cookieOpts}`, `sb-refresh-token=; ${cookieOpts}`]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ error: String(e) });
  }
});

app.get('/api/auth/user', async (req, res) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(500).json({ error: 'Auth not configured on server.' });
  try {
    const cookies = parseCookies(req);
    const token = cookies['sb-access-token'];
    if (!token) return res.status(200).json({ user: null });
    const target = SUPABASE_URL.replace(/\/$/, '') + '/auth/v1/user';
    const resp = await fetch(target, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`
      }
    });
    const data = await resp.json();
    return res.status(resp.status).json(data);
  } catch (e) {
    return res.status(502).json({ error: String(e) });
  }
});

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

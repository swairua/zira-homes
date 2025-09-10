const express = require('express');
const path = require('path');
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

// Parse JSON bodies for API routes
app.use(express.json());

// API routes
// Expiring leases endpoint - calls Supabase RPC using service_role key server-side
app.post('/api/leases/expiring', async (req, res) => {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE;

    if (!supabaseUrl) return res.status(500).json({ error: 'Supabase URL not configured' });
    if (!serviceRole) return res.status(500).json({ error: 'Supabase service role key (SUPABASE_SERVICE_ROLE) not configured on the server' });

    const { p_start_date, p_end_date } = req.body || req.query || {};

    const rpcUrl = supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/get_lease_expiry_report';

    const rpcBody = {};
    if (p_start_date) rpcBody.p_start_date = p_start_date;
    if (p_end_date) rpcBody.p_end_date = p_end_date;

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRole,
        'Authorization': `Bearer ${serviceRole}`,
      },
      body: JSON.stringify(rpcBody),
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = text; }

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Supabase RPC error', details: data });
    }

    // Forward the RPC result to client
    return res.json(data);
  } catch (err) {
    console.error('Error in /api/leases/expiring:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Convenience: allow GET for browser-friendly calls (reads query params)
app.get('/api/leases/expiring', async (req, res) => {
  // Delegate to POST handler
  return app._router.stack.find(layer => layer.route && layer.route.path === '/api/leases/expiring' && layer.route.methods.post).handle(req, res);
});

// Fallback for other API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// SPA fallback - serve index.html for all non-API, non-static routes
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

(async function init() {
  try {
    const { default: express } = await import('express');
    const path = (await import('path')).default;
    const { fileURLToPath } = await import('url');

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

    // Parse JSON bodies for API routes
    app.use(express.json());

    // API routes
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

        return res.json(data);
      } catch (err) {
        console.error('Error in /api/leases/expiring:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.get('/api/leases/expiring', async (req, res) => {
      const layer = app._router.stack.find(layer => layer.route && layer.route.path === '/api/leases/expiring' && layer.route.methods.post);
      if (!layer) return res.status(404).json({ error: 'Not found' });
      return layer.handle(req, res);
    });

    app.post('/api/invoices/overview', async (req, res) => {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const serviceRole = process.env.SUPABASE_SERVICE_ROLE;

        if (!supabaseUrl) return res.status(500).json({ error: 'Supabase URL not configured' });
        if (!serviceRole) return res.status(500).json({ error: 'Supabase service role key (SUPABASE_SERVICE_ROLE) not configured on the server' });

        const { p_limit, p_offset, p_status, p_search } = req.body || req.query || {};
        const rpcUrl = supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/get_invoice_overview';

        const rpcBody = {
          p_limit: p_limit || 50,
          p_offset: p_offset || 0,
          p_status: p_status || null,
          p_search: p_search || null
        };

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

        return res.json(data);
      } catch (err) {
        console.error('Error in /api/invoices/overview:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.get('/api/invoices/overview', async (req, res) => {
      const layer = app._router.stack.find(layer => layer.route && layer.route.path === '/api/invoices/overview' && layer.route.methods.post);
      if (!layer) return res.status(404).json({ error: 'Not found' });
      return layer.handle(req, res);
    });

    app.post('/api/invoices/create', async (req, res) => {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const serviceRole = process.env.SUPABASE_SERVICE_ROLE;

        if (!supabaseUrl) return res.status(500).json({ error: 'Supabase URL not configured' });
        if (!serviceRole) return res.status(500).json({ error: 'Supabase service role key (SUPABASE_SERVICE_ROLE) not configured on the server' });

        const { lease_id, tenant_id, amount, due_date, description } = req.body || {};
        if (!lease_id || !tenant_id || !amount || !due_date) return res.status(400).json({ error: 'lease_id, tenant_id, amount and due_date are required' });

        const invoiceNumber = `INV-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*9000)+1000}`;

        const insertUrl = supabaseUrl.replace(/\/$/, '') + '/rest/v1/invoices';
        const payload = {
          lease_id,
          tenant_id,
          invoice_number: invoiceNumber,
          invoice_date: new Date().toISOString().slice(0,10),
          due_date,
          amount,
          status: 'pending',
          description: description || null
        };

        const response = await fetch(insertUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': serviceRole,
            'Authorization': `Bearer ${serviceRole}`,
            'Prefer': 'return=representation'
          },
          body: JSON.stringify(payload),
        });

        const text = await response.text();
        let data;
        try { data = JSON.parse(text); } catch (e) { data = text; }

        if (!response.ok) {
          return res.status(response.status).json({ error: 'Supabase insert error', details: data });
        }

        return res.json({ data });
      } catch (err) {
        console.error('Error in /api/invoices/create:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.get('/api/invoices/create', async (req, res) => {
      const layer = app._router.stack.find(layer => layer.route && layer.route.path === '/api/invoices/create' && layer.route.methods.post);
      if (!layer) return res.status(404).json({ error: 'Not found' });
      return layer.handle(req, res);
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

  } catch (err) {
    console.warn('Express not available or failed to initialize. Skipping API server. Error:', err && err.message ? err.message : err);
  }
})();

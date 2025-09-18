(async function init() {
  try {
    const http = await import('node:http');
    const fs = await import('node:fs');
    const path = (await import('path')).default;
    const { fileURLToPath } = await import('url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const port = process.env.PORT || 3000;

    const sendJSON = (res, status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    };

    const parseJSONBody = (req) => new Promise((resolve) => {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try { resolve(body ? JSON.parse(body) : {}); }
        catch (e) { resolve(null); }
      });
      req.on('error', () => resolve(null));
    });

    const handleRpcProxy = async (rpcPath, req, res, mapBody = (b)=>b) => {
      try {
        // Load runtime for defaults
        let runtime = {};
        try {
          const runtimePath = path.join(__dirname, 'supabase', 'runtime.json');
          if (fs.existsSync(runtimePath)) runtime = JSON.parse(fs.readFileSync(runtimePath, 'utf-8'));
        } catch {}

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || runtime.url;
        const serviceRole = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || runtime.serviceRole;
        const authHeader = req.headers['authorization'] || req.headers['Authorization'];
        if (!supabaseUrl) return sendJSON(res, 500, { error: 'Supabase URL not configured' });

        const body = await parseJSONBody(req) || {};
        const rpcBody = mapBody(body);

        const rpcUrl = supabaseUrl.replace(/\/$/, '') + rpcPath;

        // Prefer user token passthrough; else fall back to service role; else anon
        const key = serviceRole || runtime.anonKey || '';
        const headers = {
          'Content-Type': 'application/json',
          'apikey': authHeader ? (runtime.anonKey || key) : key,
          'Authorization': authHeader ? String(authHeader) : (key ? `Bearer ${key}` : undefined),
        };
        if (!headers.Authorization) delete headers.Authorization;

        const response = await fetch(rpcUrl, {
          method: req.method || 'POST',
          headers,
          body: JSON.stringify(rpcBody),
        });

        const text = await response.text();
        let data;
        try { data = JSON.parse(text); } catch (e) { data = text; }

        if (!response.ok) return sendJSON(res, response.status, { error: 'Supabase RPC error', details: data });
        return sendJSON(res, 200, data);
      } catch (err) {
        console.error('Error in handleRpcProxy:', err);
        return sendJSON(res, 500, { error: 'Internal server error' });
      }
    };

    const server = http.createServer(async (req, res) => {
      try {
        // Log incoming request (avoid printing auth token value)
        const authHeader = req.headers['authorization'] || req.headers['Authorization'];
        console.log('[DEV SERVER] Incoming', req.method, req.url, 'content-length=', req.headers['content-length'] || 0, 'auth_present=', !!authHeader);

        // Simple security headers
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-XSS-Protection', '1; mode=block');

        const url = req.url || '/';

        // Health route to validate supabase connectivity
        if (url.startsWith('/api/health')) {
          try {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
            const serviceRole = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
            if (!supabaseUrl) return sendJSON(res, 500, { error: 'Supabase URL not configured' });
            if (!serviceRole) return sendJSON(res, 500, { error: 'Supabase service role key not configured' });

            const testUrl = supabaseUrl.replace(/\/$/, '') + '/rest/v1/invoices?select=id&limit=1';
            const response = await fetch(testUrl, { headers: { 'apikey': serviceRole, 'Authorization': `Bearer ${serviceRole}` } });
            const text = await response.text();
            let data;
            try { data = JSON.parse(text); } catch (e) { data = text; }
            console.log('[DEV SERVER] Health check response status=', response.status);
            return sendJSON(res, 200, { ok: response.ok, status: response.status, data });
          } catch (err) {
            console.error('Health check failed:', err);
            return sendJSON(res, 500, { ok: false, error: String(err) });
          }
        }

        // API routes
        if (url.startsWith('/api/rpc/')) {
          const fnName = url.replace(/^\/?api\/rpc\//, '').split('?')[0];
          if (!fnName) return sendJSON(res, 400, { error: 'Function name is required' });
          return handleRpcProxy(`/rest/v1/rpc/${fnName}`, req, res);
        }

        if (url.startsWith('/api/leases/expiring')) {
          return handleRpcProxy('/rest/v1/rpc/get_lease_expiry_report', req, res, (body) => {
            const out = {};
            if (body.p_start_date) out.p_start_date = body.p_start_date;
            if (body.p_end_date) out.p_end_date = body.p_end_date;
            return out;
          });
        }

        // Proxy Supabase Edge Functions with service role for safer server-side execution
        if (url.startsWith('/api/edge/')) {
          try {
            // Load runtime config for fallback values
            let runtime = {};
            try {
              const runtimePath = path.join(__dirname, 'supabase', 'runtime.json');
              if (fs.existsSync(runtimePath)) {
                runtime = JSON.parse(fs.readFileSync(runtimePath, 'utf-8'));
              }
            } catch {}

            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || runtime.url;
            // Prefer service role if available, else fall back to anon for public proxy (used only for non-sensitive flows)
            const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || runtime.serviceRole || runtime.anonKey;
            if (!supabaseUrl) return sendJSON(res, 500, { error: 'Supabase URL not configured' });
            if (!key) return sendJSON(res, 500, { error: 'Supabase key not configured (service role or anon)' });

            const fnName = url.replace(/^\/?api\/edge\//, '').split('?')[0];
            if (!fnName) return sendJSON(res, 400, { error: 'Function name is required' });
            const body = await parseJSONBody(req) || {};

            const fnUrl = supabaseUrl.replace(/\/$/, '') + `/functions/v1/${fnName}`;
            const headers = {
              'Content-Type': 'application/json',
              'apikey': key,
              'Authorization': `Bearer ${key}`,
            };
            // pass through force header when creating tenant
            if (fnName === 'create-tenant-account' || body.force) headers['x-force-create'] = 'true';

            const response = await fetch(fnUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify(body),
            });

            const text = await response.text();
            let data;
            try { data = JSON.parse(text); } catch { data = text; }
            if (!response.ok) return sendJSON(res, response.status, { error: 'Edge function proxy error', details: data });
            return sendJSON(res, 200, data);
          } catch (err) {
            console.error('Error proxying edge function:', err);
            return sendJSON(res, 500, { error: 'Internal server error' });
          }
        }

        if (url.startsWith('/api/invoices/overview')) {
          return handleRpcProxy('/rest/v1/rpc/get_invoice_overview', req, res, (body) => ({
            p_limit: body.p_limit ?? 50,
            p_offset: body.p_offset ?? 0,
            p_status: body.p_status ?? null,
            p_search: body.p_search ?? null
          }));
        }

        if (url.startsWith('/api/invoices/create')) {
          // This will post to /rest/v1/invoices
          try {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
            const serviceRole = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY;
            if (!supabaseUrl) return sendJSON(res, 500, { error: 'Supabase URL not configured' });
            if (!serviceRole) return sendJSON(res, 500, { error: 'Supabase service role key (SUPABASE_SERVICE_ROLE) not configured on the server' });

            const body = await parseJSONBody(req) || {};
            const { lease_id, tenant_id, amount, due_date, description } = body;
            if (!lease_id || !tenant_id || !amount || !due_date) return sendJSON(res, 400, { error: 'lease_id, tenant_id, amount and due_date are required' });

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

            if (!response.ok) return sendJSON(res, response.status, { error: 'Supabase insert error', details: data });
            return sendJSON(res, 200, { data });
          } catch (err) {
            console.error('Error in /api/invoices/create:', err);
            return sendJSON(res, 500, { error: 'Internal server error' });
          }
        }

        // Fallback for other /api routes
        if (url.startsWith('/api')) {
          console.log('[DEV SERVER] API route not found:', url);
          return sendJSON(res, 404, { error: 'API endpoint not found' });
        }

        // Serve static files from ./dist if present (useful for preview builds)
        const pathname = url.split('?')[0];
        const filePath = path.join(__dirname, 'dist', pathname === '/' ? '/index.html' : pathname);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const mime = ext === '.html' ? 'text/html' : ext === '.js' ? 'application/javascript' : ext === '.css' ? 'text/css' : 'application/octet-stream';
          console.log('[DEV SERVER] Serving static file:', filePath);
          res.writeHead(200, { 'Content-Type': mime });
          fs.createReadStream(filePath).pipe(res);
          return;
        }

        // SPA fallback to index.html if exists
        const indexPath = path.join(__dirname, 'dist', 'index.html');
        if (fs.existsSync(indexPath)) {
          console.log('[DEV SERVER] SPA fallback to index.html');
          res.writeHead(200, { 'Content-Type': 'text/html' });
          fs.createReadStream(indexPath).pipe(res);
          return;
        }

        // Nothing to serve
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');

      } catch (err) {
        console.error('Server error:', err);
        sendJSON(res, 500, { error: 'Internal server error' });
      }
    });

    server.listen(port, () => {
      console.log(`Fallback HTTP API server running on port ${port}`);
    });

  } catch (err) {
    console.warn('Failed to initialize fallback server:', err && err.message ? err.message : err);
  }
})();

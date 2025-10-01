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

    const safeFetch = async (url, opts) => {
      try {
        const res = await fetch(url, opts);
        return res;
      } catch (err) {
        console.error('[DEV SERVER] safeFetch network error to', url, 'opts_headers=', opts && opts.headers ? Object.keys(opts.headers) : null, 'error=', err && err.message ? err.message : String(err));
        throw err;
      }
    };

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

            // Special-case handling for create-sub-user: implement server-side flow using service role
            if (fnName === 'create-sub-user') {
              try {
                console.log('[DEV SERVER] create-sub-user body:', body);
                // Validate input
                const email = (body && body.email) ? String(body.email) : null;
                const first_name = body?.first_name || '';
                const last_name = body?.last_name || '';
                const phone = body?.phone || '0000000000';
                const permissions = body?.permissions || {};
                if (!email) return sendJSON(res, 400, { error: 'email is required' });

                // Determine landlord (caller) from Authorization header if present
                const callerAuth = req.headers['authorization'] || req.headers['Authorization'];
                let landlordId = null;
                if (callerAuth) {
                  try {
                    const userUrl = supabaseUrl.replace(/\/$/, '') + '/auth/v1/user';
                    const userRes = await fetch(userUrl, { headers: { 'apikey': key, 'Authorization': String(callerAuth) } });
                    const userText = await userRes.text();
                    const userData = (() => { try { return JSON.parse(userText); } catch { return null; } })();
                    landlordId = userData?.id || null;
                  } catch (e) { console.warn('Failed to fetch caller user info:', e); }
                }

                // Dev fallback: allow supplying landlord_id in request body or x-landlord-id header
                if (!landlordId) {
                  if (body?.landlord_id) {
                    landlordId = String(body.landlord_id);
                    console.warn('Using landlord_id from request body as dev fallback:', landlordId);
                  } else if (req.headers['x-landlord-id']) {
                    landlordId = String(req.headers['x-landlord-id']);
                    console.warn('Using x-landlord-id header as dev fallback:', landlordId);
                  }
                }

                if (!landlordId) return sendJSON(res, 401, { error: 'Unauthorized: landlord token required' });

                // 1) Check for existing profile by email
                const profilesUrl = supabaseUrl.replace(/\/$/, '') + `/rest/v1/profiles?select=id,email&email=eq.${encodeURIComponent(email)}`;
                const profilesRes = await fetch(profilesUrl, { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } });
                const profilesText = await profilesRes.text();
                let profilesData; try { profilesData = JSON.parse(profilesText); } catch { profilesData = null; }

                let userId = null;
                let tempPassword = null;
                if (Array.isArray(profilesData) && profilesData.length > 0 && profilesData[0]?.id) {
                  userId = profilesData[0].id;
                } else {
                  // 2) Create auth user via Admin API
                  const adminCreateUrl = supabaseUrl.replace(/\/$/, '') + '/auth/v1/admin/users';
                  tempPassword = `TempPass${Math.floor(Math.random() * 10000)}!`;
                  const createResp = await fetch(adminCreateUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': key, 'Authorization': `Bearer ${key}` },
                    body: JSON.stringify({ email, password: tempPassword, email_confirm: true, user_metadata: { first_name, last_name, phone, created_by: landlordId, role: 'sub_user' } })
                  });
                  const createText = await createResp.text();
                  let createData; try { createData = JSON.parse(createText); } catch { createData = null; }
                  if (!createResp.ok) {
                    return sendJSON(res, createResp.status, { error: 'Failed to create auth user', details: createData });
                  }
                  // createData should contain id
                  userId = createData?.id || createData?.user?.id || null;
                  if (!userId) return sendJSON(res, 500, { error: 'Auth user created but no id returned', details: createData });

                  // 3) Create profile record
                  const profilesInsertUrl = supabaseUrl.replace(/\/$/, '') + '/rest/v1/profiles';
                  const profilePayload = { id: userId, first_name, last_name, email, phone };
                  console.log('[DEV SERVER] Creating profile with payload:', profilePayload);
                  const profileResp = await fetch(profilesInsertUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'apikey': key, 'Authorization': `Bearer ${key}`, 'Prefer': 'return=representation' },
                    body: JSON.stringify(profilePayload)
                  });
                  const profileText = await profileResp.text();
                  let profileData; try { profileData = JSON.parse(profileText); } catch { profileData = null; }
                  if (!profileResp.ok) {
                    console.warn('[DEV SERVER] Profile creation failed, continuing with created auth user. Details:', profileData);
                    // Do not abort; continue to create sub_user record even if profile creation failed in dev
                  }
                }

                // 4) Insert sub_users record
                const subUsersUrl = supabaseUrl.replace(/\/$/, '') + '/rest/v1/sub_users';
                const insertPayload = {
                  landlord_id: landlordId,
                  user_id: userId,
                  title: body.title || null,
                  permissions: permissions,
                  status: 'active'
                };
                const subResp = await fetch(subUsersUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'apikey': key, 'Authorization': `Bearer ${key}`, 'Prefer': 'return=representation' },
                  body: JSON.stringify(insertPayload)
                });
                const subText = await subResp.text();
                let subData; try { subData = JSON.parse(subText); } catch { subData = null; }
                if (!subResp.ok) {
                  return sendJSON(res, subResp.status, { error: 'Failed to create sub_user record', details: subData });
                }

                return sendJSON(res, 200, { success: true, message: 'Sub-user created', user_id: userId, temporary_password: tempPassword || null });

              } catch (err) {
                console.error('Error handling create-sub-user proxy:', err);
                return sendJSON(res, 500, { error: 'Internal server error handling create-sub-user', details: String(err) });
              }
            }

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

        // Generic proxy for Supabase REST/RPC requests from the browser during dev
        if (url === '/api/proxy' && req.method === 'POST') {
          try {
            const body = await parseJSONBody(req) || {};
            const targetUrl = body.url || '';
            const method = body.method || 'POST';
            const payload = body.body ? JSON.stringify(body.body) : body.rawBody || null;
            const incomingAuth = req.headers['authorization'] || req.headers['Authorization'];

            // Allow only requests to the configured Supabase URL
            // Load runtime defaults if present
            let runtimeConf = {};
            try {
              const runtimePath = path.join(__dirname, 'supabase', 'runtime.json');
              if (fs.existsSync(runtimePath)) runtimeConf = JSON.parse(fs.readFileSync(runtimePath, 'utf-8'));
            } catch (e) {}

            // Resolve Supabase URL and service key from environment (fallback to known runtime value)
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://kdpqimetajnhcqseajok.supabase.co';
            if (!supabaseUrl) return sendJSON(res, 500, { error: 'Supabase URL not configured' });
            if (!targetUrl || !targetUrl.startsWith(supabaseUrl.replace(/\/$/, ''))) return sendJSON(res, 400, { error: 'Invalid target URL' });

            // Use service role for apikey; prefer explicit env
            const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
            if (!key) return sendJSON(res, 500, { error: 'Supabase key not configured' });

            const headers = {
              'Content-Type': 'application/json',
              'apikey': key,
              'Authorization': incomingAuth ? String(incomingAuth) : `Bearer ${key}`
            };

            const response = await fetch(targetUrl, {
              method,
              headers,
              body: payload
            });

            const text = await response.text();
            let data; try { data = JSON.parse(text); } catch { data = text; }
            return sendJSON(res, response.status, data);
          } catch (err) {
            console.error('Error in /api/proxy:', err);
            return sendJSON(res, 500, { error: 'Internal proxy error', details: String(err) });
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

// Lightweight runtime health check for Supabase connectivity
export async function checkSupabaseConnectivity(supabaseUrl: string, anonKey?: string, timeoutMs = 3000) {
  if (!supabaseUrl) {
    console.error('Supabase health check skipped: SUPABASE_URL is not configured.');
    return { ok: false, reason: 'missing_url' };
  }

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {};
    if (anonKey) headers['apikey'] = anonKey;

    const resp = await fetch(supabaseUrl, { method: 'GET', mode: 'cors', headers, signal: controller.signal });
    clearTimeout(id);

    if (!resp.ok) {
      console.error('Supabase health check failed: received non-OK response', resp.status, resp.statusText);
      return { ok: false, reason: 'http_error', status: resp.status };
    }

    return { ok: true };
  } catch (err: any) {
    clearTimeout(id);
    if (err.name === 'AbortError') {
      console.error('Supabase health check timed out (CORS/network issue).');
      return { ok: false, reason: 'timeout' };
    }
    console.error('Supabase health check error:', err.message || err);
    return { ok: false, reason: 'network' };
  }
}

// Lightweight helper to call server-side REST proxy for Supabase table operations

function buildQueryString(params: Record<string, string | number | boolean> = {}) {
  const parts: string[] = [];
  for (const key of Object.keys(params)) {
    const value = params[key];
    // Allow passing keys containing operators like 'payment_date' => 'gte.iso' or 'payment_date2' => 'lte.iso'
    // For keys that end with '2' we strip the suffix to allow multiple constraints on same column
    const normalizedKey = key.endsWith('2') ? key.slice(0, -1) : key;
    parts.push(encodeURIComponent(normalizedKey) + '=' + encodeURIComponent(String(value)));
  }
  return parts.length ? '&' + parts.join('&') : '';
}

export async function restSelect(table: string, select = '*', filters: Record<string, string | number | boolean> = {}, single = false) {
  const qs = buildQueryString(filters);
  const url = `/api/supabase/rest/${encodeURIComponent(table)}?select=${encodeURIComponent(select)}${qs}`;
  const resp = await fetch(url, { method: 'GET', credentials: 'same-origin' });
  const text = await resp.text();
  try { const data = JSON.parse(text); return { data: single ? (Array.isArray(data) ? data[0] : data) : data, error: resp.ok ? null : { status: resp.status, text } } } catch (e) { return { data: text as any, error: resp.ok ? null : { status: resp.status, text } } }
}

export async function restUpsert(table: string, body: any) {
  const url = `/api/supabase/rest/${encodeURIComponent(table)}`;
  const resp = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(body)
  });
  const text = await resp.text();
  try { return { data: JSON.parse(text), error: resp.ok ? null : { status: resp.status, text } } } catch (e) { return { data: text as any, error: resp.ok ? null : { status: resp.status, text } } }
}

export async function restPost(table: string, body: any) {
  const url = `/api/supabase/rest/${encodeURIComponent(table)}`;
  const resp = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await resp.text();
  try { return { data: JSON.parse(text), error: resp.ok ? null : { status: resp.status, text } } } catch (e) { return { data: text as any, error: resp.ok ? null : { status: resp.status, text } } }
}

export async function restUpdate(table: string, body: any, filters: Record<string, string | number | boolean> = {}) {
  const qs = buildQueryString(filters).replace(/^&/, '?');
  const url = `/api/supabase/rest/${encodeURIComponent(table)}${qs}`;
  const resp = await fetch(url, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await resp.text();
  try { return { data: JSON.parse(text), error: resp.ok ? null : { status: resp.status, text } } } catch (e) { return { data: text as any, error: resp.ok ? null : { status: resp.status, text } } }
}

export async function restDelete(table: string, filters: Record<string, string | number | boolean> = {}) {
  const qs = buildQueryString(filters).replace(/^&/, '?');
  const url = `/api/supabase/rest/${encodeURIComponent(table)}${qs}`;
  const resp = await fetch(url, {
    method: 'DELETE',
    credentials: 'same-origin'
  });
  const text = await resp.text();
  try { return { data: JSON.parse(text), error: resp.ok ? null : { status: resp.status, text } } } catch (e) { return { data: text as any, error: resp.ok ? null : { status: resp.status, text } } }
}

export async function rpcProxy(fnName: string, params: any) {
  const url = `/api/supabase/rpc/${encodeURIComponent(fnName)}`;
  const resp = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params || {})
  });
  const text = await resp.text();
  try { return { data: JSON.parse(text), error: resp.ok ? null : { status: resp.status, text } } } catch (e) { return { data: text as any, error: resp.ok ? null : { status: resp.status, text } } }
}

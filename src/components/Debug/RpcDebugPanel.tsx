import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const RpcDebugPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dashboardResp, setDashboardResp] = useState<any>(null);
  const [tenantsResp, setTenantsResp] = useState<any>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setLastError(null);

    try {
      const [d, t] = await Promise.all([
        supabase.rpc('get_landlord_dashboard_data').then(res => res).catch(e => ({ error: e })),
        supabase.rpc('get_landlord_tenants_summary', { p_limit: 50, p_offset: 0 }).then(res => res).catch(e => ({ error: e })),
      ]);

      // normalize responses
      const norm = (r: any) => {
        if (!r) return null;
        if (r.error) return { error: formatError(r.error) };
        return { data: r.data ?? r };
      };

      setDashboardResp(norm(d));
      setTenantsResp(norm(t));
    } catch (err) {
      setLastError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const formatError = (e: any) => {
    try {
      if (!e) return 'Unknown error';
      if (typeof e === 'string') return e;
      const parts: string[] = [];
      if (e.message) parts.push(e.message);
      if (e.details) parts.push(e.details);
      if (e.hint) parts.push(`hint: ${e.hint}`);
      if (parts.length === 0) return JSON.stringify(e);
      return parts.join(' | ');
    } catch (err) {
      return String(e);
    }
  };

  const copyToClipboard = (text: string) => {
    try {
      navigator.clipboard.writeText(text);
    } catch (e) {
      // ignore
    }
  };

  return (
    <div>
      <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 9999 }}>
        <button
          onClick={() => {
            const next = !open;
            setOpen(next);
            if (next && !dashboardResp && !tenantsResp) fetchAll();
          }}
          title="Toggle RPC Debug Panel"
          className="bg-white/10 hover:bg-white/20 text-white rounded-full px-3 py-2 shadow-md border border-white/10"
        >
          RPC
        </button>
      </div>

      {open && (
        <div style={{ position: 'fixed', right: 16, bottom: 64, zIndex: 9999, width: 'min(1100px, 95vw)', maxHeight: '70vh', overflow: 'auto' }}>
          <div className="bg-card border border-border rounded-lg p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">RPC Debug Panel</h3>
              <div className="flex gap-2">
                <Button onClick={fetchAll} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</Button>
                <Button onClick={() => { setDashboardResp(null); setTenantsResp(null); setLastError(null); }}>Clear</Button>
                <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
              </div>
            </div>

            {lastError && (
              <div className="mb-3 text-sm text-destructive">Last error: {lastError}</div>
            )}

            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <strong>Dashboard RPC (get_landlord_dashboard_data)</strong>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => copyToClipboard(JSON.stringify(dashboardResp, null, 2))}>Copy</Button>
                  </div>
                </div>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '50vh', overflow: 'auto' }} className="text-sm bg-muted/10 p-2 rounded">
                  {dashboardResp ? JSON.stringify(dashboardResp, null, 2) : 'No data fetched yet'}
                </pre>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <strong>Tenants RPC (get_landlord_tenants_summary)</strong>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => copyToClipboard(JSON.stringify(tenantsResp, null, 2))}>Copy</Button>
                  </div>
                </div>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '50vh', overflow: 'auto' }} className="text-sm bg-muted/10 p-2 rounded">
                  {tenantsResp ? JSON.stringify(tenantsResp, null, 2) : 'No data fetched yet'}
                </pre>
              </div>
            </div>

            <div className="mt-3 text-xs text-muted-foreground">
              Note: This panel makes unauthenticated RPC calls using the browser session. Data returned respects RLS and current auth.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RpcDebugPanel;

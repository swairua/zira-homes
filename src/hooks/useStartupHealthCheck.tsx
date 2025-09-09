import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { restSelect, rpcProxy } from '@/integrations/supabase/restProxy';

interface HealthCheckResult {
  status: 'checking' | 'healthy' | 'degraded' | 'failed';
  issues: string[];
  lastChecked: Date | null;
}

interface HealthCheckDetails {
  database: boolean;
  rpcAvailability: boolean;
  authConnection: boolean;
}

export function useStartupHealthCheck() {
  const [healthStatus, setHealthStatus] = useState<HealthCheckResult>({
    status: 'checking',
    issues: [],
    lastChecked: null
  });

  useEffect(() => {
    performHealthCheck();
  }, []);

  const performHealthCheck = async () => {
    const issues: string[] = [];
    const checks: HealthCheckDetails = {
      database: false,
      rpcAvailability: false,
      authConnection: false
    };

    try {
      // Check 1: Basic database connectivity
      try {
        const res = await restSelect('profiles', 'id', {}, true);
        if (!res.error) {
          checks.database = true;
        } else {
          issues.push('Database connection failed');
        }
      } catch (err) {
        issues.push('Database connectivity error');
      }

      // Check 2: Critical RPC availability
      try {
        const rpcRes = await rpcProxy('get_landlord_dashboard_data', {});
        if (!rpcRes.error) {
          checks.rpcAvailability = true;
        } else {
          // If rpcRes.error contains function-not-found, treat as missing
          issues.push('Critical database functions may be unavailable');
        }
      } catch (err) {
        issues.push('RPC functions may be unavailable');
      }

      // Check 3: Auth service connection (server-side check)
      try {
        const resp = await fetch('/api/auth/user');
        if (resp.ok) {
          const payload = await resp.json();
          if (payload && payload.user) {
            checks.authConnection = true;
          } else {
            // no session but service reachable
            checks.authConnection = true;
          }
        } else {
          issues.push('Authentication service connection issue');
        }
      } catch (err) {
        issues.push('Auth service connectivity error');
      }

      // Determine overall health status
      const healthyChecks = Object.values(checks).filter(Boolean).length;
      const totalChecks = Object.keys(checks).length;

      let status: HealthCheckResult['status'];
      if (healthyChecks === totalChecks) {
        status = 'healthy';
      } else if (healthyChecks > 0) {
        status = 'degraded';
      } else {
        status = 'failed';
      }

      setHealthStatus({
        status,
        issues,
        lastChecked: new Date()
      });

    } catch (error) {
      console.error('Health check failed:', error);
      setHealthStatus({
        status: 'failed',
        issues: ['Health check system error'],
        lastChecked: new Date()
      });
    }
  };

  return {
    healthStatus,
    recheckHealth: performHealthCheck
  };
}

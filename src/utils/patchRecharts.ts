// Remove defaultProps from Recharts function components to avoid React deprecation warnings
// This runs early to patch the module exports before components are rendered.
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Recharts = require('recharts');
  if (Recharts && typeof Recharts === 'object') {
    Object.keys(Recharts).forEach((key) => {
      try {
        const value = Recharts[key];
        if (value && (typeof value === 'function' || typeof value === 'object')) {
          if ('defaultProps' in value) {
            try { delete value.defaultProps; } catch (e) { /* ignore */ }
          }
        }
      } catch (e) {
        // ignore per-key errors
      }
    });
    if (typeof window !== 'undefined') {
      try { (window as any).__RECHARTS_PATCHED = true; } catch (e) { /* ignore */ }
    }
  }
} catch (e) {
  // If require fails (e.g., module not present), fail silently
  // This is non-fatal; the import will be attempted later where needed.
}

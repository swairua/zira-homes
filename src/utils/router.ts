export function isHashRouting(): boolean {
  // Consider hash routing if a hash exists and starts with '/'
  return typeof window !== 'undefined' && window.location.hash.startsWith('#/');
}

export function getCurrentPath(): string {
  if (typeof window === 'undefined') return '/';
  const hash = window.location.hash;
  if (hash && hash.startsWith('#/')) {
    // Remove leading '#'
    const pathWithQuery = hash.substring(1);
    // Ensure leading slash
    return pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
  }
  return window.location.pathname || '/';
}

export function navigateTo(path: string, replace = false): void {
  if (typeof window === 'undefined') return;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (isHashRouting()) {
    const target = `#${normalized}`;
    if (replace) {
      // Use replace without adding history entry
      window.location.replace(target);
    } else {
      window.location.hash = target;
    }
    return;
  }
  if (replace) {
    window.location.replace(normalized);
  } else {
    window.location.href = normalized;
  }
}

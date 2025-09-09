// Production console log cleaner - removes debug logs in production
const isProduction = process.env.NODE_ENV === 'production';

// Store original console methods
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

// Expose originals on window for other modules (logger/consoleReplacer) to use.
if (typeof window !== 'undefined') {
  try {
    (window as any).__ORIGINAL_CONSOLE = {
      log: originalLog.bind(console),
      warn: originalWarn.bind(console),
      error: originalError.bind(console),
      info: console.info.bind(console),
      debug: console.debug.bind(console),
    };
  } catch (e) {
    // ignore
  }
}

function sanitizeMessageFromArgs(args: any[]) {
  try {
    const raw = args
      .map(a => typeof a === 'string' ? a : (typeof a === 'object' ? JSON.stringify(a) : String(a)))
      .join(' ');
    // Remove ANSI escape codes and HTML tags to normalize
    const noAnsi = raw.replace(/\x1b\[[0-9;]*m/g, '');
    const noHtml = noAnsi.replace(/<[^>]*>/g, '');
    return noHtml.trim().toLowerCase();
  } catch (e) {
    try { return String(args).toLowerCase(); } catch { return ''; }
  }
}

function shouldSuppressMessage(message: string) {
  if (!message) return false;
  const patterns: RegExp[] = [
    /defaultprops/, // direct mention
    /support for defaultprops/, // explicit phrase
    /will be removed.*defaultprops/, // variations mentioning removal
    /deprecated.*defaultprops/, // deprecated mention
    /default props.*will be removed/, // another ordering
    /support for `defaultProps`/, // backtick variant
  ];
  return patterns.some(p => p.test(message));
}

// Override console methods in production
if (isProduction) {
  console.log = () => {}; // Disable console.log in production

  console.warn = (...args: any[]) => {
    const message = sanitizeMessageFromArgs(args);
    if (shouldSuppressMessage(message)) return; // swallow these noisy React warnings

    // Only show warnings for critical issues
    if (args.some(arg => typeof arg === 'string' && (
      arg.includes('PDF') ||
      arg.toLowerCase().includes('database') ||
      arg.toLowerCase().includes('auth') ||
      arg.toLowerCase().includes('payment')
    ))) {
      originalWarn(...args);
    }
  };

  // Keep console.error for debugging production issues
  console.error = originalError;
}

// Additionally, suppress the same React defaultProps warning in development to reduce noise
if (!isProduction) {
  console.warn = ((origWarn) => {
    return (...args: any[]) => {
      try {
        const message = sanitizeMessageFromArgs(args);
        if (shouldSuppressMessage(message)) {
          return; // swallow noisy defaultProps warnings
        }
      } catch (e) {
        // ignore serialization error
      }
      origWarn(...args);
    };
  })(console.warn.bind(console));
}

// Performance monitoring for development
export const performanceLog = (operation: string, duration: number) => {
  if (!isProduction && duration > 1000) {
    originalWarn(`🐌 Slow operation detected: ${operation} took ${duration}ms`);
  }
};

// Utility for timing operations
export const measurePerformance = async <T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> => {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    performanceLog(operation, duration);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`❌ ${operation} failed after ${duration}ms:`, error);
    throw error;
  }
};

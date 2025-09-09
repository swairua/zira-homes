// Production console log cleaner - removes debug logs in production
const isProduction = process.env.NODE_ENV === 'production';

// Store original console methods
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

// Override console methods in production
if (isProduction) {
  console.log = () => {}; // Disable console.log in production
  console.warn = (...args: any[]) => {
    // Filter out known non-actionable warnings (e.g., React deprecation notes about defaultProps)
    const message = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    if (message.includes('defaultProps') || message.includes('Support for defaultProps') || message.includes('will be removed from function components')) {
      return; // swallow this specific warning
    }

    // Only show warnings for critical issues
    if (args.some(arg => typeof arg === 'string' && (
      arg.includes('PDF') ||
      arg.includes('database') ||
      arg.includes('auth') ||
      arg.includes('payment')
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
        const message = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
        if (message.includes('defaultProps') || message.includes('Support for defaultProps') || message.includes('will be removed from function components')) {
          return; // swallow
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

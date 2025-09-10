// Production console log cleaner - removes debug logs in production
const isProduction = process.env.NODE_ENV === 'production';

// Store original console methods
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

// Override console methods in production and filter noisy warnings in development
if (isProduction) {
  console.log = () => {}; // Disable console.log in production
  console.warn = (...args: any[]) => {
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
} else {
  // In development, filter known noisy library warnings (e.g., Recharts defaultProps deprecation)
  console.warn = (...args: any[]) => {
    try {
      const message = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      if (message.includes('Support for defaultProps will be removed from function components') && (message.includes('XAxis') || message.includes('YAxis'))) {
        // ignore this specific Recharts warning
        return;
      }
    } catch (e) {
      // If serialization fails, fall through to original warn
    }
    originalWarn(...args);
  };
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

const fallbackOriginal = {
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};

const originalConsole = (typeof window !== 'undefined' && (window as any).__ORIGINAL_CONSOLE)
  ? (window as any).__ORIGINAL_CONSOLE
  : fallbackOriginal;

export const logger = {
  info: (...args: any[]) => originalConsole.info(...args),
  warn: (...args: any[]) => originalConsole.warn(...args),
  error: (...args: any[]) => originalConsole.error(...args),
  debug: (...args: any[]) => originalConsole.debug(...args),
};

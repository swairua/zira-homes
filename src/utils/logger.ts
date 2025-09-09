const originalConsole = {
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
};

export const logger = {
  info: (...args: any[]) => originalConsole.info(...args),
  warn: (...args: any[]) => originalConsole.warn(...args),
  error: (...args: any[]) => originalConsole.error(...args),
  debug: (...args: any[]) => originalConsole.debug(...args),
};

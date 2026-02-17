export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
  debug: (message: string, meta?: unknown) => void;
  info: (message: string, meta?: unknown) => void;
  warn: (message: string, meta?: unknown) => void;
  error: (message: string, meta?: unknown) => void;
}

const isEnabled = (level: LogLevel): boolean => {
  if (import.meta.dev) return true;
  return level === 'warn' || level === 'error';
};

const format = (level: LogLevel, message: string): string => {
  return `[${level.toUpperCase()}] ${message}`;
};

const write = (level: LogLevel, message: string, meta?: unknown): void => {
  if (!isEnabled(level)) return;

  const formatted = format(level, message);

  if (level === 'error') {
     
    console.error(formatted, meta);
    return;
  }

  if (level === 'warn') {
     
    console.warn(formatted, meta);
    return;
  }

  if (level === 'info') {
     
    console.info(formatted, meta);
    return;
  }

   
  console.debug(formatted, meta);
};

export const logger: Logger = {
  debug: (message, meta) => write('debug', message, meta),
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
};

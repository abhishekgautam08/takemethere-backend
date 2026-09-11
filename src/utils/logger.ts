type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function formatTimestamp(): string {
  return new Date().toISOString();
}

function safeStringify(data: unknown): string {
  try {
    return typeof data === 'object' ? JSON.stringify(data) : String(data);
  } catch {
    return '[Unserializable]';
  }
}

export const logger = {
  info: (message: string, meta?: unknown) => {
    console.log(`[\x1b[36mINFO\x1b[0m] [${formatTimestamp()}] ${message} ${meta ? safeStringify(meta) : ''}`);
  },
  warn: (message: string, meta?: unknown) => {
    console.warn(`[\x1b[33mWARN\x1b[0m] [${formatTimestamp()}] ${message} ${meta ? safeStringify(meta) : ''}`);
  },
  error: (message: string, error?: unknown) => {
    console.error(`[\x1b[31mERROR\x1b[0m] [${formatTimestamp()}] ${message}`, error || '');
  },
  debug: (message: string, meta?: unknown) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[\x1b[90mDEBUG\x1b[0m] [${formatTimestamp()}] ${message} ${meta ? safeStringify(meta) : ''}`);
    }
  },
};

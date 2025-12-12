// Lightweight structured logger
// Uses Raindrop env logger when available, falls back to JSON console logs

type LogLevel = 'info' | 'warn' | 'error';

function log(level: LogLevel, message: string, data?: Record<string, any>, env?: any) {
  const payload = { level, message, ...(data || {}) };
  if (env?.logger && typeof env.logger[level] === 'function') {
    env.logger[level](message, data || {});
  } else {
    const line = JSON.stringify({ level, message, ...data, timestamp: new Date().toISOString() });
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }
}

export const logger = {
  info: (message: string, data?: Record<string, any>, env?: any) => log('info', message, data, env),
  warn: (message: string, data?: Record<string, any>, env?: any) => log('warn', message, data, env),
  error: (message: string, data?: Record<string, any>, env?: any) => log('error', message, data, env),
};

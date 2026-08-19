import pino, { type Logger, type LoggerOptions } from 'pino';
import { config } from '../config/env.js';

const isDev = config.nodeEnv === 'development';

/**
 * Secrets that must never reach a log line.
 *
 * The corpus section widened what this process holds — the ingest API key above
 * all, which would otherwise be printed whole the first time someone logs a
 * config object or a request header.
 */
const redact: LoggerOptions['redact'] = {
    paths: [
        'authorization',
        'Authorization',
        'headers.authorization',
        'headers.cookie',
        'req.headers.authorization',
        'req.headers.cookie',
        '*.password',
        '*.token',
        '*.apiKey',
        '*.api_key',
    ],
    censor: '[redacted]',
};

export const logger = pino({
    level: config.logLevel,
    redact,
    ...(isDev
        ? {
              transport: {
                  target: 'pino-pretty',
                  options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
              },
          }
        : {}),
});

/**
 * A child logger carrying correlation fields; undefined values are dropped.
 *
 * Field spelling is `session_id` / `flow_id` / `transaction_id`, matching the
 * wire, the Mongo documents and the engine's own logs, so one Loki query spans
 * the engine and this service.
 */
export function childLogger(fields: Record<string, unknown>): Logger {
    return logger.child(
        Object.fromEntries(
            Object.entries(fields).filter(([, value]) => value !== undefined)
        )
    );
}

export default logger;

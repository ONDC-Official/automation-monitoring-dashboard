import pino from 'pino';
import { config } from '../config/env';

const isDev = config.nodeEnv !== 'production';

export const logger = pino({
    level: config.logLevel,
    ...(isDev
        ? {
              transport: {
                  target: 'pino-pretty',
                  options: { colorize: true, translateTime: 'SYS:HH:MM:ss' },
              },
          }
        : {}),
});

export default logger;

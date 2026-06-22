import { createServer } from './server';
import { config, validateEnv } from './config/env';
import { closeRedis } from './redis/client';
import logger from './observability/logger';

validateEnv();

const app = createServer();
const server = app.listen(config.port, () => {
    logger.info(
        `admin-monitoring backend listening on :${config.port} (${config.nodeEnv})`
    );
});

const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
        await closeRedis();
        process.exit(0);
    });
    // Force-exit if graceful close hangs.
    setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', err => {
    logger.fatal({ err }, 'uncaught exception');
    shutdown('uncaughtException');
});
process.on('unhandledRejection', reason => {
    logger.fatal({ reason }, 'unhandled rejection');
});

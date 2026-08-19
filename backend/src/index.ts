import { createServer } from './server.js';
import { config, validateEnv } from './config/env.js';
import { closeRedis } from './redis/client.js';
import logger from './observability/logger.js';
import { initMcp } from './mcp/index.js';

validateEnv();

// Connects Mongo when MONGO_URL is set, and answers `undefined` when it is
// not — see `mcp/index.ts`. Awaited at boot rather than lazily on first
// request so a bad MONGO_URL fails here, loudly, instead of turning into a
// 503 an operator has to go looking for.
const mcp = await initMcp();

const app = createServer(mcp);
const server = app.listen(config.port, () => {
    logger.info(
        `admin-monitoring backend listening on :${config.port} (${config.nodeEnv})`
    );
});

const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
        await closeRedis();
        await mcp?.dispose();
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

import Redis from 'ioredis';
import { config } from '../config/env';
import logger from '../observability/logger';

/**
 * Two ioredis clients, one per logical DB, mirroring the monitored service's
 * setup (DB0 = business state, DB1 = runner config). Connection params and
 * retry strategy match automation-mock-playground-service.
 */

const build = (db: number): Redis => {
    const client = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        username: config.redis.username,
        password: config.redis.password,
        db,
        retryStrategy: times => Math.min(times * 50, 2000),
        // Dashboard is read-only and not on the hot path; don't crash on a
        // transient outage — surface it via /api/health instead.
        maxRetriesPerRequest: 2,
        lazyConnect: false,
    });

    client.on('error', err =>
        logger.error({ err, db }, 'redis client error')
    );
    client.on('connect', () => logger.info({ db }, 'redis connected'));

    return client;
};

export const redis0 = build(config.redis.db0);
export const redis1 = build(config.redis.db1);

export const clientForDb = (db: number): Redis =>
    db === config.redis.db1 ? redis1 : redis0;

export const closeRedis = async (): Promise<void> => {
    await Promise.allSettled([redis0.quit(), redis1.quit()]);
};

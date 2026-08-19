import { timingSafeEqual } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { collectDefaultMetrics, Registry } from 'prom-client';
import { config } from '@/config/env.js';
import { asyncHandler } from '@/middlewares/error.js';

/**
 * This service's OWN Prometheus exposition.
 *
 * Mounted at `/mcp-metrics`, not `/metrics`, and the name is the point: this
 * backend already serves `/api/metrics/*` as a read-through proxy to
 * Prometheus for the Metrics page. Those are opposite directions — one is
 * scraped, the other queries — and giving them adjacent names was the single
 * likeliest way for a scrape config to end up pointed at a proxy.
 *
 * Deliberately thin. The interesting numbers live in Mongo and are served by
 * `/api/mcp/stats`, which Grafana reads through the Infinity datasource. What
 * Prometheus wants from here is process health.
 */

/**
 * Its own registry, never prom-client's default global `register`.
 *
 * The global is process-wide mutable state, and a second registry build in one
 * vitest process would throw on re-registering a metric name.
 */
export function createRegistry(): Registry {
    const registry = new Registry();
    collectDefaultMetrics({ register: registry });
    return registry;
}

function tokenMatches(expected: string, presented: string | undefined): boolean {
    if (presented === undefined) return false;
    const a = Buffer.from(expected);
    const b = Buffer.from(presented);
    // Length-guarded first: `timingSafeEqual` throws on a mismatch, so an
    // unguarded compare turns a short hostile header into a 500 with a stack.
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}

export function mcpMetricsRoutes(): Router {
    const router = Router();
    const registry = createRegistry();
    const token = config.mcp.metricsToken;

    router.get(
        '/',
        asyncHandler(async (req: Request, res: Response) => {
            if (token !== undefined) {
                const header = req.headers.authorization;
                const presented =
                    typeof header === 'string' && header.startsWith('Bearer ')
                        ? header.slice('Bearer '.length)
                        : undefined;
                if (!tokenMatches(token, presented)) {
                    res.status(401).json({ error: 'unauthorized' });
                    return;
                }
            }

            res.type(registry.contentType).send(await registry.metrics());
        })
    );

    return router;
}

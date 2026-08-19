import { Router } from 'express';
import axios from 'axios';
import { config } from '../config/env.js';
import { asyncHandler } from '../middlewares/error.js';
import { pingDb } from '../redis/service.js';
import * as prom from '../proxies/prometheus.js';
import * as loki from '../proxies/loki.js';
import * as grafana from '../proxies/grafana.js';
import type { McpRuntime } from '../mcp/index.js';

/**
 * A dependency is up, down, or **not configured at all**.
 *
 * The third state is not cosmetic. `mongo` only exists when the MCP section is
 * switched on, and folding "absent" into `false` would report the whole
 * dashboard as `degraded` for every operator who watches only the playground
 * service — which is the supported default.
 */
export type DepState = boolean | 'disabled';

const checkService = async (): Promise<boolean> => {
    try {
        const { status } = await axios.get(config.serviceHealthUrl, {
            timeout: 4000,
        });
        return status >= 200 && status < 300;
    } catch {
        return false;
    }
};

export const buildHealthRoutes = (mcp: McpRuntime | undefined): Router => {
    const router = Router();

    /** GET /api/health — aggregate up/down for every dependency the dashboard uses. */
    router.get(
        '/',
        asyncHandler(async (_req, res) => {
            const [redis0, redis1, prometheus, lokiUp, grafanaUp, service, mongo] =
                await Promise.all([
                    pingDb(config.redis.db0),
                    pingDb(config.redis.db1),
                    prom.isUp(),
                    loki.isUp(),
                    grafana.isUp(),
                    checkService(),
                    mcp === undefined
                        ? Promise.resolve<DepState>('disabled')
                        : mcp.container.ping(),
                ]);

            const deps: Record<string, DepState> = {
                redisDb0: redis0,
                redisDb1: redis1,
                prometheus,
                loki: lokiUp,
                grafana: grafanaUp,
                monitoredService: service,
                mongo,
            };

            // A disabled dependency is not a failing one — see `DepState`.
            const ok = Object.values(deps).every(v => v === 'disabled' || v);

            // Always 200: this is the dashboard's own aggregate view. A degraded
            // dependency must still return the full `deps` breakdown so the UI can
            // show WHICH dependency is down (a 503 would make the client treat the
            // whole payload as an error and render nothing).
            res.json({ status: ok ? 'ok' : 'degraded', deps });
        })
    );

    return router;
};

export default buildHealthRoutes;

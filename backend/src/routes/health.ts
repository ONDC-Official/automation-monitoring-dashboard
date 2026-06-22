import { Router } from 'express';
import axios from 'axios';
import { config } from '../config/env';
import { asyncHandler } from '../middlewares/error';
import { pingDb } from '../redis/service';
import * as prom from '../proxies/prometheus';
import * as loki from '../proxies/loki';
import * as grafana from '../proxies/grafana';

const router = Router();

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

/** GET /api/health — aggregate up/down for every dependency the dashboard uses. */
router.get(
    '/',
    asyncHandler(async (_req, res) => {
        const [redis0, redis1, prometheus, lokiUp, grafanaUp, service] =
            await Promise.all([
                pingDb(config.redis.db0),
                pingDb(config.redis.db1),
                prom.isUp(),
                loki.isUp(),
                grafana.isUp(),
                checkService(),
            ]);

        const deps = {
            redisDb0: redis0,
            redisDb1: redis1,
            prometheus,
            loki: lokiUp,
            grafana: grafanaUp,
            monitoredService: service,
        };
        const ok = Object.values(deps).every(Boolean);

        // Always 200: this is the dashboard's own aggregate view. A degraded
        // dependency must still return the full `deps` breakdown so the UI can
        // show WHICH dependency is down (a 503 would make the client treat the
        // whole payload as an error and render nothing).
        res.json({ status: ok ? 'ok' : 'degraded', deps });
    })
);

export default router;

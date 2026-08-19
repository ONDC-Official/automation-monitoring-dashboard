import { Router } from 'express';
import redisRoutes from './redis.js';
import metricsRoutes from './metrics.js';
import logsRoutes from './logs.js';
import grafanaRoutes from './grafana.js';
import { buildHealthRoutes } from './health.js';
import type { McpRuntime } from '../mcp/index.js';
import {
    disabledMcpRoutes,
    queryRoutes,
} from '../mcp/routes/query.routes.js';

/**
 * Everything under `/api`, behind `requireAdminToken`.
 *
 * `/api/mcp/*` is always mounted, whether or not the MCP section is
 * configured — when it is not, `disabledMcpRoutes` answers 503 (and `/config`
 * still answers 200 with `mcp_enabled: false`, which is how the web app knows
 * to hide the nav rather than showing a broken page).
 */
export const buildApiRoutes = (mcp: McpRuntime | undefined): Router => {
    const router = Router();

    router.use('/health', buildHealthRoutes(mcp));
    router.use('/redis', redisRoutes);
    router.use('/metrics', metricsRoutes);
    router.use('/logs', logsRoutes);
    router.use('/grafana', grafanaRoutes);
    router.use(
        '/mcp',
        mcp === undefined ? disabledMcpRoutes() : queryRoutes(mcp.container)
    );

    return router;
};

export default buildApiRoutes;

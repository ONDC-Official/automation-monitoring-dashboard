import { Router } from 'express';
import redisRoutes from './redis';
import metricsRoutes from './metrics';
import logsRoutes from './logs';
import grafanaRoutes from './grafana';
import healthRoutes from './health';

const router = Router();

router.use('/health', healthRoutes);
router.use('/redis', redisRoutes);
router.use('/metrics', metricsRoutes);
router.use('/logs', logsRoutes);
router.use('/grafana', grafanaRoutes);

export default router;

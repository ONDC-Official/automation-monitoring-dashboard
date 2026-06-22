import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import pinoHttp from 'pino-http';
import { config } from './config/env';
import logger from './observability/logger';
import apiRoutes from './routes';
import { requireAdminToken } from './middlewares/auth';
import { errorHandler } from './middlewares/error';

export const createServer = (): Application => {
    const app = express();

    // helmet defaults block iframe embedding via CSP/frame headers; this API
    // serves JSON only (Grafana is embedded directly from the frontend), so
    // the defaults are fine here.
    app.use(helmet());
    app.use(cors({ origin: config.corsOrigin, credentials: true }));
    app.use(compression());
    app.use(express.json({ limit: '2mb' }));
    app.use(
        pinoHttp({
            logger,
            // Tail SSE stream is long-lived; don't auto-log its completion.
            autoLogging: { ignore: req => req.url?.startsWith('/api/logs/tail') ?? false },
        })
    );

    app.get('/health', (_req, res) => res.json({ status: 'ok' }));

    app.use('/api', requireAdminToken, apiRoutes);

    app.use((_req, res) => res.status(404).json({ error: 'not_found' }));
    app.use(errorHandler);

    return app;
};

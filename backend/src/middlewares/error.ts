import { NextFunction, Request, Response } from 'express';
import axios from 'axios';
import logger from '../observability/logger';

/** Async route wrapper so thrown/rejected errors reach the error handler. */
export const asyncHandler =
    (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
    (req: Request, res: Response, next: NextFunction): void => {
        fn(req, res, next).catch(next);
    };

export const errorHandler = (
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
): void => {
    // Surface upstream (Prometheus/Loki/Grafana) failures with their status.
    if (axios.isAxiosError(err)) {
        const status = err.response?.status ?? 502;
        logger.warn(
            { url: err.config?.url, status, msg: err.message },
            'upstream request failed'
        );
        res.status(status).json({
            error: 'upstream_error',
            message: err.message,
            upstream: err.config?.baseURL,
            detail: err.response?.data,
        });
        return;
    }

    const message = err instanceof Error ? err.message : 'internal error';
    logger.error({ err }, 'unhandled route error');
    res.status(500).json({ error: 'internal_error', message });
};

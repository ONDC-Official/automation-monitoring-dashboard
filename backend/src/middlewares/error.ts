import { NextFunction, Request, Response } from 'express';
import axios from 'axios';
import logger from '../observability/logger.js';
import { isHttpError } from '../lib/errors.js';

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
    // A service chose this status by throwing — honour it verbatim, and check
    // it BEFORE the axios branch so an UpstreamError wrapping a failed upstream
    // call is not re-derived from the underlying axios status.
    //
    // This is load-bearing on the ingest path, not cosmetic. The engine's
    // `SpoolAndUploadSink` marks a report delivered on ANY 2xx and never
    // retries it, and treats every non-2xx as still-pending. So a 4xx is a
    // permanent refusal of a report and a 5xx is a promise to accept it later.
    // Collapsing a BadRequestError into a generic 500 would make the engine
    // resend an unparseable report forever.
    if (isHttpError(err)) {
        const level = err.status >= 500 ? 'error' : 'warn';
        logger[level]({ err, status: err.status }, 'request failed');
        res.status(err.status).json({
            error: err.name,
            message: err.message,
            ...(err.details !== undefined ? { details: err.details } : {}),
        });
        return;
    }

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

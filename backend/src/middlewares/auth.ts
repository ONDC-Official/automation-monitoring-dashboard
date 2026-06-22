import { NextFunction, Request, Response } from 'express';
import { config } from '../config/env';

/**
 * Optional bearer-token gate. If ADMIN_TOKEN is unset, the dashboard is
 * treated as internal-only and all requests pass. When set, every /api route
 * requires `Authorization: Bearer <token>`.
 */
export const requireAdminToken = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    if (!config.adminToken) {
        next();
        return;
    }
    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (token && token === config.adminToken) {
        next();
        return;
    }
    res.status(401).json({ error: 'unauthorized' });
};

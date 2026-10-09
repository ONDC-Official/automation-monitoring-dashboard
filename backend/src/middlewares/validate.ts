import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';
import { BadRequestError } from '../lib/errors.js';

/**
 * Request validation, kept because the schemas carry real behaviour.
 *
 * The MCP read API's query schemas are not decoration: they coerce `limit` and
 * `skip` from strings, cap `limit` at 200 (500 for a journal page) and pin
 * `sort` to a closed set. Dropping them would let `?limit=100000` through to a
 * Mongo query that this service then has to serialise into a model's context.
 *
 * A failure is a `BadRequestError`, so it travels the same channel as every
 * other typed failure and the global error handler chooses the status. See
 * `lib/errors.ts` for why that distinction matters on the ingest path.
 */

const detail = (error: unknown): unknown => {
    if (
        typeof error === 'object' &&
        error !== null &&
        'issues' in error &&
        Array.isArray((error as { issues: unknown[] }).issues)
    ) {
        return (error as { issues: unknown[] }).issues;
    }
    return undefined;
};

/**
 * Validate `req.query` and hand the parsed value to the handler.
 *
 * Express 5 makes `req.query` a getter-only property, so the coerced result is
 * stashed on `res.locals` rather than assigned back. Handlers read it through
 * `validated<T>(res)`.
 */
export const validateQuery =
    <T>(schema: ZodType<T>) =>
    (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.query);
        if (!result.success) {
            next(new BadRequestError('invalid query parameters', detail(result.error)));
            return;
        }
        res.locals.validated = result.data;
        next();
    };

export const validateBody =
    <T>(schema: ZodType<T>) =>
    (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            next(new BadRequestError('invalid request body', detail(result.error)));
            return;
        }
        res.locals.validated = result.data;
        next();
    };

/** The value the matching `validate*` middleware parsed for this request. */
export const validated = <T>(res: Response): T => res.locals.validated as T;

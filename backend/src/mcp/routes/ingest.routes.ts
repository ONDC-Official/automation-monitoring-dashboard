import { timingSafeEqual } from 'node:crypto';
import { Router, type Request, type Response, type NextFunction } from 'express';
import express from 'express';
import type { Logger } from 'pino';
import { asyncHandler } from '@/middlewares/error.js';
import type { IngestService } from '@/mcp/modules/ingest/ingest.service.js';

/**
 * The two write endpoints `automation-mcp` talks to.
 *
 * This is the service's only public write surface, and the status code **is**
 * the contract with the engine's spool: 2xx means "delivered, delete your
 * copy", anything else means "still pending, send it again". Read
 * `ingest.service.ts` before changing anything here.
 *
 * Mounted OUTSIDE `requireAdminToken`. These are machine surfaces with their
 * own credential — the engine presents `INGEST_API_KEY`, which it already
 * holds — and putting them behind the operator-login bearer would mean no
 * engine could ever deliver a report.
 */

export interface IngestRouteDeps {
    service: IngestService;
    /** Unset means unauthenticated. `validateEnv` refuses that under production. */
    apiKey: string | undefined;
    bodyLimitBytes: number;
    logger: Logger;
    /**
     * Fired after a report has been stored, with its fingerprint.
     *
     * Injected as a plain callback rather than a service so this file has no
     * idea what happens next.
     */
    onIngested?: (fingerprint: string) => void;
}

export function ingestRoutes(deps: IngestRouteDeps): Router {
    const router = Router();

    // Own body parser, so the limit is this route's rather than the app's 2mb.
    const parseBody = express.json({ limit: deps.bodyLimitBytes });
    const requireKey = bearerGate(deps.apiKey);

    router.post(
        '/reports',
        parseBody,
        requireKey,
        asyncHandler(async (req: Request, res: Response) => {
            // The service owns parsing, deliberately. `report.schema.ts` is
            // lenient on purpose and a second, stricter gate here would
            // reintroduce exactly the rejections that file explains at length
            // why we must not make.
            const result = await deps.service.acceptReport(req.body);

            res.status(202).json(result);

            // After the reply, never inside it. The same reasoning as the
            // engine's receiver writing its ACK before it chains: whatever the
            // hook does, holding the engine's connection open for its duration
            // turns a slow follow-up into the engine's ingest timing out —
            // which the engine reads as "not delivered" and resends. The hook's
            // failure is its own to log; nothing it does may change whether a
            // report was accepted.
            //
            // Nothing subscribes today — the GitHub sync that did was removed.
            // The seam is kept because it is the correct shape for the next
            // post-ingest side effect, and because this is the surface where a
            // wrong answer destroys a report rather than delaying it.
            setImmediate(() => {
                try {
                    deps.onIngested?.(result.fingerprint);
                } catch (error) {
                    deps.logger.error(
                        { err: error, fingerprint: result.fingerprint },
                        'post-ingest hook threw'
                    );
                }
            });
        })
    );

    router.post(
        '/telemetry',
        parseBody,
        requireKey,
        asyncHandler(async (req: Request, res: Response) => {
            // Entries this build cannot read are skipped and counted, never fatal.
            const result = await deps.service.acceptTelemetry(req.body);
            res.status(202).json(result);
        })
    );

    return router;
}

/* -------------------------------------------------------------------------- */
/* Auth                                                                        */
/* -------------------------------------------------------------------------- */

function bearerGate(apiKey: string | undefined) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (apiKey === undefined) {
            next();
            return;
        }
        if (bearerMatches(req.headers.authorization, apiKey)) {
            next();
            return;
        }
        res.status(401).json({
            error: 'unauthorized',
            message: 'a valid Authorization: Bearer token is required',
        });
    };
}

/**
 * Constant-time bearer comparison.
 *
 * `timingSafeEqual` **throws** on buffers of unequal length, so the length
 * guard is not an optimisation — without it a wrong-length key produces a 500
 * instead of a 401, which tells an attacker their guess was the wrong *length*
 * far more loudly than any timing signal would have. The length itself is the
 * one thing this cannot hide, and a shared secret's length is not a secret.
 */
function bearerMatches(header: string | undefined, expected: string): boolean {
    if (header === undefined) return false;
    const prefix = 'Bearer ';
    if (!header.startsWith(prefix)) return false;

    const presented = Buffer.from(header.slice(prefix.length).trim(), 'utf8');
    const secret = Buffer.from(expected, 'utf8');
    if (presented.length !== secret.length) return false;
    return timingSafeEqual(presented, secret);
}

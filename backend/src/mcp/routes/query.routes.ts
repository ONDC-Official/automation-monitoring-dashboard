import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { config } from '@/config/env.js';
import { asyncHandler } from '@/middlewares/error.js';
import { validateBody, validateQuery, validated } from '@/middlewares/validate.js';
import type { Container } from '@/mcp/container.js';
import {
    CommentBody,
    DismissBody,
    IncidentListQuery,
    LinkFixBody,
    SetStatusBody,
} from '@/mcp/modules/query/query.schema.js';

/**
 * The read API and the triage actions, mounted under `/api/mcp`.
 *
 * Three consumers share these routes — the web app, the MCP tools and
 * Grafana's Infinity datasource — which is why the shapes are flat and why
 * every list answers `{items, total}` rather than a bare array. See
 * `query.schema.ts`.
 *
 * Unlike `/ingest/*`, these sit INSIDE `requireAdminToken`: they are the
 * operator's own read surface and ride the same login as every other page.
 */

const Paging = z.object({
    limit: z.coerce.number().int().positive().max(200).default(50),
    skip: z.coerce.number().int().min(0).default(0),
});
type Paging = z.infer<typeof Paging>;

/**
 * One path parameter, as a string.
 *
 * Express 5 types `req.params[k]` as `string | string[]` because a wildcard
 * segment can repeat. None of these routes uses a wildcard, so the array arm
 * is unreachable — but it still has to be closed, and closing it here keeps
 * every handler below reading as one line.
 */
const param = (req: Request, name: string): string => {
    const value = req.params[name];
    return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
};

const JournalPaging = z.object({
    // Exclusive, and the same cursor shape the engine's own journal uses.
    after_seq: z.coerce.number().int().min(0).default(0),
    limit: z.coerce.number().int().positive().max(500).default(100),
});
type JournalPaging = z.infer<typeof JournalPaging>;

export function queryRoutes(container: Container): Router {
    const { query, triage } = container.services;
    const router = Router();

    /** What the web app needs to know about its own deployment. */
    router.get('/config', (_req: Request, res: Response) => {
        res.json({
            mcp_enabled: true,
            grafana_url: config.grafanaUrl ?? null,
            prometheus_url: config.prometheusUrl ?? null,
            loki_url: config.lokiUrl ?? null,
        });
    });

    /** Mongo reachability, separate from `/api/health`'s aggregate. */
    router.get(
        '/ready',
        asyncHandler(async (_req: Request, res: Response) => {
            const ok = await container.ping();
            res.status(ok ? 200 : 503).json({ status: ok ? 'ok' : 'unavailable' });
        })
    );

    /* --------------------------------------------------------------- corpus */

    router.get(
        '/stats',
        asyncHandler(async (_req, res) => res.json(await query.stats()))
    );

    router.get(
        '/incidents',
        validateQuery(IncidentListQuery),
        asyncHandler(async (_req, res) =>
            res.json(await query.listIncidents(validated(res)))
        )
    );

    router.get(
        '/incidents/:fingerprint',
        asyncHandler(async (req, res) =>
            res.json(await query.getIncident(param(req, 'fingerprint')))
        )
    );

    router.get(
        '/reports/:reportDocId',
        asyncHandler(async (req, res) =>
            res.json({ report: await query.getReport(param(req, 'reportDocId')) })
        )
    );

    /* --------------------------------------------------------------- triage */

    router.post(
        '/incidents/:fingerprint/status',
        validateBody(SetStatusBody),
        asyncHandler(async (req, res) => {
            const body = validated<z.infer<typeof SetStatusBody>>(res);
            res.json(
                await triage.setStatus(param(req, 'fingerprint'), body.status, body.note)
            );
        })
    );

    router.post(
        '/incidents/:fingerprint/comment',
        validateBody(CommentBody),
        asyncHandler(async (req, res) => {
            const body = validated<z.infer<typeof CommentBody>>(res);
            res.json(await triage.comment(param(req, 'fingerprint'), body.body));
        })
    );

    router.post(
        '/incidents/:fingerprint/link',
        validateBody(LinkFixBody),
        asyncHandler(async (req, res) => {
            const body = validated<z.infer<typeof LinkFixBody>>(res);
            res.json(
                await triage.linkFix(
                    param(req, 'fingerprint'),
                    body.reference,
                    body.note
                )
            );
        })
    );

    router.post(
        '/incidents/:fingerprint/dismiss',
        validateBody(DismissBody),
        asyncHandler(async (req, res) => {
            const body = validated<z.infer<typeof DismissBody>>(res);
            res.json(await triage.dismiss(param(req, 'fingerprint'), body.reason));
        })
    );

    /* ------------------------------------------------------- mirrored state */

    router.get(
        '/sessions',
        validateQuery(Paging),
        asyncHandler(async (_req, res) => {
            const { limit, skip } = validated<Paging>(res);
            res.json(await query.listSessions(limit, skip));
        })
    );

    router.get(
        '/sessions/:sessionRef',
        asyncHandler(async (req, res) =>
            res.json(await query.getSession(param(req, 'sessionRef')))
        )
    );

    router.get(
        '/sessions/:sessionRef/runs',
        validateQuery(Paging),
        asyncHandler(async (req, res) => {
            const { limit, skip } = validated<Paging>(res);
            res.json(await query.listRuns(param(req, 'sessionRef'), limit, skip));
        })
    );

    router.get(
        '/sessions/:sessionRef/journal',
        validateQuery(JournalPaging),
        asyncHandler(async (req, res) => {
            const { after_seq, limit } = validated<JournalPaging>(res);
            res.json(
                await query.listJournal(param(req, 'sessionRef'), after_seq, limit)
            );
        })
    );

    router.get(
        '/runs',
        validateQuery(Paging.extend({ session_ref: z.string().optional() })),
        asyncHandler(async (_req, res) => {
            const q = validated<Paging & { session_ref?: string }>(res);
            res.json(await query.listRuns(q.session_ref, q.limit, q.skip));
        })
    );

    return router;
}

/**
 * What `/api/mcp/*` answers when the section is switched off.
 *
 * A 503 rather than a 404: the routes exist, the capability is simply not
 * configured. `/config` still answers 200 so the web app can ask "is this on?"
 * without treating the answer as an error and hiding the nav by accident.
 */
export function disabledMcpRoutes(): Router {
    const router = Router();

    router.get('/config', (_req: Request, res: Response) => {
        res.json({
            mcp_enabled: false,
            grafana_url: config.grafanaUrl ?? null,
            prometheus_url: config.prometheusUrl ?? null,
            loki_url: config.lokiUrl ?? null,
        });
    });

    router.use((_req: Request, res: Response) => {
        res.status(503).json({
            error: 'mcp_disabled',
            message:
                'The MCP section is not configured on this deployment. Set MONGO_URL to enable it.',
        });
    });

    return router;
}

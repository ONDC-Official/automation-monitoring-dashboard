import { Router } from 'express';
import { asyncHandler } from '../middlewares/error';
import * as loki from '../proxies/loki';
import logger from '../observability/logger';

const router = Router();

/** GET /api/logs/query_range?query={...}&start=&end=&limit=&direction= */
router.get(
    '/query_range',
    asyncHandler(async (req, res) => {
        res.json(
            await loki.rangeQuery({
                query: String(req.query.query ?? ''),
                start: req.query.start as string | undefined,
                end: req.query.end as string | undefined,
                limit: req.query.limit ? Number(req.query.limit) : undefined,
                direction:
                    (req.query.direction as 'forward' | 'backward') ??
                    'backward',
            })
        );
    })
);

router.get(
    '/labels',
    asyncHandler(async (_req, res) => {
        res.json(await loki.labels());
    })
);

router.get(
    '/label/:label/values',
    asyncHandler(async (req, res) => {
        res.json(await loki.labelValues(String(req.params.label)));
    })
);

/**
 * GET /api/logs/tail?query={...} — Server-Sent Events live tail.
 * Polls Loki query_range on an interval (no websocket dependency) and pushes
 * new log lines as they arrive.
 */
router.get('/tail', (req, res) => {
    const query = String(req.query.query ?? '');
    if (!query) {
        res.status(400).json({ error: 'query param required' });
        return;
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
    });
    res.write(': connected\n\n');

    let sinceNs = `${Date.now()}000000`; // start "now" in ns
    let closed = false;
    const intervalMs = 2000;

    const poll = async () => {
        if (closed) return;
        try {
            const { entries, maxNs } = await loki.pollTail(query, sinceNs);
            sinceNs = maxNs;
            for (const entry of entries) {
                res.write(`data: ${JSON.stringify(entry)}\n\n`);
            }
        } catch (err) {
            logger.warn({ err }, 'loki tail poll failed');
            res.write(
                `event: error\ndata: ${JSON.stringify({ message: 'poll failed' })}\n\n`
            );
        }
    };

    const timer = setInterval(poll, intervalMs);
    const heartbeat = setInterval(() => {
        if (!closed) res.write(': ping\n\n');
    }, 15000);

    req.on('close', () => {
        closed = true;
        clearInterval(timer);
        clearInterval(heartbeat);
    });
});

export default router;

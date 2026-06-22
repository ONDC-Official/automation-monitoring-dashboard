import { Router } from 'express';
import { config } from '../config/env';
import { asyncHandler } from '../middlewares/error';
import { BUSINESS_TYPES } from '../redis/key-codec';
import { dbSummary, inspectKey, scanDb } from '../redis/service';

const router = Router();

/** GET /api/redis/dbs — list the two logical DBs with key counts + the type taxonomy. */
router.get(
    '/dbs',
    asyncHandler(async (_req, res) => {
        const [d0, d1] = await Promise.all([
            dbSummary(config.redis.db0),
            dbSummary(config.redis.db1),
        ]);
        res.json({
            businessTypes: BUSINESS_TYPES,
            dbs: [
                { ...d0, label: 'business state' },
                { ...d1, label: 'runner config' },
            ],
        });
    })
);

/** GET /api/redis/scan?db=0&match=*&cursor=0&count=200 — SCAN page of decoded keys. */
router.get(
    '/scan',
    asyncHandler(async (req, res) => {
        const db = Number(req.query.db ?? config.redis.db0);
        const result = await scanDb(db, {
            match: (req.query.match as string) || '*',
            cursor: (req.query.cursor as string) || '0',
            count: req.query.count ? Number(req.query.count) : undefined,
        });
        res.json(result);
    })
);

/** GET /api/redis/inspect?db=0&key=... — full business-decoded view of one key. */
router.get(
    '/inspect',
    asyncHandler(async (req, res) => {
        const db = Number(req.query.db ?? config.redis.db0);
        const key = String(req.query.key ?? '');
        if (!key) {
            res.status(400).json({ error: 'key query param required' });
            return;
        }
        const result = await inspectKey(db, key);
        if (!result) {
            res.status(404).json({ error: 'key not found' });
            return;
        }
        res.json(result);
    })
);

export default router;

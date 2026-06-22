import { Router } from 'express';
import { asyncHandler } from '../middlewares/error';
import * as prom from '../proxies/prometheus';

const router = Router();

/** GET /api/metrics/query?query=up&time= */
router.get(
    '/query',
    asyncHandler(async (req, res) => {
        res.json(
            await prom.instantQuery(
                String(req.query.query ?? ''),
                req.query.time as string | undefined
            )
        );
    })
);

/** GET /api/metrics/query_range?query=&start=&end=&step= */
router.get(
    '/query_range',
    asyncHandler(async (req, res) => {
        res.json(
            await prom.rangeQuery({
                query: String(req.query.query ?? ''),
                start: String(req.query.start ?? ''),
                end: String(req.query.end ?? ''),
                step: String(req.query.step ?? '15s'),
            })
        );
    })
);

router.get(
    '/label/:label/values',
    asyncHandler(async (req, res) => {
        res.json(await prom.labelValues(String(req.params.label)));
    })
);

router.get(
    '/targets',
    asyncHandler(async (_req, res) => {
        res.json(await prom.targets());
    })
);

router.get(
    '/rules',
    asyncHandler(async (_req, res) => {
        res.json(await prom.rules());
    })
);

export default router;

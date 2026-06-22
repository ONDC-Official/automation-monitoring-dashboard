import { Router } from 'express';
import { asyncHandler } from '../middlewares/error';
import * as grafana from '../proxies/grafana';

const router = Router();

/** GET /api/grafana/dashboards — provisioned dashboards available to embed. */
router.get(
    '/dashboards',
    asyncHandler(async (_req, res) => {
        res.json({ dashboards: await grafana.listDashboards() });
    })
);

/** GET /api/grafana/embed/:uid?from=&to=&theme= — full-dashboard kiosk embed URL. */
router.get('/embed/:uid', (req, res) => {
    res.json({
        url: grafana.dashboardEmbedUrl(req.params.uid, {
            from: req.query.from as string | undefined,
            to: req.query.to as string | undefined,
            theme: req.query.theme as 'light' | 'dark' | undefined,
        }),
    });
});

/** GET /api/grafana/panel/:uid/:panelId?from=&to=&theme= — single-panel embed URL. */
router.get('/panel/:uid/:panelId', (req, res) => {
    res.json({
        url: grafana.panelEmbedUrl(
            req.params.uid,
            Number(req.params.panelId),
            {
                from: req.query.from as string | undefined,
                to: req.query.to as string | undefined,
                theme: req.query.theme as 'light' | 'dark' | undefined,
            }
        ),
    });
});

export default router;

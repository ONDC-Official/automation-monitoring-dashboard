import { Router } from 'express';
import { timingSafeEqual } from 'crypto';
import { config } from '../config/env';
import { asyncHandler } from '../middlewares/error';

const router = Router();

/** Constant-time string compare (length check leaks length only, as usual). */
const safeEqual = (a: string, b: string): boolean => {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    return ab.length === bb.length && timingSafeEqual(ab, bb);
};

/**
 * POST /api/auth/login — validate dashboard credentials server-side.
 *
 * Public by design (it's how a client obtains its token), so it is mounted
 * BEFORE the requireAdminToken gate. On success we return `adminToken` as the
 * bearer the client sends on every other /api request. Credentials live only
 * in backend env — never in the browser bundle.
 */
router.post(
    '/login',
    asyncHandler(async (req, res) => {
        const { username, password } = (req.body ?? {}) as {
            username?: unknown;
            password?: unknown;
        };

        if (typeof username !== 'string' || typeof password !== 'string') {
            res.status(400).json({
                error: 'bad_request',
                message: 'username and password are required',
            });
            return;
        }

        const { username: expectedUser, password: expectedPass } = config.auth;
        if (!expectedUser || !expectedPass) {
            res.status(500).json({
                error: 'auth_not_configured',
                message: 'Server auth is not configured (set AUTH_USERNAME / AUTH_PASSWORD).',
            });
            return;
        }

        const ok =
            safeEqual(username, expectedUser) &&
            safeEqual(password, expectedPass);
        if (!ok) {
            res.status(401).json({
                error: 'invalid_credentials',
                message: 'Invalid username or password.',
            });
            return;
        }

        res.json({ token: config.adminToken ?? '', username });
    })
);

export default router;

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
import { errorHandler } from '@/middlewares/error.js';
import { buildApiRoutes } from '@/routes/index.js';

/**
 * The dashboard with the MCP section switched off.
 *
 * `MONGO_URL` unset is the section's only off switch, and this pins what that
 * costs: the rest of the console is untouched, `/api/mcp/*` refuses honestly,
 * and `/api/mcp/config` still ANSWERS — because that endpoint is how the web
 * app decides whether to show the nav at all. If it 503'd like its siblings,
 * the frontend could not tell "switched off" from "broken" and would have to
 * guess.
 *
 * 503 rather than 404 is deliberate too: the routes exist, the capability is
 * not configured. A 404 reaching the engine's spool would read as a permanent
 * refusal and destroy the report it was carrying.
 */

let current: Server | undefined;

async function serveWithoutMcp(): Promise<string> {
    const app = express();
    app.use(express.json());
    // `undefined` is exactly what `initMcp()` returns when MONGO_URL is unset.
    app.use('/api', buildApiRoutes(undefined));
    app.use(errorHandler);

    const server = createServer(app);
    await new Promise<void>(resolve =>
        server.listen(0, '127.0.0.1', () => resolve())
    );
    current = server;
    const { port } = server.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
}

afterEach(async () => {
    if (current !== undefined) {
        await new Promise<void>(resolve => current!.close(() => resolve()));
        current = undefined;
    }
});

describe('the MCP section, disabled', () => {
    it('reports mcp_enabled=false rather than refusing', async () => {
        const url = await serveWithoutMcp();

        const response = await fetch(`${url}/api/mcp/config`);
        expect(response.status).toBe(200);

        const body = (await response.json()) as Record<string, unknown>;
        expect(body).toMatchObject({ mcp_enabled: false });

        // `toMatchObject` is a subset match, so it stayed green straight through
        // the removal of these two keys and pinned nothing. The enabled and
        // disabled config handlers are separate object literals that have to
        // agree, and this is the only thing that notices when they drift.
        expect(Object.keys(body)).not.toContain('github_repo');
        expect(Object.keys(body)).not.toContain('github_sync_enabled');
    });

    it('answers 503 on every other MCP route', async () => {
        const url = await serveWithoutMcp();

        for (const path of [
            '/api/mcp/stats',
            '/api/mcp/incidents',
            '/api/mcp/sessions',
            '/api/mcp/runs',
        ]) {
            const response = await fetch(`${url}${path}`);
            expect(response.status, path).toBe(503);
            expect(await response.json()).toMatchObject({
                error: 'mcp_disabled',
            });
        }
    });

    it('reports mongo as disabled without dragging health to degraded', async () => {
        // A disabled dependency is not a failing one. Folding "absent" into
        // `false` would report every playground-only deployment as degraded.
        const url = await serveWithoutMcp();

        const response = await fetch(`${url}/api/health`);
        expect(response.status).toBe(200);
        const body = (await response.json()) as {
            deps: Record<string, unknown>;
        };
        expect(body.deps.mongo).toBe('disabled');
    });
});

import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { pino } from 'pino';
import { afterEach, describe, expect, it } from 'vitest';
import { errorHandler } from '@/middlewares/error.js';
import { IngestService } from '@/mcp/modules/ingest/ingest.service.js';
import { ingestRoutes } from '@/mcp/routes/ingest.routes.js';
import { FakeCorpusRepository } from '@/mcp/test/fake-corpus-repository.js';
import { makeReport } from '@/mcp/test/fixtures.js';

/**
 * The ingest, over a real socket.
 *
 * Ported from the Fastify original, which used `app.inject()`. There is no
 * Express equivalent, so this binds an ephemeral port and uses `fetch` — no
 * new dependency, and it exercises the same body parsers and error middleware
 * the deployed server mounts.
 */

const logger = pino({ level: 'silent' });
const API_KEY = 's3cret-ingest-key';

interface Harness {
    url: string;
    server: Server;
    repository: FakeCorpusRepository;
    ingested: string[];
    /** Server-side ordering log. See "runs the hook after the reply" below. */
    order: string[];
}

async function harness(
    options: { apiKey?: string | undefined } = {}
): Promise<Harness> {
    const repository = new FakeCorpusRepository();
    const service = new IngestService({ repository, logger });
    const ingested: string[] = [];
    const order: string[] = [];

    const app = express();
    app.use((_req, res, next) => {
        res.on('finish', () => order.push('reply'));
        next();
    });
    app.use(
        '/ingest',
        ingestRoutes({
            service,
            apiKey: 'apiKey' in options ? options.apiKey : API_KEY,
            bodyLimitBytes: 2_000_000,
            logger,
            onIngested: fingerprint => {
                order.push('hook');
                ingested.push(fingerprint);
            },
        })
    );
    app.use(errorHandler);

    const server = createServer(app);
    await new Promise<void>(resolve =>
        server.listen(0, '127.0.0.1', () => resolve())
    );
    const { port } = server.address() as AddressInfo;

    return { url: `http://127.0.0.1:${port}`, server, repository, ingested, order };
}

let current: Server | undefined;
afterEach(async () => {
    if (current !== undefined) {
        await new Promise<void>(resolve => current!.close(() => resolve()));
        current = undefined;
    }
});

interface PostOptions {
    authorization?: string | undefined;
    body?: unknown;
}

async function post(
    url: string,
    path: string,
    options: PostOptions = {}
): Promise<Response> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (options.authorization !== undefined) {
        headers.authorization = options.authorization;
    }
    return fetch(`${url}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(options.body ?? {}),
    });
}

describe('POST /ingest/reports', () => {
    it('accepts a report and answers 202', async () => {
        const h = await harness();
        current = h.server;

        const response = await post(h.url, '/ingest/reports', {
            authorization: `Bearer ${API_KEY}`,
            body: makeReport(),
        });

        expect(response.status).toBe(202);
        const body = (await response.json()) as {
            fingerprint: string;
            duplicate: boolean;
        };
        expect(body.duplicate).toBe(false);
        expect(h.repository.reports.size).toBe(1);

        await new Promise(resolve => setImmediate(resolve));
        expect(h.ingested).toEqual([body.fingerprint]);
    });

    it('runs the post-ingest hook after the reply, never inside it', async () => {
        // The invariant the Fastify original asserted with `inject()`. Over a
        // real socket the CLIENT cannot observe the ordering — the server's
        // `setImmediate` fires long before the response crosses loopback — so
        // this is asserted SERVER-side, where it is deterministic: `finish`
        // lands in the nextTick queue and `setImmediate` in a later phase.
        //
        // It matters because a slow GitHub sync inside the reply would hold
        // the engine's connection open until its ingest times out, which the
        // engine reads as "not delivered" and resends forever.
        const h = await harness();
        current = h.server;

        await post(h.url, '/ingest/reports', {
            authorization: `Bearer ${API_KEY}`,
            body: makeReport(),
        });
        await new Promise(resolve => setImmediate(resolve));

        expect(h.order).toEqual(['reply', 'hook']);
    });

    it('answers 202 with duplicate=true on a redelivery', async () => {
        const h = await harness();
        current = h.server;

        const body = makeReport();
        const send = () =>
            post(h.url, '/ingest/reports', {
                authorization: `Bearer ${API_KEY}`,
                body,
            });

        expect((await send()).status).toBe(202);
        const second = await send();
        expect(second.status).toBe(202);
        expect(((await second.json()) as { duplicate: boolean }).duplicate).toBe(
            true
        );
    });

    it('answers 400, not 500, on a body that cannot be keyed', async () => {
        // The engine's spool deletes a report on any 2xx and retries on
        // anything else. A 400 is a permanent refusal of an unparseable body;
        // a 500 would mean "resend it forever".
        const h = await harness();
        current = h.server;

        const response = await post(h.url, '/ingest/reports', {
            authorization: `Bearer ${API_KEY}`,
            body: { hello: 'world' },
        });

        expect(response.status).toBe(400);
    });

    it('refuses a missing, malformed or wrong bearer', async () => {
        const h = await harness();
        current = h.server;

        const cases = [
            undefined,
            'Bearer ',
            // Deliberately a *different length* from the real key:
            // `timingSafeEqual` throws on unequal-length buffers, so an
            // unguarded compare turns this into a 500 that says "wrong length"
            // far louder than any timing signal.
            'Bearer short',
            `Bearer ${API_KEY}x`,
            `Basic ${API_KEY}`,
            // Right length, wrong bytes — the case constant-time is for.
            `Bearer ${'x'.repeat(API_KEY.length)}`,
        ];

        for (const authorization of cases) {
            const response = await post(h.url, '/ingest/reports', {
                authorization,
                body: makeReport(),
            });
            expect(response.status, `authorization=${String(authorization)}`).toBe(
                401
            );
        }
        expect(h.repository.reports.size).toBe(0);
    });

    it('accepts anything when no key is configured', async () => {
        // `validateEnv` refuses this under production; in development it is
        // what makes the service runnable without handing out a secret first.
        const h = await harness({ apiKey: undefined });
        current = h.server;

        const response = await post(h.url, '/ingest/reports', {
            body: makeReport(),
        });
        expect(response.status).toBe(202);
    });
});

describe('POST /ingest/telemetry', () => {
    it('accepts a batch and reports what it absorbed', async () => {
        const h = await harness();
        current = h.server;

        const response = await post(h.url, '/ingest/telemetry', {
            authorization: `Bearer ${API_KEY}`,
            // Shaped as `mirror.schema.ts#MirrorBatch` emits it: `records`,
            // with `install_id` on each record rather than on the envelope.
            body: {
                schema_version: 1,
                instance_id: 'inst_1',
                sent_at: '2026-08-17T12:00:05.000Z',
                dropped_since_last_batch: 0,
                records: [
                    {
                        schema_version: 1,
                        install_id: 'install_a1b2c3',
                        instance_id: 'inst_1',
                        session_ref: 'sref_1',
                        kind: 'JOURNAL',
                        event: { seq: 1, kind: 'INBOUND_ACK', action: 'on_search' },
                    },
                    { kind: 'NOT_A_KIND_WE_KNOW' },
                ],
            },
        });

        expect(response.status).toBe(202);
        expect(await response.json()).toMatchObject({
            accepted: true,
            journal: 1,
            skipped: 1,
        });
    });

    it('refuses an unauthenticated batch', async () => {
        const h = await harness();
        current = h.server;

        const response = await post(h.url, '/ingest/telemetry', {
            body: { install_id: 'i', instance_id: 'j', batch: [] },
        });
        expect(response.status).toBe(401);
    });
});

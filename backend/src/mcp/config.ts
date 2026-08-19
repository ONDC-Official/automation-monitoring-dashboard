import { config as appConfig } from '@/config/env.js';

/**
 * The MCP section's view of the app config.
 *
 * There is exactly one env reader in this backend — `config/env.ts` — and this
 * file does not add a second. It re-shapes `config.mcp` into the
 * SCREAMING_SNAKE contract the ported corpus/triage/ingest modules were
 * written against, so those ~30 files stay byte-comparable with the repo they
 * came from and a fix landing there can still be replayed here by eye.
 *
 * `MONGO_URL` is typed `string` rather than `string | undefined` because
 * nothing in this object is read until the container exists, and the container
 * is only built once `mcpEnabled()` is true. `resolveMcpConfig` is the one
 * place that assertion is made, and it throws rather than assumes.
 */
export interface Config {
    readonly MONGO_URL: string;
    readonly MONGO_DB: string;
    readonly TELEMETRY_RETENTION_DAYS: number;
    readonly INGEST_API_KEY: string | undefined;
    readonly INGEST_BODY_LIMIT_BYTES: number;
}

/**
 * Build the MCP config, or throw if the section is not configured.
 *
 * Callers reach this only behind `mcpEnabled()`; the throw is a guard against a
 * future caller that forgets, not an expected path.
 */
export function resolveMcpConfig(): Config {
    const { mcp } = appConfig;

    if (mcp.mongoUrl === undefined) {
        throw new Error(
            'MCP section is not configured: MONGO_URL is unset. Guard callers with mcpEnabled().'
        );
    }

    return {
        MONGO_URL: mcp.mongoUrl,
        MONGO_DB: mcp.mongoDb,
        TELEMETRY_RETENTION_DAYS: mcp.telemetryRetentionDays,
        INGEST_API_KEY: mcp.ingestApiKey,
        INGEST_BODY_LIMIT_BYTES: mcp.ingestBodyLimitBytes,
    };
}

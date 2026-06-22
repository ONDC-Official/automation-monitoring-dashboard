import { config } from '../config/env';
import { clientForDb } from './client';
import { BusinessType, decodeKey } from './key-codec';

/**
 * Read-only Redis access for the dashboard. Uses SCAN (never KEYS) so a large
 * keyspace never blocks the server the dashboard is observing.
 */

export interface ScanResult {
    db: number;
    cursor: string; // '0' when iteration is complete
    keys: Array<{
        key: string;
        businessType: BusinessType;
        ttl: number; // -1 = no expiry, -2 = missing
        type: string; // redis type (string/hash/...)
    }>;
}

export interface InspectResult {
    key: string;
    db: number;
    businessType: BusinessType;
    parts: Record<string, string>;
    type: string;
    ttl: number;
    sizeBytes: number;
    raw: unknown; // parsed JSON, or the raw string if not JSON
    decoded: unknown | null; // schema-parsed value when valid
    validation: { ok: boolean; errors: string[] };
}

const tryParseJson = (s: string): { json: unknown; isJson: boolean } => {
    try {
        return { json: JSON.parse(s), isJson: true };
    } catch {
        return { json: s, isJson: false };
    }
};

export const scanDb = async (
    db: number,
    opts: { match?: string; cursor?: string; count?: number } = {}
): Promise<ScanResult> => {
    const client = clientForDb(db);
    const count = Math.min(
        opts.count ?? config.redis.scanPageSize,
        config.redis.scanPageSize
    );
    const [nextCursor, rawKeys] = await client.scan(
        opts.cursor ?? '0',
        'MATCH',
        opts.match ?? '*',
        'COUNT',
        count
    );

    const keys = await Promise.all(
        rawKeys.map(async key => {
            const [ttl, type] = await Promise.all([
                client.ttl(key),
                client.type(key),
            ]);
            const { businessType } = decodeKey(key, db, config.redis.db1);
            return { key, businessType, ttl, type };
        })
    );

    return { db, cursor: nextCursor, keys };
};

export const inspectKey = async (
    db: number,
    key: string
): Promise<InspectResult | null> => {
    const client = clientForDb(db);
    const type = await client.type(key);
    if (type === 'none') return null;

    const [ttl, value] = await Promise.all([
        client.ttl(key),
        type === 'string' ? client.get(key) : Promise.resolve(null),
    ]);

    const decodedKey = decodeKey(key, db, config.redis.db1);
    const stringValue =
        value ?? (type === 'string' ? '' : `<${type} — open in raw view>`);
    const { json, isJson } = tryParseJson(stringValue);

    let decoded: unknown | null = null;
    const validation = { ok: true, errors: [] as string[] };

    if (decodedKey.schema && isJson) {
        const parsed = decodedKey.schema.safeParse(json);
        if (parsed.success) {
            decoded = parsed.data;
        } else {
            validation.ok = false;
            validation.errors = parsed.error.issues.map(
                i => `${i.path.join('.') || '(root)'}: ${i.message}`
            );
        }
    } else if (decodedKey.schema && !isJson) {
        validation.ok = false;
        validation.errors = ['value is not valid JSON'];
    }

    return {
        key,
        db,
        businessType: decodedKey.businessType,
        parts: decodedKey.parts,
        type,
        ttl,
        sizeBytes: Buffer.byteLength(stringValue, 'utf8'),
        raw: json,
        decoded,
        validation,
    };
};

/** Lightweight per-DB counts for the overview (uses SCAN, sampled). */
export const dbSummary = async (db: number): Promise<{ db: number; dbsize: number }> => {
    const client = clientForDb(db);
    const dbsize = await client.dbsize();
    return { db, dbsize };
};

export const pingDb = async (db: number): Promise<boolean> => {
    try {
        const pong = await clientForDb(db).ping();
        return pong === 'PONG';
    } catch {
        return false;
    }
};

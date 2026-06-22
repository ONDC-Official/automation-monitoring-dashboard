import axios, { AxiosInstance } from 'axios';
import { config } from '../config/env';

/** Thin wrapper over the Loki HTTP API (read-only). */

const http: AxiosInstance = axios.create({
    baseURL: config.lokiUrl,
    timeout: 20_000,
});

export interface RangeQueryParams {
    query: string; // LogQL
    start?: string; // ns/unix or RFC3339
    end?: string;
    limit?: number;
    direction?: 'forward' | 'backward';
    step?: string;
}

export const rangeQuery = async (params: RangeQueryParams) => {
    const { data } = await http.get('/loki/api/v1/query_range', {
        params: {
            query: params.query,
            start: params.start,
            end: params.end,
            limit: params.limit ?? 200,
            direction: params.direction ?? 'backward',
            step: params.step,
        },
    });
    return data;
};

export const labels = async () => {
    const { data } = await http.get('/loki/api/v1/labels');
    return data;
};

export const labelValues = async (label: string) => {
    const { data } = await http.get(
        `/loki/api/v1/label/${encodeURIComponent(label)}/values`
    );
    return data;
};

/**
 * One poll iteration for SSE-based live tail. Returns entries strictly newer
 * than `sinceNs` (Loki nanosecond timestamp) plus the new high-water mark.
 * Polling avoids adding a websocket dependency for Loki's /tail endpoint.
 */
export const pollTail = async (
    query: string,
    sinceNs: string
): Promise<{ entries: Array<{ ts: string; line: string; labels: Record<string, string> }>; maxNs: string }> => {
    const data = await rangeQuery({
        query,
        start: sinceNs,
        end: `${Date.now()}000000`,
        direction: 'forward',
        limit: 500,
    });

    const entries: Array<{ ts: string; line: string; labels: Record<string, string> }> = [];
    let maxNs = sinceNs;
    const streams = data?.data?.result ?? [];
    for (const stream of streams) {
        for (const [ts, line] of stream.values ?? []) {
            if (BigInt(ts) > BigInt(sinceNs)) {
                entries.push({ ts, line, labels: stream.stream ?? {} });
                if (BigInt(ts) > BigInt(maxNs)) maxNs = ts;
            }
        }
    }
    entries.sort((a, b) => (BigInt(a.ts) < BigInt(b.ts) ? -1 : 1));
    return { entries, maxNs };
};

export const isUp = async (): Promise<boolean> => {
    try {
        const { status } = await http.get('/ready', { timeout: 4000 });
        return status >= 200 && status < 300;
    } catch {
        return false;
    }
};

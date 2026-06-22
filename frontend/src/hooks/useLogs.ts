import { useGet } from '@/hooks/useGet';
import { httpClient } from '@/services/httpClient';
import type { LokiResponse } from '@/services/types';

export const LOGS_TAIL_URL = '/api/logs/tail';

export interface LogEntry {
    ts: string;
    line: string;
    labels: Record<string, string>;
}

const msToNs = (ms: number) => `${ms}000000`;

export const logsKeys = {
    query: (submitted: string | null, rangeMs: number, limit: number, direction: string) =>
        ['logs', submitted, rangeMs, limit, direction] as const,
};

export function useLogsQuery({
    submitted,
    rangeMs,
    limit,
    direction,
    refetchInterval,
}: {
    submitted: string | null;
    rangeMs: number;
    limit: number;
    direction: 'backward' | 'forward';
    refetchInterval?: number | false;
}) {
    return useGet<LogEntry[]>({
        queryKey: logsKeys.query(submitted, rangeMs, limit, direction),
        enabled: submitted !== null,
        refetchInterval: refetchInterval ?? false,
        queryFn: async () => {
            const now = Date.now();
            const { data } = await httpClient.get<LokiResponse>('/api/logs/query_range', {
                params: {
                    query: submitted,
                    start: msToNs(now - rangeMs),
                    end: msToNs(now),
                    limit,
                    direction,
                },
            });
            const flat: LogEntry[] = (data.data.result ?? []).flatMap((s) =>
                s.values.map(([ts, line]) => ({ ts, line, labels: s.stream }))
            );
            flat.sort((a, b) => {
                const c = BigInt(a.ts) < BigInt(b.ts) ? -1 : BigInt(a.ts) > BigInt(b.ts) ? 1 : 0;
                return direction === 'forward' ? c : -c;
            });
            return flat;
        },
    });
}

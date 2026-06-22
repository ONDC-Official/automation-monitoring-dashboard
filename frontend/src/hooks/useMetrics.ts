import { useGet } from '@/hooks/useGet';
import { httpClient } from '@/services/httpClient';
import type { PromResponse } from '@/services/types';

export const metricsKeys = {
    range: (query: string) => ['prom-range', query] as const,
};

export function usePromRangeQuery(query: string, opts?: { refetchInterval?: number | false }) {
    return useGet<PromResponse>({
        queryKey: metricsKeys.range(query),
        queryFn: () => {
            const end = Math.floor(Date.now() / 1000);
            const start = end - 3600;
            return httpClient
                .get<PromResponse>('/api/metrics/query_range', {
                    params: { query, start: String(start), end: String(end), step: '60s' },
                })
                .then((r) => r.data);
        },
        ...opts,
    });
}

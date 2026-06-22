import { useGet } from '@/hooks/useGet';
import { useInfiniteGet } from '@/hooks/useInfiniteGet';
import { httpClient } from '@/services/httpClient';
import type { DbsResponse, ScanResult, InspectResult } from '@/services/types';

export const redisKeys = {
    dbs: ['redis-dbs'] as const,
    scan: (db: number, match: string) => ['redis-scan', db, match] as const,
    inspect: (db: number, key: string | null) => ['redis-inspect', db, key] as const,
};

export function useRedisDbs() {
    return useGet<DbsResponse>({
        queryKey: redisKeys.dbs,
        queryFn: () => httpClient.get<DbsResponse>('/api/redis/dbs').then((r) => r.data),
    });
}

export function useRedisScan(db: number, match: string) {
    return useInfiniteGet<ScanResult>({
        queryKey: redisKeys.scan(db, match),
        queryFn: ({ pageParam }) =>
            httpClient
                .get<ScanResult>('/api/redis/scan', { params: { db, match, cursor: pageParam } })
                .then((r) => r.data),
        initialPageParam: '0',
        getNextPageParam: (last) => (last.cursor === '0' ? undefined : last.cursor),
    });
}

export function useRedisInspect(db: number, key: string | null) {
    return useGet<InspectResult>({
        queryKey: redisKeys.inspect(db, key),
        queryFn: () =>
            httpClient
                .get<InspectResult>('/api/redis/inspect', { params: { db, key } })
                .then((r) => r.data),
        enabled: key !== null,
    });
}

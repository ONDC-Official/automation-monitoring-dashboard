import { useGet } from '@/hooks/useGet';
import { httpClient } from '@/services/httpClient';
import type { HealthResponse } from '@/services/types';

export const healthKeys = {
    all: ['health'] as const,
};

export function useHealthQuery(opts?: { refetchInterval?: number | false }) {
    return useGet<HealthResponse>({
        queryKey: healthKeys.all,
        queryFn: () => httpClient.get<HealthResponse>('/api/health').then((r) => r.data),
        ...opts,
    });
}

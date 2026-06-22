import { useGet } from '@/hooks/useGet';
import { httpClient } from '@/services/httpClient';
import type { DashboardRef } from '@/services/types';

export const grafanaKeys = {
    dashboards: ['grafana-dashboards'] as const,
    embed: (uid: string) => ['grafana-embed', uid] as const,
};

export function useGrafanaDashboards() {
    return useGet<{ dashboards: DashboardRef[] }>({
        queryKey: grafanaKeys.dashboards,
        queryFn: () =>
            httpClient
                .get<{ dashboards: DashboardRef[] }>('/api/grafana/dashboards')
                .then((r) => r.data),
    });
}

export function useGrafanaEmbedUrl(uid: string) {
    return useGet<{ url: string }>({
        queryKey: grafanaKeys.embed(uid),
        queryFn: () =>
            httpClient
                .get<{ url: string }>(`/api/grafana/embed/${encodeURIComponent(uid)}`, {
                    params: { from: 'now-1h', to: 'now' },
                })
                .then((r) => r.data),
        enabled: !!uid,
    });
}

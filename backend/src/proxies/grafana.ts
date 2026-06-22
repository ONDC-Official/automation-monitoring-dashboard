import axios, { AxiosInstance } from 'axios';
import { config } from '../config/env';

/**
 * Grafana proxy. Lists dashboards and builds embed URLs. The frontend embeds
 * Grafana panels via iframe (kiosk mode); this just provides discovery + the
 * base URL. Requires GF_SECURITY_ALLOW_EMBEDDING=true on the Grafana side
 * (see docker-compose.override.yml).
 */

// Grafana's read APIs (e.g. /api/search) require auth. Prefer a service-account
// token; otherwise fall back to basic auth (admin/admin by default).
const http: AxiosInstance = axios.create({
    baseURL: config.grafanaUrl,
    timeout: 10_000,
    ...(config.grafanaApiToken
        ? { headers: { Authorization: `Bearer ${config.grafanaApiToken}` } }
        : {
              auth: {
                  username: config.grafanaUser,
                  password: config.grafanaPassword,
              },
          }),
});

export interface DashboardRef {
    uid: string;
    title: string;
    url: string;
    folderTitle?: string;
    tags: string[];
}

export const listDashboards = async (): Promise<DashboardRef[]> => {
    const { data } = await http.get('/api/search', {
        params: { type: 'dash-db' },
    });
    return (data as Array<Record<string, unknown>>).map(d => ({
        uid: String(d.uid),
        title: String(d.title),
        url: String(d.url),
        folderTitle: d.folderTitle ? String(d.folderTitle) : undefined,
        tags: (d.tags as string[]) ?? [],
    }));
};

/** Build a kiosk embed URL for a full dashboard. */
export const dashboardEmbedUrl = (
    uid: string,
    opts: { from?: string; to?: string; theme?: 'light' | 'dark' } = {}
): string => {
    const params = new URLSearchParams({
        kiosk: 'tv',
        from: opts.from ?? 'now-1h',
        to: opts.to ?? 'now',
        theme: opts.theme ?? 'light',
    });
    return `${config.grafanaUrl}/d/${encodeURIComponent(uid)}?${params}`;
};

/** Build an embed URL for a single panel (d-solo). */
export const panelEmbedUrl = (
    uid: string,
    panelId: number,
    opts: { from?: string; to?: string; theme?: 'light' | 'dark' } = {}
): string => {
    const params = new URLSearchParams({
        panelId: String(panelId),
        from: opts.from ?? 'now-1h',
        to: opts.to ?? 'now',
        theme: opts.theme ?? 'light',
    });
    return `${config.grafanaUrl}/d-solo/${encodeURIComponent(uid)}?${params}`;
};

export const isUp = async (): Promise<boolean> => {
    try {
        const { status } = await http.get('/api/health', { timeout: 4000 });
        return status >= 200 && status < 300;
    } catch {
        return false;
    }
};

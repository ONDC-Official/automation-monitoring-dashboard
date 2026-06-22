import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/PageHeader';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export function GrafanaPage() {
    const dashboards = useQuery({
        queryKey: ['grafana-dashboards'],
        queryFn: api.grafanaDashboards,
    });
    const [selectedUid, setSelectedUid] = useState<string>('');
    // Default to the first dashboard without storing it in state (no effect).
    const uid = selectedUid || dashboards.data?.dashboards[0]?.uid || '';

    const embed = useQuery({
        queryKey: ['grafana-embed', uid],
        queryFn: () => api.grafanaEmbedUrl(uid, { from: 'now-1h', to: 'now' }),
        enabled: !!uid,
    });

    return (
        <div className="flex h-full flex-col space-y-4">
            <PageHeader
                title="Grafana"
                description="Embedded provisioned dashboards. Requires GF_SECURITY_ALLOW_EMBEDDING=true (see docker-compose.override.yml)."
                actions={
                    <div className="flex items-center gap-2">
                        <Select value={uid} onValueChange={setSelectedUid}>
                            <SelectTrigger className="w-72">
                                <SelectValue placeholder="Select a dashboard" />
                            </SelectTrigger>
                            <SelectContent>
                                {(dashboards.data?.dashboards ?? []).map(d => (
                                    <SelectItem key={d.uid} value={d.uid}>
                                        {d.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {embed.data?.url ? (
                            <a
                                href={embed.data.url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-accent"
                            >
                                Open <ExternalLink className="size-3.5" />
                            </a>
                        ) : null}
                    </div>
                }
            />

            {dashboards.isError ? (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                    Could not reach Grafana. Ensure the observability stack is
                    running and the backend's GRAFANA_URL is correct.
                </div>
            ) : null}

            {embed.data?.url ? (
                <div className="min-h-0 flex-1 overflow-hidden rounded-md border">
                    <iframe
                        title="grafana-dashboard"
                        src={embed.data.url}
                        className="h-full w-full"
                    />
                </div>
            ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md border text-sm text-muted-foreground">
                    {dashboards.isLoading
                        ? 'Loading dashboards…'
                        : dashboards.data?.dashboards.length
                          ? 'Select a dashboard.'
                          : 'No dashboards found.'}
                </div>
            )}

            <p className="text-xs text-muted-foreground">
                Panel blank or showing a Grafana login? Enable embedding:
                restart Grafana with the flags in{' '}
                <code>docker-compose.override.yml</code> (allow-embedding +
                anonymous). The “Open” link above always works.
            </p>
        </div>
    );
}

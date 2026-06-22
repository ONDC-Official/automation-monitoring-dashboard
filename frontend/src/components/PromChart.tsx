import { useQuery } from '@tanstack/react-query';
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { api } from '@/lib/api';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const COLORS = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
];

function seriesName(metric: Record<string, string>): string {
    const { __name__, ...labels } = metric;
    const keys = Object.keys(labels);
    if (keys.length === 0) return __name__ ?? 'value';
    return keys.map(k => `${k}=${labels[k]}`).join(', ');
}

export function PromChart({
    title,
    description,
    query,
}: {
    title: string;
    description?: string;
    query: string;
}) {
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['prom-range', query],
        queryFn: () => {
            const end = Math.floor(Date.now() / 1000);
            const start = end - 3600;
            return api.promRange({
                query,
                start: String(start),
                end: String(end),
                step: '60s',
            });
        },
        refetchInterval: 30_000,
    });

    const result = data?.data.result ?? [];
    const names = result.map(r => seriesName(r.metric));

    // Merge all series onto a shared time axis.
    const byTime = new Map<number, Record<string, number | string>>();
    result.forEach((series, i) => {
        for (const [ts, val] of series.values ?? []) {
            const row = byTime.get(ts) ?? { time: ts };
            row[names[i]] = Number(val);
            byTime.set(ts, row);
        }
    });
    const chartData = [...byTime.values()].sort(
        (a, b) => Number(a.time) - Number(b.time)
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">{title}</CardTitle>
                {description ? (
                    <CardDescription className="font-mono text-xs">
                        {description}
                    </CardDescription>
                ) : null}
            </CardHeader>
            <CardContent className="h-64">
                {isLoading ? (
                    <Skeleton className="h-full w-full" />
                ) : isError ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        {error instanceof Error ? error.message : 'query failed'}
                    </div>
                ) : chartData.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        No data
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="var(--border)"
                            />
                            <XAxis
                                dataKey="time"
                                tickFormatter={(t: number) =>
                                    new Date(t * 1000).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })
                                }
                                fontSize={11}
                                stroke="var(--muted-foreground)"
                            />
                            <YAxis
                                fontSize={11}
                                stroke="var(--muted-foreground)"
                                width={40}
                            />
                            <Tooltip
                                labelFormatter={label =>
                                    new Date(
                                        Number(label) * 1000
                                    ).toLocaleTimeString()
                                }
                                contentStyle={{
                                    background: 'var(--popover)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 8,
                                    fontSize: 12,
                                }}
                            />
                            {names.map((name, i) => (
                                <Line
                                    key={name}
                                    type="monotone"
                                    dataKey={name}
                                    stroke={COLORS[i % COLORS.length]}
                                    dot={false}
                                    strokeWidth={2}
                                    isAnimationActive={false}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}

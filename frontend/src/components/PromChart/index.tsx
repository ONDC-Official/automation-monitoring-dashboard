import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { usePromRangeQuery } from '@/hooks/useMetrics';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/Card';

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

/**
 * How to read the Y axis.
 *
 * Not cosmetic: a ratio panel plotted as a raw number reads "0.03" where the
 * question was "3% of calls", and a latency histogram reads "0.42" where it
 * meant 420ms. The panel knows which it is; the chart cannot guess.
 */
export type PromUnit = 'none' | 'percent' | 'seconds';

const formatValue = (value: number, unit: PromUnit): string => {
    if (unit === 'percent') return `${(value * 100).toFixed(1)}%`;
    if (unit === 'seconds') {
        return value < 1 ? `${Math.round(value * 1000)}ms` : `${value.toFixed(2)}s`;
    }
    if (Math.abs(value) >= 1000) return value.toLocaleString();
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
};

export function PromChart({
    title,
    description,
    query,
    unit = 'none',
}: {
    title: string;
    description?: string;
    query: string;
    unit?: PromUnit;
}) {
    const { data, isError, error } = usePromRangeQuery(query, {
        refetchInterval: 30_000,
    });

    const result = data?.data.result ?? [];
    const names = result.map(r => seriesName(r.metric));

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
                {isError ? (
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
                                width={unit === 'none' ? 40 : 56}
                                tickFormatter={(v: number) =>
                                    formatValue(v, unit)
                                }
                            />
                            <Tooltip
                                formatter={value =>
                                    formatValue(Number(value ?? 0), unit)
                                }
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

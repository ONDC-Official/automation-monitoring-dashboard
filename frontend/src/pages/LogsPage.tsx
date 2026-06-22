import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Check,
    Copy,
    Play,
    RefreshCw,
    Search,
    SlidersHorizontal,
    WrapText,
    X,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import { JsonViewer } from '@/components/JsonViewer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface LogEntry {
    ts: string; // nanoseconds
    line: string;
    labels: Record<string, string>;
}

const LEVELS = ['any', 'error', 'warn', 'info', 'debug'] as const;

// Request controls (apply instantly — they change the request, not the LogQL).
const RANGES = [
    { label: 'Last 15 min', value: '15m', ms: 15 * 60_000 },
    { label: 'Last 1 hour', value: '1h', ms: 60 * 60_000 },
    { label: 'Last 3 hours', value: '3h', ms: 3 * 60 * 60_000 },
    { label: 'Last 6 hours', value: '6h', ms: 6 * 60 * 60_000 },
    { label: 'Last 12 hours', value: '12h', ms: 12 * 60 * 60_000 },
    { label: 'Last 24 hours', value: '24h', ms: 24 * 60 * 60_000 },
] as const;
const LIMITS = [100, 250, 500, 1000, 2000] as const;
const REFRESH = [
    { label: 'No auto-refresh', value: 0 },
    { label: 'Every 5s', value: 5_000 },
    { label: 'Every 10s', value: 10_000 },
    { label: 'Every 30s', value: 30_000 },
] as const;

// Structured filters compose a LogQL query. The base stream selector and the
// `| json` field filters mirror the monitored service's pino-loki labels and
// trace envelope (transaction_id / session_id / correlation_id / domain / version).
function buildLogQL(f: {
    stream: string;
    level: string;
    transactionId: string;
    sessionId: string;
    correlationId: string;
    domain: string;
    version: string;
    search: string;
}): string {
    let q = f.stream.trim() || '{service_name=~".+"}';
    if (f.search.trim()) q += ` |= \`${f.search.trim()}\``;
    q += ' | json';
    const eq = (field: string, value: string) =>
        value.trim() ? ` | ${field}=\`${value.trim()}\`` : '';
    if (f.level !== 'any') q += eq('level', f.level);
    q += eq('transaction_id', f.transactionId);
    q += eq('session_id', f.sessionId);
    q += eq('correlation_id', f.correlationId);
    q += eq('domain', f.domain);
    q += eq('version', f.version);
    return q;
}

// Loki ships nanosecond string timestamps; the API wants ns strings too.
const msToNs = (ms: number) => `${ms}000000`;

function parseLine(line: string) {
    let parsed: Record<string, unknown> | null = null;
    try {
        const v = JSON.parse(line);
        if (v && typeof v === 'object') parsed = v as Record<string, unknown>;
    } catch {
        /* not JSON */
    }
    const level = (
        (parsed?.level as string | undefined) ?? ''
    ).toLowerCase();
    const msg =
        (parsed?.msg as string) ?? (parsed?.message as string) ?? line;
    return { parsed, level, msg };
}

function levelColor(level: string): string {
    switch (level) {
        case 'error':
        case 'fatal':
            return 'bg-red-500/15 text-red-600 dark:text-red-400';
        case 'warn':
        case 'warning':
            return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
        case 'debug':
            return 'bg-slate-500/15 text-slate-600 dark:text-slate-400';
        default:
            return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
    }
}

function Highlight({ text, term }: { text: string; term: string }) {
    if (!term) return <>{text}</>;
    const lower = text.toLowerCase();
    const q = term.toLowerCase();
    const parts: ReactNode[] = [];
    let i = 0;
    let k = 0;
    while (i < text.length) {
        const idx = lower.indexOf(q, i);
        if (idx === -1) {
            parts.push(text.slice(i));
            break;
        }
        if (idx > i) parts.push(text.slice(i, idx));
        parts.push(
            <mark
                key={k++}
                className="rounded-sm bg-yellow-300/70 px-0.5 text-foreground dark:bg-yellow-500/40"
            >
                {text.slice(idx, idx + q.length)}
            </mark>
        );
        i = idx + q.length;
    }
    return <>{parts}</>;
}

function LogRow({
    entry,
    term,
    wrap,
}: {
    entry: LogEntry;
    term: string;
    wrap: boolean;
}) {
    const [open, setOpen] = useState(false);
    const { parsed, level, msg } = parseLine(entry.line);
    const date = new Date(Number(BigInt(entry.ts) / 1_000_000n));

    return (
        <div className="border-b text-xs last:border-0">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex w-full items-start gap-3 px-3 py-1.5 text-left hover:bg-muted/50"
            >
                <span
                    className="shrink-0 font-mono text-muted-foreground"
                    title={date.toLocaleString()}
                >
                    {date.toLocaleTimeString()}
                </span>
                <span
                    className={cn(
                        'shrink-0 rounded px-1.5 py-0.5 font-medium uppercase',
                        levelColor(level)
                    )}
                >
                    {level || 'log'}
                </span>
                <span
                    className={cn(
                        'min-w-0 flex-1 font-mono',
                        wrap ? 'break-all whitespace-pre-wrap' : 'truncate'
                    )}
                >
                    <Highlight text={msg} term={term} />
                </span>
            </button>
            {open ? (
                <div className="px-3 pb-2">
                    <JsonViewer
                        value={parsed ?? entry.line}
                        searchable={false}
                        maxHeightClass="max-h-80"
                    />
                </div>
            ) : null}
        </div>
    );
}

const DEFAULT_STREAM = '{service_name=~".+"}';

export function LogsPage() {
    // Query-content filters — applied to the request only on Run.
    const [stream, setStream] = useState(DEFAULT_STREAM);
    const [level, setLevel] = useState<string>('any');
    const [transactionId, setTransactionId] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [correlationId, setCorrelationId] = useState('');
    const [domain, setDomain] = useState('');
    const [version, setVersion] = useState('');
    const [search, setSearch] = useState('');
    const [rawOverride, setRawOverride] = useState('');

    // Request controls — applied instantly (part of the query key).
    const [range, setRange] = useState<string>('1h');
    const [limit, setLimit] = useState<number>(500);
    const [direction, setDirection] = useState<'backward' | 'forward'>(
        'backward'
    );
    const [autoRefresh, setAutoRefresh] = useState<number>(0);

    // UI-only toggles.
    const [showFilters, setShowFilters] = useState(false);
    const [wrap, setWrap] = useState(false);
    const [copied, setCopied] = useState(false);

    // The query snapshot that's actually executed. Editing the filters above
    // doesn't refetch until Run; the live `query` below is only a preview.
    const [submitted, setSubmitted] = useState<string | null>(null);

    const query = useMemo(
        () =>
            rawOverride.trim() ||
            buildLogQL({
                stream,
                level,
                transactionId,
                sessionId,
                correlationId,
                domain,
                version,
                search,
            }),
        [
            rawOverride,
            stream,
            level,
            transactionId,
            sessionId,
            correlationId,
            domain,
            version,
            search,
        ]
    );

    const logs = useQuery({
        queryKey: ['logs', submitted, range, limit, direction],
        enabled: submitted != null,
        refetchInterval: autoRefresh > 0 ? autoRefresh : false,
        queryFn: async () => {
            const now = Date.now();
            const rangeMs =
                RANGES.find(r => r.value === range)?.ms ?? 60 * 60_000;
            const res = await api.logsQuery({
                query: submitted!,
                start: msToNs(now - rangeMs),
                end: msToNs(now),
                limit,
                direction,
            });
            const flat: LogEntry[] = (res.data.result ?? []).flatMap(s =>
                s.values.map(([ts, line]) => ({ ts, line, labels: s.stream }))
            );
            // Loki sorts per-stream; re-sort the merged set for the chosen order.
            flat.sort((a, b) => {
                const c =
                    BigInt(a.ts) < BigInt(b.ts)
                        ? -1
                        : BigInt(a.ts) > BigInt(b.ts)
                          ? 1
                          : 0;
                return direction === 'forward' ? c : -c;
            });
            return flat;
        },
    });

    const entries = useMemo(() => logs.data ?? [], [logs.data]);

    const counts = useMemo(() => {
        let errors = 0;
        let warns = 0;
        for (const e of entries) {
            const { level: l } = parseLine(e.line);
            if (l === 'error' || l === 'fatal') errors += 1;
            else if (l === 'warn' || l === 'warning') warns += 1;
        }
        return { errors, warns };
    }, [entries]);

    // Re-run even when the query string is unchanged (refresh in place).
    const run = () => {
        if (submitted === query) logs.refetch();
        else setSubmitted(query);
    };

    const clear = () => {
        setStream(DEFAULT_STREAM);
        setLevel('any');
        setTransactionId('');
        setSessionId('');
        setCorrelationId('');
        setDomain('');
        setVersion('');
        setSearch('');
        setRawOverride('');
    };

    const copyQuery = async () => {
        try {
            await navigator.clipboard.writeText(query);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
            toast.success('Query copied');
        } catch {
            toast.error('Copy failed');
        }
    };

    const errorMsg = logs.isError
        ? logs.error instanceof Error
            ? logs.error.message
            : 'query failed'
        : null;

    return (
        <div className="flex h-full flex-col gap-3">
            <PageHeader
                title="Logs"
                description="Structured Loki viewer — filter by trace fields and render JSON logs."
                actions={
                    <Button
                        size="sm"
                        onClick={run}
                        disabled={logs.isFetching}
                    >
                        {logs.isFetching ? (
                            <RefreshCw className="size-4 animate-spin" />
                        ) : (
                            <Play className="size-4" />
                        )}
                        Run
                    </Button>
                }
            />

            {/* Request controls — apply instantly */}
            <div className="flex flex-wrap items-center gap-2">
                <Select value={range} onValueChange={setRange}>
                    <SelectTrigger className="w-36" size="sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {RANGES.map(r => (
                            <SelectItem key={r.value} value={r.value}>
                                {r.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select
                    value={String(limit)}
                    onValueChange={v => setLimit(Number(v))}
                >
                    <SelectTrigger className="w-32" size="sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {LIMITS.map(l => (
                            <SelectItem key={l} value={String(l)}>
                                {l} lines
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select
                    value={direction}
                    onValueChange={v =>
                        setDirection(v as 'backward' | 'forward')
                    }
                >
                    <SelectTrigger className="w-36" size="sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="backward">Newest first</SelectItem>
                        <SelectItem value="forward">Oldest first</SelectItem>
                    </SelectContent>
                </Select>
                <Select
                    value={String(autoRefresh)}
                    onValueChange={v => setAutoRefresh(Number(v))}
                >
                    <SelectTrigger className="w-44" size="sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {REFRESH.map(r => (
                            <SelectItem key={r.value} value={String(r.value)}>
                                {r.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                    {logs.data && logs.dataUpdatedAt ? (
                        <span>
                            Updated{' '}
                            {new Date(
                                logs.dataUpdatedAt
                            ).toLocaleTimeString()}
                        </span>
                    ) : null}
                </div>
            </div>

            {/* Query-content filters — apply on Run */}
            <form
                onSubmit={e => {
                    e.preventDefault();
                    run();
                }}
                className="space-y-2"
            >
                <div className="flex flex-wrap items-center gap-2">
                    <Select value={level} onValueChange={setLevel}>
                        <SelectTrigger className="w-32" size="sm">
                            <SelectValue placeholder="Level" />
                        </SelectTrigger>
                        <SelectContent>
                            {LEVELS.map(l => (
                                <SelectItem key={l} value={l}>
                                    {l === 'any' ? 'Any level' : l}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="relative min-w-52 flex-1">
                        <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Free-text search (Enter to run)"
                            className="pl-7"
                        />
                    </div>
                    <Button
                        type="button"
                        variant={showFilters ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => setShowFilters(s => !s)}
                    >
                        <SlidersHorizontal className="size-4" /> Trace filters
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clear}
                    >
                        <X className="size-4" /> Clear
                    </Button>
                </div>

                {showFilters ? (
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                        <Input
                            value={transactionId}
                            onChange={e => setTransactionId(e.target.value)}
                            placeholder="transaction_id"
                        />
                        <Input
                            value={sessionId}
                            onChange={e => setSessionId(e.target.value)}
                            placeholder="session_id"
                        />
                        <Input
                            value={correlationId}
                            onChange={e => setCorrelationId(e.target.value)}
                            placeholder="correlation_id"
                        />
                        <Input
                            value={domain}
                            onChange={e => setDomain(e.target.value)}
                            placeholder="domain"
                        />
                        <Input
                            value={version}
                            onChange={e => setVersion(e.target.value)}
                            placeholder="version"
                        />
                        <Input
                            value={stream}
                            onChange={e => setStream(e.target.value)}
                            placeholder="stream selector"
                            className="font-mono text-xs"
                        />
                    </div>
                ) : null}

                <Input
                    value={rawOverride}
                    onChange={e => setRawOverride(e.target.value)}
                    placeholder="Advanced: raw LogQL override (overrides the filters above)"
                    className="font-mono text-xs"
                />
            </form>

            {/* Live query preview */}
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2 py-1">
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                    {query}
                </code>
                <button
                    type="button"
                    onClick={copyQuery}
                    title="Copy query"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                    {copied ? (
                        <Check className="size-3.5 text-emerald-500" />
                    ) : (
                        <Copy className="size-3.5" />
                    )}
                </button>
            </div>

            {errorMsg ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                    {errorMsg}
                </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-auto rounded-md border">
                {logs.isLoading ? (
                    <div className="space-y-px p-2">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <Skeleton key={i} className="h-6 w-full" />
                        ))}
                    </div>
                ) : submitted == null ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                        Set your filters and press Run to query logs.
                    </div>
                ) : entries.length === 0 ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                        No logs in this range. Widen the time range or relax the
                        filters.
                    </div>
                ) : (
                    entries.map((e, i) => (
                        <LogRow
                            key={`${e.ts}-${i}`}
                            entry={e}
                            term={search.trim()}
                            wrap={wrap}
                        />
                    ))
                )}
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                    <span>{entries.length} lines</span>
                    {counts.errors > 0 ? (
                        <Badge
                            variant="outline"
                            className="border-red-500/40 text-red-600 dark:text-red-400"
                        >
                            {counts.errors} errors
                        </Badge>
                    ) : null}
                    {counts.warns > 0 ? (
                        <Badge
                            variant="outline"
                            className="border-amber-500/40 text-amber-600 dark:text-amber-400"
                        >
                            {counts.warns} warnings
                        </Badge>
                    ) : null}
                </div>
                <Button
                    type="button"
                    variant={wrap ? 'secondary' : 'ghost'}
                    size="xs"
                    onClick={() => setWrap(w => !w)}
                >
                    <WrapText className="size-3" /> Wrap
                </Button>
            </div>
        </div>
    );
}

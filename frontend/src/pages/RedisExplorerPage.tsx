import { useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Copy, RefreshCw, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, type BusinessType } from '@/lib/api';
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs';

const ALL = 'ALL';

const BUSINESS_TYPES: (BusinessType | typeof ALL)[] = [
    ALL,
    'MOCK_DATA',
    'FLOW_STATUS',
    'EXTRA_FLOW_STATUS',
    'PLAYGROUND',
    'TRANSACTION',
    'SUBSCRIBER',
    'SESSION',
    'RUNNER_CONFIG',
    'UNKNOWN',
];

function ttlLabel(ttl: number): string {
    if (ttl === -1) return 'no expiry';
    if (ttl === -2) return 'missing';
    if (ttl < 60) return `${ttl}s`;
    if (ttl < 3600) return `${Math.round(ttl / 60)}m`;
    return `${Math.round(ttl / 360) / 10}h`;
}

// Color the TTL by urgency so soon-to-expire keys stand out at a glance.
function ttlClass(ttl: number): string {
    if (ttl === -2) return 'text-muted-foreground line-through';
    if (ttl === -1) return 'text-muted-foreground';
    if (ttl < 60) return 'text-red-600 dark:text-red-400';
    if (ttl < 300) return 'text-amber-600 dark:text-amber-400';
    return 'text-foreground';
}

function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

async function copyText(text: string) {
    try {
        await navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
    } catch {
        toast.error('Copy failed');
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

export function RedisExplorerPage() {
    const [searchParams] = useSearchParams();
    const [db, setDb] = useState<number>(Number(searchParams.get('db') ?? 0));
    const [match, setMatch] = useState('*');
    const [matchInput, setMatchInput] = useState('*');
    const [typeFilter, setTypeFilter] = useState<string>(ALL);
    const [keyFilter, setKeyFilter] = useState('');
    const [selected, setSelected] = useState<string | null>(null);

    const dbs = useQuery({ queryKey: ['redis-dbs'], queryFn: api.redisDbs });
    const dbOptions = dbs.data?.dbs ?? [
        { db: 0, label: 'business', dbsize: 0 },
        { db: 1, label: 'runner config', dbsize: 0 },
    ];
    const dbTotal = dbOptions.find(d => d.db === db)?.dbsize;

    const scan = useInfiniteQuery({
        queryKey: ['redis-scan', db, match],
        queryFn: ({ pageParam }) =>
            api.redisScan({ db, match, cursor: pageParam }),
        initialPageParam: '0',
        getNextPageParam: last =>
            last.cursor === '0' ? undefined : last.cursor,
    });

    // All loaded keys, before client-side filtering.
    const loaded = useMemo(
        () => (scan.data?.pages ?? []).flatMap(p => p.keys),
        [scan.data]
    );

    // Per-type counts over the loaded set (drives the filter dropdown labels).
    const typeCounts = useMemo(() => {
        const m: Record<string, number> = {};
        for (const k of loaded)
            m[k.businessType] = (m[k.businessType] ?? 0) + 1;
        return m;
    }, [loaded]);

    const keyQuery = keyFilter.trim().toLowerCase();
    const keys = useMemo(
        () =>
            loaded.filter(
                k =>
                    (typeFilter === ALL || k.businessType === typeFilter) &&
                    (!keyQuery || k.key.toLowerCase().includes(keyQuery))
            ),
        [loaded, typeFilter, keyQuery]
    );

    const inspect = useQuery({
        queryKey: ['redis-inspect', db, selected],
        queryFn: () => api.redisInspect(db, selected!),
        enabled: selected != null,
    });

    return (
        <div className="space-y-4">
            <PageHeader
                title="Redis Explorer"
                description="SCAN-based, business-decoded view of the cache. Read-only."
                actions={
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => scan.refetch()}
                        disabled={scan.isFetching}
                    >
                        <RefreshCw
                            className={cn(
                                'size-4',
                                scan.isFetching &&
                                    !scan.isFetchingNextPage &&
                                    'animate-spin'
                            )}
                        />
                        Refresh
                    </Button>
                }
            />

            <div className="flex flex-wrap items-center gap-2">
                <Select
                    value={String(db)}
                    onValueChange={v => {
                        setDb(Number(v));
                        setSelected(null);
                    }}
                >
                    <SelectTrigger className="w-56" size="sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {dbOptions.map(d => (
                            <SelectItem key={d.db} value={String(d.db)}>
                                DB{d.db} · {d.label}
                                {d.dbsize
                                    ? ` · ${d.dbsize.toLocaleString()} keys`
                                    : ''}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <form
                    className="flex items-center gap-2"
                    onSubmit={e => {
                        e.preventDefault();
                        setMatch(matchInput || '*');
                    }}
                >
                    <Input
                        value={matchInput}
                        onChange={e => setMatchInput(e.target.value)}
                        placeholder="SCAN MATCH e.g. FLOW_STATUS_*"
                        className="w-64 font-mono text-xs"
                    />
                    <Button type="submit" variant="secondary" size="sm">
                        Scan
                    </Button>
                </form>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-52" size="sm">
                        <SelectValue placeholder="Business type" />
                    </SelectTrigger>
                    <SelectContent>
                        {BUSINESS_TYPES.map(t => (
                            <SelectItem key={t} value={t}>
                                {t === ALL
                                    ? `All types (${loaded.length})`
                                    : `${t}${typeCounts[t] ? ` (${typeCounts[t]})` : ''}`}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <div className="relative w-56">
                    <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={keyFilter}
                        onChange={e => setKeyFilter(e.target.value)}
                        placeholder="Filter loaded keys…"
                        className="px-7"
                    />
                    {keyFilter ? (
                        <button
                            type="button"
                            onClick={() => setKeyFilter('')}
                            className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="size-3.5" />
                        </button>
                    ) : null}
                </div>

                <span className="ml-auto text-sm text-muted-foreground">
                    {keys.length.toLocaleString()} shown ·{' '}
                    {loaded.length.toLocaleString()} loaded
                    {typeof dbTotal === 'number' && dbTotal > 0
                        ? ` · ${dbTotal.toLocaleString()} in DB`
                        : ''}
                </span>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[55%]">Key</TableHead>
                            <TableHead>Business type</TableHead>
                            <TableHead>Redis type</TableHead>
                            <TableHead className="text-right">TTL</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {scan.isLoading ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={4}>
                                        <Skeleton className="h-5 w-full" />
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : keys.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={4}
                                    className="py-10 text-center text-muted-foreground"
                                >
                                    {loaded.length === 0
                                        ? 'No keys. Adjust the DB / MATCH pattern.'
                                        : 'No keys match the current filters.'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            keys.map(k => (
                                <TableRow
                                    key={k.key}
                                    className="group cursor-pointer"
                                    data-state={
                                        selected === k.key
                                            ? 'selected'
                                            : undefined
                                    }
                                    onClick={() => setSelected(k.key)}
                                >
                                    <TableCell className="max-w-0 font-mono text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="min-w-0 flex-1 truncate">
                                                <Highlight
                                                    text={k.key}
                                                    term={keyQuery}
                                                />
                                            </span>
                                            <button
                                                type="button"
                                                title="Copy key"
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    copyText(k.key);
                                                }}
                                                className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
                                            >
                                                <Copy className="size-3.5" />
                                            </button>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary">
                                            {k.businessType}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {k.type}
                                    </TableCell>
                                    <TableCell
                                        className={cn(
                                            'text-right font-mono text-xs',
                                            ttlClass(k.ttl)
                                        )}
                                    >
                                        {ttlLabel(k.ttl)}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {scan.hasNextPage ? (
                <div className="flex justify-center">
                    <Button
                        variant="outline"
                        onClick={() => scan.fetchNextPage()}
                        disabled={scan.isFetchingNextPage}
                    >
                        {scan.isFetchingNextPage ? (
                            <>
                                <RefreshCw className="size-4 animate-spin" />
                                Loading…
                            </>
                        ) : (
                            'Load more'
                        )}
                    </Button>
                </div>
            ) : null}

            <Sheet
                open={selected != null}
                onOpenChange={open => !open && setSelected(null)}
            >
                <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-2xl">
                    <SheetHeader>
                        <div className="flex items-start justify-between gap-2">
                            <SheetTitle className="min-w-0 break-all font-mono text-sm">
                                {selected}
                            </SheetTitle>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                className="shrink-0"
                                title="Copy key"
                                onClick={() => selected && copyText(selected)}
                            >
                                <Copy className="size-4" />
                            </Button>
                        </div>
                        <SheetDescription asChild>
                            {inspect.data ? (
                                <span className="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary">
                                        {inspect.data.businessType}
                                    </Badge>
                                    <Badge variant="outline">
                                        {inspect.data.type}
                                    </Badge>
                                    <Badge
                                        variant={
                                            inspect.data.validation.ok
                                                ? 'outline'
                                                : 'destructive'
                                        }
                                    >
                                        {inspect.data.validation.ok
                                            ? 'schema valid'
                                            : 'schema invalid'}
                                    </Badge>
                                    <span className="text-xs">
                                        TTL {ttlLabel(inspect.data.ttl)} ·{' '}
                                        {formatBytes(inspect.data.sizeBytes)}
                                    </span>
                                </span>
                            ) : (
                                <span>Loading…</span>
                            )}
                        </SheetDescription>
                    </SheetHeader>

                    {inspect.isError ? (
                        <div className="m-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
                            Failed to inspect key.
                        </div>
                    ) : !inspect.data ? (
                        <div className="space-y-3 p-4">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-64 w-full" />
                        </div>
                    ) : (
                        <div className="space-y-4 p-4">
                            {!inspect.data.validation.ok &&
                            inspect.data.validation.errors.length > 0 ? (
                                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
                                    <div className="mb-1 font-medium text-destructive">
                                        Validation errors
                                    </div>
                                    <ul className="list-inside list-disc space-y-0.5 font-mono">
                                        {inspect.data.validation.errors.map(
                                            (err, i) => (
                                                <li key={i}>{err}</li>
                                            )
                                        )}
                                    </ul>
                                </div>
                            ) : null}

                            {Object.keys(inspect.data.parts).length > 0 ? (
                                <div className="rounded-md border p-3 text-xs">
                                    <div className="mb-2 font-medium">
                                        Decoded key parts
                                    </div>
                                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                                        {Object.entries(
                                            inspect.data.parts
                                        ).map(([k, v]) => (
                                            <div key={k} className="contents">
                                                <dt className="text-muted-foreground">
                                                    {k}
                                                </dt>
                                                <dd className="break-all font-mono">
                                                    {v}
                                                </dd>
                                            </div>
                                        ))}
                                    </dl>
                                </div>
                            ) : null}

                            <Tabs defaultValue="decoded">
                                <TabsList>
                                    <TabsTrigger value="decoded">
                                        Business view
                                    </TabsTrigger>
                                    <TabsTrigger value="raw">Raw</TabsTrigger>
                                </TabsList>
                                <TabsContent value="decoded">
                                    {inspect.data.decoded != null ? (
                                        <JsonViewer
                                            value={inspect.data.decoded}
                                        />
                                    ) : (
                                        <p className="rounded-md border bg-muted/40 p-4 text-xs text-muted-foreground">
                                            No decoded business view (schema
                                            invalid or unknown key type). See
                                            the Raw tab.
                                        </p>
                                    )}
                                </TabsContent>
                                <TabsContent value="raw">
                                    <JsonViewer value={inspect.data.raw} />
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    );
}

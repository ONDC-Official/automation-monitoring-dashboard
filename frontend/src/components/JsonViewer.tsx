import {
    createContext,
    useContext,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import {
    Check,
    ChevronRight,
    Copy,
    FoldVertical,
    Search,
    UnfoldVertical,
    X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/**
 * Professional, dependency-free JSON tree viewer.
 *  - collapsible objects/arrays
 *  - in-tree search: highlights matches, auto-expands paths to them, match count
 *  - expand-all / collapse-all
 *  - copy to clipboard
 * Reused by the Redis inspector and the Logs expanded rows.
 */

const INITIAL_DEPTH = 2;

type DefaultMode = 'auto' | 'open' | 'closed';

interface Ctx {
    query: string; // lowercased
    defaultMode: DefaultMode;
}
const JsonCtx = createContext<Ctx>({ query: '', defaultMode: 'auto' });

function isContainer(v: unknown): v is object {
    return v !== null && typeof v === 'object';
}

function entriesOf(v: object): Array<[string, unknown]> {
    return Array.isArray(v)
        ? v.map((item, i) => [String(i), item])
        : Object.entries(v);
}

function subtreeMatches(value: unknown, q: string): boolean {
    if (!q) return false;
    if (!isContainer(value)) return String(value).toLowerCase().includes(q);
    for (const [k, v] of entriesOf(value)) {
        if (k.toLowerCase().includes(q)) return true;
        if (subtreeMatches(v, q)) return true;
    }
    return false;
}

function countMatches(value: unknown, q: string): number {
    if (!q) return 0;
    if (!isContainer(value)) {
        return String(value).toLowerCase().includes(q) ? 1 : 0;
    }
    let n = 0;
    for (const [k, v] of entriesOf(value)) {
        if (k.toLowerCase().includes(q)) n += 1;
        n += countMatches(v, q);
    }
    return n;
}

function Highlight({ text, query }: { text: string; query: string }) {
    if (!query) return <>{text}</>;
    const lower = text.toLowerCase();
    const parts: ReactNode[] = [];
    let i = 0;
    let k = 0;
    while (i < text.length) {
        const idx = lower.indexOf(query, i);
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
                {text.slice(idx, idx + query.length)}
            </mark>
        );
        i = idx + query.length;
    }
    return <>{parts}</>;
}

function Token({ value, query }: { value: unknown; query: string }) {
    if (value === null)
        return <span className="text-muted-foreground italic">null</span>;
    switch (typeof value) {
        case 'string':
            return (
                <span className="break-all text-emerald-600 dark:text-emerald-400">
                    "<Highlight text={value} query={query} />"
                </span>
            );
        case 'number':
            return (
                <span className="text-amber-600 dark:text-amber-400">
                    <Highlight text={String(value)} query={query} />
                </span>
            );
        case 'boolean':
            return (
                <span className="text-sky-600 dark:text-sky-400">
                    {String(value)}
                </span>
            );
        default:
            return (
                <span className="text-muted-foreground">{String(value)}</span>
            );
    }
}

function Node({
    name,
    value,
    depth,
}: {
    name?: string;
    value: unknown;
    depth: number;
}) {
    const { query, defaultMode } = useContext(JsonCtx);
    const seed =
        defaultMode === 'open'
            ? true
            : defaultMode === 'closed'
              ? depth === 0
              : depth < INITIAL_DEPTH;
    const [open, setOpen] = useState(seed);

    const matchesBelow = useMemo(
        () => (query ? subtreeMatches(value, query) : false),
        [value, query]
    );

    const keyEl =
        name !== undefined ? (
            <span className="text-violet-600 dark:text-violet-300">
                <Highlight text={name} query={query} />
            </span>
        ) : null;

    if (!isContainer(value)) {
        return (
            <div className="flex gap-1.5 py-0.5">
                {keyEl}
                {keyEl ? <span className="text-muted-foreground">:</span> : null}
                <Token value={value} query={query} />
            </div>
        );
    }

    const arr = Array.isArray(value);
    const items = entriesOf(value);
    const effectiveOpen = open || matchesBelow;
    const openBrace = arr ? '[' : '{';
    const closeBrace = arr ? ']' : '}';

    return (
        <div>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="flex w-full items-center gap-1 py-0.5 text-left hover:bg-muted/40"
            >
                <ChevronRight
                    className={cn(
                        'size-3 shrink-0 text-muted-foreground transition-transform',
                        effectiveOpen && 'rotate-90'
                    )}
                />
                {keyEl}
                {keyEl ? <span className="text-muted-foreground">:</span> : null}
                <span className="text-muted-foreground">{openBrace}</span>
                {!effectiveOpen ? (
                    <span className="text-muted-foreground/70">
                        {items.length} {arr ? 'items' : 'keys'}
                        {closeBrace}
                    </span>
                ) : null}
            </button>
            {effectiveOpen ? (
                <div className="ml-[7px] border-l border-border/60 pl-3">
                    {items.map(([k, v]) => (
                        <Node
                            key={k}
                            name={arr ? undefined : k}
                            value={v}
                            depth={depth + 1}
                        />
                    ))}
                    <div className="text-muted-foreground">{closeBrace}</div>
                </div>
            ) : null}
        </div>
    );
}

export function JsonViewer({
    value,
    className,
    searchable = true,
    maxHeightClass = 'max-h-[60vh]',
}: {
    value: unknown;
    className?: string;
    searchable?: boolean;
    maxHeightClass?: string;
}) {
    const [rawQuery, setRawQuery] = useState('');
    const [defaultMode, setDefaultMode] = useState<DefaultMode>('auto');
    // Remount the tree when expand/collapse-all is pressed so every node
    // re-seeds its open state from the new default mode.
    const [treeKey, setTreeKey] = useState(0);
    const [copied, setCopied] = useState(false);

    const query = rawQuery.trim().toLowerCase();
    const matches = useMemo(
        () => (query ? countMatches(value, query) : 0),
        [value, query]
    );

    const copy = async () => {
        const text =
            typeof value === 'string'
                ? value
                : JSON.stringify(value, null, 2);
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
            toast.success('Copied to clipboard');
        } catch {
            toast.error('Copy failed');
        }
    };

    const setAll = (mode: DefaultMode) => {
        setDefaultMode(mode);
        setTreeKey(k => k + 1);
    };

    return (
        <div className={cn('rounded-md border bg-card', className)}>
            <div className="flex items-center gap-2 border-b p-2">
                {searchable ? (
                    <div className="relative flex-1">
                        <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={rawQuery}
                            onChange={e => setRawQuery(e.target.value)}
                            placeholder="Search keys & values…"
                            className="h-8 pl-7 text-xs"
                        />
                        {rawQuery ? (
                            <button
                                onClick={() => setRawQuery('')}
                                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="size-3.5" />
                            </button>
                        ) : null}
                    </div>
                ) : (
                    <div className="flex-1" />
                )}
                {searchable && query ? (
                    <span className="shrink-0 text-xs text-muted-foreground">
                        {matches} match{matches === 1 ? '' : 'es'}
                    </span>
                ) : null}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    title="Expand all"
                    onClick={() => setAll('open')}
                >
                    <UnfoldVertical className="size-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    title="Collapse all"
                    onClick={() => setAll('closed')}
                >
                    <FoldVertical className="size-4" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    title="Copy JSON"
                    onClick={copy}
                >
                    {copied ? (
                        <Check className="size-4 text-emerald-500" />
                    ) : (
                        <Copy className="size-4" />
                    )}
                </Button>
            </div>
            <div
                className={cn(
                    'overflow-auto p-3 font-mono text-xs leading-relaxed',
                    maxHeightClass
                )}
            >
                <JsonCtx.Provider key={treeKey} value={{ query, defaultMode }}>
                    <Node value={value} depth={0} />
                </JsonCtx.Provider>
            </div>
        </div>
    );
}

export default JsonViewer;

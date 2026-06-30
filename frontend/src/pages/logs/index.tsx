import { useState, useEffect, useRef } from "react";
import PageHeader from "@/components/PageHeader";
import { useLogsQuery, LOGS_TAIL_URL, type LogEntry } from "@/hooks/useLogs";
import JsonViewer from "@/components/JsonViewer";
import { cn } from "@/lib/utils";

const LEVELS = ["", "debug", "info", "warn", "error"] as const;
const RANGE_OPTIONS = [
  { label: "15 min", ms: 15 * 60_000 },
  { label: "1 hr", ms: 60 * 60_000 },
  { label: "6 hr", ms: 6 * 60 * 60_000 },
];

function levelColor(level: string) {
  if (level === "error") return "text-red-500";
  if (level === "warn") return "text-amber-500";
  if (level === "debug") return "text-slate-400";
  return "text-emerald-500";
}

function parseEntry(line: string): { level: string; parsed: unknown } {
  try {
    const obj = JSON.parse(line);
    return { level: String(obj.level ?? "info"), parsed: obj };
  } catch {
    return { level: "info", parsed: line };
  }
}

function LogRow({ entry }: { entry: LogEntry }) {
  const [open, setOpen] = useState(false);
  const { level, parsed } = parseEntry(entry.line);
  const ts = new Date(Number(BigInt(entry.ts) / 1_000_000n)).toISOString();

  return (
    <div
      className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/40"
      onClick={() => setOpen((o) => !o)}
    >
      <div className="flex gap-3 px-3 py-2 text-xs font-mono">
        <span className="text-muted-foreground shrink-0">{ts}</span>
        <span className={cn("uppercase font-semibold shrink-0 w-12", levelColor(level))}>{level}</span>
        <span className="truncate text-foreground">{entry.line.slice(0, 200)}</span>
      </div>
      {open && (
        <div className="px-3 pb-3">
          <JsonViewer value={parsed} maxHeightClass="max-h-80" />
        </div>
      )}
    </div>
  );
}

export default function LogsPage() {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [level, setLevel] = useState("");
  const [rangeMs, setRangeMs] = useState(RANGE_OPTIONS[0].ms);
  const [live, setLive] = useState(false);
  const [liveLogs, setLiveLogs] = useState<LogEntry[]>([]);
  const esRef = useRef<EventSource | null>(null);

  const logs = useLogsQuery({
    submitted,
    rangeMs,
    limit: 200,
    direction: "backward",
  });

  useEffect(() => {
    if (!live || !submitted) {
      esRef.current?.close();
      esRef.current = null;
      return;
    }
    const es = new EventSource(`${LOGS_TAIL_URL}?query=${encodeURIComponent(submitted)}`);
    esRef.current = es;
    es.onmessage = (e) => {
      try {
        const entry = JSON.parse(e.data) as LogEntry;
        setLiveLogs((prev) => [entry, ...prev].slice(0, 500));
      } catch {}
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [live, submitted]);

  const builtQuery = [
    query || '{job="mock-playground"}',
    level ? `|= \`"level":"${level}"\`` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const displayLogs: LogEntry[] = live ? liveLogs : (logs.data ?? []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Logs"
        description="Structured Loki log viewer with live tail."
      />
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-60">
          <input
            className="w-full border border-input rounded-md px-3 py-1.5 text-sm font-mono bg-background"
            placeholder='{job="mock-playground"}'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="border border-input rounded-md px-2 py-1.5 text-sm bg-background"
          value={level}
          onChange={(e) => setLevel(e.target.value)}
        >
          {LEVELS.map((l) => (
            <option key={l} value={l}>{l || "all levels"}</option>
          ))}
        </select>
        <select
          className="border border-input rounded-md px-2 py-1.5 text-sm bg-background"
          value={rangeMs}
          onChange={(e) => setRangeMs(Number(e.target.value))}
        >
          {RANGE_OPTIONS.map((r) => (
            <option key={r.ms} value={r.ms}>{r.label}</option>
          ))}
        </select>
        <button
          className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground"
          onClick={() => { setSubmitted(builtQuery); setLive(false); setLiveLogs([]); }}
        >
          Query
        </button>
        <button
          className={cn("px-3 py-1.5 text-sm rounded-md border", live ? "bg-emerald-600 text-white border-emerald-600" : "border-input")}
          onClick={() => { setLive((l) => !l); if (!submitted) setSubmitted(builtQuery); }}
        >
          {live ? "Live ●" : "Live"}
        </button>
      </div>

      <div className="rounded-md border border-border overflow-auto max-h-[70vh] text-sm">
        {logs.isLoading && <p className="p-4 text-muted-foreground">Loading…</p>}
        {logs.isError && <p className="p-4 text-red-500">Error fetching logs.</p>}
        {!logs.isLoading && displayLogs.length === 0 && submitted && (
          <p className="p-4 text-muted-foreground">No logs found.</p>
        )}
        {!submitted && (
          <p className="p-4 text-muted-foreground">Enter a LogQL query and click Query or Live.</p>
        )}
        {displayLogs.map((entry, i) => (
          <LogRow key={`${entry.ts}-${i}`} entry={entry} />
        ))}
      </div>
    </div>
  );
}

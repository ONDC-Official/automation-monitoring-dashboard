import { type ReactNode } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/Table";
import { ttlLabel, ttlClass, copyText } from "./utils";

interface RedisKey {
  key: string;
  businessType: string;
  type: string;
  ttl: number;
}

interface Props {
  keys: RedisKey[];
  selected: string | null;
  onSelect: (key: string) => void;
  keyQuery: string;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
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

export function RedisTable({
  keys,
  selected,
  onSelect,
  keyQuery,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: Props) {
  return (
    <>
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
            {keys.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-10 text-center text-muted-foreground"
                >
                  {keyQuery
                    ? "No keys match the current filters."
                    : "No keys. Adjust the DB / MATCH pattern."}
                </TableCell>
              </TableRow>
            ) : (
              keys.map((k) => (
                <TableRow
                  key={k.key}
                  className="group cursor-pointer"
                  data-state={selected === k.key ? "selected" : undefined}
                  onClick={() => onSelect(k.key)}
                >
                  <TableCell className="max-w-0 font-mono text-xs">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate">
                        <Highlight text={k.key} term={keyQuery} />
                      </span>
                      <button
                        type="button"
                        title="Copy key"
                        onClick={(e) => {
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
                    <Badge variant="secondary">{k.businessType}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {k.type}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono text-xs",
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

      {hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Loading…
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      ) : null}
    </>
  );
}

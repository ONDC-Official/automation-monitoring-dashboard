import { Copy } from "lucide-react";
import type { useRedisInspect } from "@/hooks/useRedis";
import Button from "@/components/Button";
import Badge from "@/components/Badge";
import { JsonViewer } from "@/components/JsonViewer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/Sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/Tabs";
import { copyText, formatBytes, ttlLabel } from "./utils";

type InspectResult = ReturnType<typeof useRedisInspect>;

interface Props {
  selected: string | null;
  onClose: () => void;
  inspect: InspectResult;
}

export function KeyInspector({ selected, onClose, inspect }: Props) {
  return (
    <Sheet open={selected != null} onOpenChange={(open) => !open && onClose()}>
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
                <Badge variant="secondary">{inspect.data.businessType}</Badge>
                <Badge variant="outline">{inspect.data.type}</Badge>
                <Badge
                  variant={
                    inspect.data.validation.ok ? "outline" : "destructive"
                  }
                >
                  {inspect.data.validation.ok ? "schema valid" : "schema invalid"}
                </Badge>
                <span className="text-xs">
                  TTL {ttlLabel(inspect.data.ttl)} ·{" "}
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
        ) : !inspect.data ? null : (
          <div className="space-y-4 p-4">
            {!inspect.data.validation.ok &&
            inspect.data.validation.errors.length > 0 ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
                <div className="mb-1 font-medium text-destructive">
                  Validation errors
                </div>
                <ul className="list-inside list-disc space-y-0.5 font-mono">
                  {inspect.data.validation.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {Object.keys(inspect.data.parts).length > 0 ? (
              <div className="rounded-md border p-3 text-xs">
                <div className="mb-2 font-medium">Decoded key parts</div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                  {Object.entries(inspect.data.parts).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="break-all font-mono">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}

            <Tabs defaultValue="decoded">
              <TabsList>
                <TabsTrigger value="decoded">Business view</TabsTrigger>
                <TabsTrigger value="raw">Raw</TabsTrigger>
              </TabsList>
              <TabsContent value="decoded">
                {inspect.data.decoded != null ? (
                  <JsonViewer value={inspect.data.decoded} />
                ) : (
                  <p className="rounded-md border bg-muted/40 p-4 text-xs text-muted-foreground">
                    No decoded business view (schema invalid or unknown key
                    type). See the Raw tab.
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
  );
}

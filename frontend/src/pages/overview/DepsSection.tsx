import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/Card";
import type { DepState } from "@/services/types";
import { DEP_LABELS } from "./constants";

interface Props {
  deps: Record<string, DepState> | undefined;
}

export function DepsSection({ deps }: Props) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">
        Dependencies
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {Object.entries(deps ?? {}).map(([k, state]) => {
          // "Not configured" is a third state. Rendering it as Down would
          // report every playground-only deployment as broken.
          const disabled = state === "disabled";
          return (
            <Card key={k}>
              <CardContent className="flex flex-col gap-2 p-4">
                <span className="text-xs text-muted-foreground">
                  {DEP_LABELS[k] ?? k}
                </span>
                <span className="flex items-center gap-2 text-sm font-medium">
                  <span
                    className={cn(
                      "size-2.5 rounded-full",
                      disabled
                        ? "bg-status-idle"
                        : state
                          ? "bg-status-ok"
                          : "bg-status-error"
                    )}
                  />
                  {disabled ? "Off" : state ? "Up" : "Down"}
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

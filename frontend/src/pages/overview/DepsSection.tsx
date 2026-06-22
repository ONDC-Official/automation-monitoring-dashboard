import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/Card";
import { DEP_LABELS } from "./constants";

interface Props {
  deps: Record<string, boolean> | undefined;
}

export function DepsSection({ deps }: Props) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">
        Dependencies
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {Object.entries(deps ?? {}).map(([k, up]) => (
              <Card key={k}>
                <CardContent className="flex flex-col gap-2 p-4">
                  <span className="text-xs text-muted-foreground">
                    {DEP_LABELS[k] ?? k}
                  </span>
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span
                      className={cn(
                        "size-2.5 rounded-full",
                        up ? "bg-emerald-500" : "bg-red-500"
                      )}
                    />
                    {up ? "Up" : "Down"}
                  </span>
                </CardContent>
              </Card>
          ))}
      </div>
    </section>
  );
}

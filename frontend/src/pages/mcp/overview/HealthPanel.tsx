import { CircleCheck, CircleX, MinusCircle } from "lucide-react";
import { StatusBadge } from "@/components/Badge";
import {
  Card,
  CardDescription,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/Card";
import { QueryState } from "@/components/QueryState";
import { cn } from "@/lib/utils";
import type { ConfigResponse, DepState, HealthResponse } from "@/services/types";

/**
 * What the corpus depends on.
 *
 * Deliberately narrower than the panel this was ported from, which rendered a
 * whole `/ready` check list. This app already shows every dependency on its
 * own Overview page and in the header's `HealthIndicator`; repeating that here
 * would be a second answer to a question already answered, free to drift.
 * What is genuinely specific to this section is Mongo — the corpus itself.
 */

interface HealthPanelProps {
  health: HealthResponse | undefined;
  config: ConfigResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}

const INTEGRATIONS: Array<{ key: keyof ConfigResponse; label: string }> = [
  { key: "grafana_url", label: "Grafana" },
  { key: "prometheus_url", label: "Prometheus" },
  { key: "loki_url", label: "Loki" },
];

const StateIcon = ({ state }: { state: DepState | undefined }) => {
  if (state === "disabled") {
    return <MinusCircle className="size-3.5 text-status-idle" />;
  }
  return state ? (
    <CircleCheck className="size-3.5 text-status-ok" />
  ) : (
    <CircleX className={cn("size-3.5", "text-status-error")} />
  );
};

export const HealthPanel = ({
  health,
  config,
  isLoading,
  isError,
  error,
  onRetry,
}: HealthPanelProps) => {
  const mongo = health?.deps.mongo;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Corpus health</CardTitle>
        <CardDescription>The store behind this section</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <QueryState
          isLoading={isLoading}
          isError={isError}
          error={error}
          onRetry={onRetry}
        >
          <div className="flex items-center justify-between gap-3 rounded-md border border-border px-2 py-1.5">
            <span className="flex items-center gap-2 text-xs">
              <StateIcon state={mongo} />
              <span className="font-medium">MongoDB</span>
            </span>
            <span className="truncate text-[11px] text-muted-foreground">
              {mongo === "disabled"
                ? "not configured"
                : mongo
                  ? "ok"
                  : "unreachable"}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            {INTEGRATIONS.map((integration) => (
              <StatusBadge
                key={integration.label}
                tone={config?.[integration.key] ? "ok" : "neutral"}
              >
                {integration.label}
                {config?.[integration.key] ? "" : " off"}
              </StatusBadge>
            ))}
          </div>
        </QueryState>
      </CardContent>
    </Card>
  );
};

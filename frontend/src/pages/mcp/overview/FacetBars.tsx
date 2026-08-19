import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/Card";
import { QueryState } from "@/components/QueryState";
import { formatNumber } from "@/lib/format";
import { facetWidth } from "@/pages/mcp/overview/utils";
import { cn } from "@/lib/utils";
import type { FacetBucket } from "@/services/types";
import { MCP_ROUTES } from "@/pages/mcp/constants";

interface FacetBarsProps {
  title: string;
  description?: string;
  buckets: FacetBucket[];
  max: number;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  /** Which `IncidentListQuery` field a bucket filters the corpus by. */
  filterParam: "trigger" | "state" | "domain" | "status";
}

export const FacetBars = ({
  title,
  description,
  buckets,
  max,
  isLoading,
  isError,
  error,
  filterParam,
}: FacetBarsProps) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      {description ? <CardDescription>{description}</CardDescription> : null}
    </CardHeader>
    <CardContent>
      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        isEmpty={buckets.length === 0}
        emptyLabel="Nothing recorded yet"
      >
        <ul className="flex flex-col gap-1.5">
          {buckets.map((bucket) => (
            <li key={bucket.key}>
              <Link
                to={`${MCP_ROUTES.incidents}?${filterParam}=${encodeURIComponent(bucket.key)}`}
                className="group flex flex-col gap-1"
              >
                <span className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-mono group-hover:text-primary">
                    {bucket.key || "—"}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatNumber(bucket.count)}
                  </span>
                </span>
                <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn(
                      "block h-full rounded-full bg-primary/70 transition-all group-hover:bg-primary",
                    )}
                    style={{ width: `${facetWidth(bucket.count, max)}%` }}
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </QueryState>
    </CardContent>
  </Card>
);

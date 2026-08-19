import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import Button from "@/components/Button";
import { errorMessage } from "@/services/httpClient";
import { cn } from "@/lib/utils";

interface QueryStateProps {
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  isEmpty?: boolean;
  emptyLabel?: ReactNode;
  loadingLabel?: ReactNode;
  onRetry?: () => void;
  className?: string;
  children?: ReactNode;
}

/**
 * The inline error surface. Every query in the app renders through this rather
 * than throwing or silently showing nothing — a page must stay navigable with
 * the API down, and say why it is empty.
 */
export const QueryState = ({
  isLoading,
  isError,
  error,
  isEmpty,
  emptyLabel = "Nothing to show",
  loadingLabel = "Loading…",
  onRetry,
  className,
  children,
}: QueryStateProps) => {
  if (isLoading) {
    return (
      <div
        data-slot="query-state"
        className={cn(
          "flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="size-4 animate-spin" />
        {loadingLabel}
      </div>
    );
  }

  if (isError) {
    return (
      <div
        data-slot="query-state"
        className={cn(
          "flex flex-col items-start gap-2 rounded-lg border border-status-error/30 bg-status-error-soft/60 px-3 py-3",
          className,
        )}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-status-error">
          <AlertTriangle className="size-4" />
          {errorMessage(error)}
        </div>
        {onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div
        data-slot="query-state"
        className={cn(
          "flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground",
          className,
        )}
      >
        <Inbox className="size-4" />
        {emptyLabel}
      </div>
    );
  }

  return <>{children}</>;
};

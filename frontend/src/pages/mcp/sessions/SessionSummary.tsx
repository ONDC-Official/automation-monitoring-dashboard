import { StatusBadge } from "@/components/Badge";
import { QueryState } from "@/components/QueryState";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SESSION_SUMMARY_FIELDS } from "@/pages/mcp/sessions/constants";
import {
  formatBuild,
  sessionStateLabel,
  sessionTone,
} from "@/pages/mcp/sessions/utils";
import type { SessionRow } from "@/services/types";

interface ISessionSummaryProps {
  session: SessionRow | null;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}

/** The full `SessionRow`, as a definition list. */
export const SessionSummary = ({
  session,
  isLoading,
  isError,
  error,
  onRetry,
}: ISessionSummaryProps) => (
  <QueryState
    isLoading={isLoading}
    isError={isError}
    error={error}
    isEmpty={!session}
    emptyLabel="This session is no longer mirrored"
    loadingLabel="Loading session…"
    onRetry={onRetry}
  >
    {session ? (
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <dt className="text-xs text-muted-foreground">State</dt>
          <dd className="flex items-center gap-2">
            <StatusBadge tone={sessionTone(session.active)} size="sm">
              {sessionStateLabel(session.active)}
            </StatusBadge>
            <StatusBadge tone="info" size="sm">
              {session.mock_role}
            </StatusBadge>
            <span className="text-xs text-muted-foreground">
              {session.np_type}
            </span>
          </dd>
        </div>

        <div className="flex flex-col gap-1">
          <dt className="text-xs text-muted-foreground">Build</dt>
          <dd className="text-sm">
            {formatBuild(session.domain, session.version)}
            <span className="text-muted-foreground">
              {session.usecase ? ` · ${session.usecase}` : ""}
            </span>
          </dd>
        </div>

        {SESSION_SUMMARY_FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col gap-1">
            <dt className="text-xs text-muted-foreground">{field.label}</dt>
            <dd
              className={cn(
                "text-sm break-all",
                field.mono && "font-mono text-xs",
              )}
            >
              {session[field.key] ?? "—"}
            </dd>
          </div>
        ))}

        <div className="flex flex-col gap-1">
          <dt className="text-xs text-muted-foreground">Auto-advance</dt>
          <dd>
            <StatusBadge tone={session.auto_advance ? "ok" : "neutral"} size="sm">
              {session.auto_advance ? "on" : "off"}
            </StatusBadge>
          </dd>
        </div>

        <div className="flex flex-col gap-1">
          <dt className="text-xs text-muted-foreground">Runs</dt>
          <dd className="text-sm tabular-nums">{formatNumber(session.runs)}</dd>
        </div>

        <div className="flex flex-col gap-1">
          <dt className="text-xs text-muted-foreground">Created</dt>
          <dd className="text-sm">
            {formatDateTime(session.created_at)}
            <span className="text-muted-foreground">
              {` (${formatRelative(session.created_at)})`}
            </span>
          </dd>
        </div>

        <div className="flex flex-col gap-1">
          <dt className="text-xs text-muted-foreground">Expires</dt>
          <dd className="text-sm">
            {formatDateTime(session.expires_at)}
            <span className="text-muted-foreground">
              {` (${formatRelative(session.expires_at)})`}
            </span>
          </dd>
        </div>
      </dl>
    ) : null}
  </QueryState>
);

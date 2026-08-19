import { StatusBadge } from "@/components/Badge";
import { QueryState } from "@/components/QueryState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select";
import { truncateMiddle } from "@/lib/format";
import type { SessionRow } from "@/services/types";

interface ISessionPickerProps {
  sessions: SessionRow[];
  value: string | null;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  onSelect: (sessionRef: string) => void;
}

/** The one control that decides which session's wire this page is reading. */
export const SessionPicker = ({
  sessions,
  value,
  isLoading,
  isError,
  error,
  onRetry,
  onSelect,
}: ISessionPickerProps) => (
  <QueryState
    isLoading={isLoading}
    isError={isError}
    error={error}
    isEmpty={sessions.length === 0}
    emptyLabel="No mirrored sessions"
    loadingLabel="Loading sessions…"
    onRetry={onRetry}
    className="w-72 py-0"
  >
    <Select value={value ?? undefined} onValueChange={onSelect}>
      <SelectTrigger className="w-72" aria-label="Session">
        <SelectValue placeholder="Pick a session…" />
      </SelectTrigger>
      <SelectContent>
        {sessions.map((session) => (
          <SelectItem key={session.session_ref} value={session.session_ref}>
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs">
                {truncateMiddle(session.session_ref, 16)}
              </span>
              <span className="text-xs text-muted-foreground">
                {session.domain} {session.version}
              </span>
              <StatusBadge tone={session.active ? "ok" : "neutral"} size="sm">
                {session.active ? "active" : "expired"}
              </StatusBadge>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </QueryState>
);

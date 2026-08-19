import { StatusBadge } from "@/components/Badge";
import { CardDescription, CardTitle } from "@/components/Card";
import { formatRelative } from "@/lib/format";
import type { SessionRow } from "@/services/types";

interface ISessionSummaryProps {
  sessionRef: string;
  session: SessionRow | null;
}

/** Who this wire log belongs to — the header of the log card. */
export const SessionSummary = ({
  sessionRef,
  session,
}: ISessionSummaryProps) => (
  <>
    <CardTitle className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-xs">{sessionRef}</span>
      {session ? (
        <>
          <StatusBadge tone="outline" size="sm">
            {session.domain} {session.version}
          </StatusBadge>
          <StatusBadge tone="info" size="sm">
            {session.mock_role}
          </StatusBadge>
          <StatusBadge tone={session.active ? "ok" : "neutral"} size="sm">
            {session.active ? "active" : "expired"}
          </StatusBadge>
        </>
      ) : null}
    </CardTitle>
    <CardDescription>
      {session
        ? `${session.interaction_mode} · auto-advance ${
            session.auto_advance ? "on" : "off"
          } · ${session.runs} run(s) · expires ${formatRelative(
            session.expires_at,
          )}`
        : "Session metadata is not mirrored yet — the journal below is still authoritative."}
    </CardDescription>
  </>
);

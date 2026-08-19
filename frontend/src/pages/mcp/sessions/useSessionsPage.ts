import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { runKeys, useRuns } from "@/hooks/useMcp";
import {
  sessionKeys,
  useSession,
  useSessionRuns,
  useSessions,
} from "@/hooks/useMcp";
import {
  ACTIVE_SESSIONS_EMPTY_LABEL,
  DEFAULT_SESSION_TAB,
  EXPIRED_SESSIONS_EMPTY_LABEL,
  SESSIONS_EMPTY_LABEL,
  SESSION_TABS,
  type SessionTab,
} from "@/pages/mcp/sessions/constants";
import { sortSessions } from "@/pages/mcp/sessions/utils";
import type { SessionRow } from "@/services/types";
import { MCP_ROUTES } from "@/pages/mcp/constants";

/**
 * Everything the sessions page knows. `index.tsx` destructures this and renders
 * — it holds no state, no handlers and no derived data of its own.
 *
 * The drill-in is routed, not stateful: `/sessions/:sessionRef` renders this
 * same page with the sheet open, so a detail view is linkable and the browser's
 * back button closes it.
 */
export const useSessionsPage = () => {
  const [tab, setTab] = useState<SessionTab>(DEFAULT_SESSION_TAB);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { sessionRef: routeRef } = useParams<{ sessionRef?: string }>();

  const selectedRef = routeRef ?? null;

  const sessionsQuery = useSessions();
  const runsQuery = useRuns();
  const sessionQuery = useSession(selectedRef ?? undefined);
  const sessionRunsQuery = useSessionRuns(selectedRef ?? undefined);

  const sessions = useMemo(
    () => sortSessions(sessionsQuery.data?.items ?? []),
    [sessionsQuery.data],
  );

  const sessionsByTab = useMemo<Record<SessionTab, SessionRow[]>>(
    () => ({
      active: sessions.filter((session) => session.active),
      expired: sessions.filter((session) => !session.active),
    }),
    [sessions],
  );

  const summary = useMemo(
    () => ({
      total: sessionsQuery.data?.total ?? sessions.length,
      active: sessionsByTab.active.length,
      expired: sessionsByTab.expired.length,
      runs: runsQuery.data?.total ?? 0,
    }),
    [sessionsQuery.data, sessions, sessionsByTab, runsQuery.data],
  );

  const tabCounts = useMemo<Record<SessionTab, number>>(
    () => ({
      active: sessionsByTab.active.length,
      expired: sessionsByTab.expired.length,
    }),
    [sessionsByTab],
  );

  /**
   * "No active sessions" and "nothing has ever been mirrored" are different
   * facts, and only the second one means the pipe is not connected.
   */
  const emptyLabels = useMemo<Record<SessionTab, string>>(
    () =>
      sessions.length === 0
        ? { active: SESSIONS_EMPTY_LABEL, expired: SESSIONS_EMPTY_LABEL }
        : {
            active: ACTIVE_SESSIONS_EMPTY_LABEL,
            expired: EXPIRED_SESSIONS_EMPTY_LABEL,
          },
    [sessions],
  );

  const handleTabChange = useCallback((value: string) => {
    const match = SESSION_TABS.find((entry) => entry.value === value);
    if (match) setTab(match.value);
  }, []);

  const handleSelectSession = useCallback(
    (sessionRef: string) => {
      void navigate(`${MCP_ROUTES.sessions}/${encodeURIComponent(sessionRef)}`);
    },
    [navigate],
  );

  const handleDetailOpenChange = useCallback(
    (open: boolean) => {
      if (!open) void navigate(MCP_ROUTES.sessions);
    },
    [navigate],
  );

  /** Both key factories, so nothing on the page is left showing stale rows. */
  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    void queryClient.invalidateQueries({ queryKey: runKeys.all });
  }, [queryClient]);

  const handleRetrySessions = useCallback(() => {
    void sessionsQuery.refetch();
  }, [sessionsQuery]);

  const handleRetryRuns = useCallback(() => {
    void runsQuery.refetch();
  }, [runsQuery]);

  const handleRetryDetail = useCallback(() => {
    void sessionQuery.refetch();
  }, [sessionQuery]);

  const handleRetryDetailRuns = useCallback(() => {
    void sessionRunsQuery.refetch();
  }, [sessionRunsQuery]);

  return {
    tab,
    tabCounts,
    sessionsByTab,
    emptyLabels,
    summary,
    onTabChange: handleTabChange,
    onRefresh: handleRefresh,
    onSelectSession: handleSelectSession,

    list: {
      isLoading: sessionsQuery.isLoading,
      isError: sessionsQuery.isError,
      error: sessionsQuery.error,
      isFetching: sessionsQuery.isFetching,
      onRetry: handleRetrySessions,
    },

    runsTotal: {
      isLoading: runsQuery.isLoading,
      isError: runsQuery.isError,
      error: runsQuery.error,
      onRetry: handleRetryRuns,
    },

    detail: {
      sessionRef: selectedRef,
      isOpen: Boolean(selectedRef),
      onOpenChange: handleDetailOpenChange,
      session: sessionQuery.data ?? null,
      isLoading: sessionQuery.isLoading,
      isError: sessionQuery.isError,
      error: sessionQuery.error,
      onRetry: handleRetryDetail,
      runs: sessionRunsQuery.data?.items ?? [],
      runsIsLoading: sessionRunsQuery.isLoading,
      runsIsError: sessionRunsQuery.isError,
      runsError: sessionRunsQuery.error,
      onRetryRuns: handleRetryDetailRuns,
    },
  };
};

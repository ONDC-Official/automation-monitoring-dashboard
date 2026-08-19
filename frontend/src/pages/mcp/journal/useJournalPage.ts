import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useJournal } from "@/hooks/useMcp";
import { useSessions } from "@/hooks/useMcp";
import { ALL_KINDS, DEFAULT_LIMIT } from "@/pages/mcp/journal/constants";
import { MCP_ROUTES } from "@/pages/mcp/constants";
import {
  matchesTextFilter,
  parseAfterSeq,
  presentKinds,
  sortBySeq,
} from "@/pages/mcp/journal/utils";

/**
 * All state, derived data and handlers for the journal page. `index.tsx`
 * destructures this and renders — it holds nothing of its own.
 */
export const useJournalPage = () => {
  const { sessionRef: routeRef } = useParams<{ sessionRef?: string }>();
  const navigate = useNavigate();
  const sessionRef = routeRef ?? null;

  const [afterSeqText, setAfterSeqText] = useState("");
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [live, setLive] = useState(true);
  const [kind, setKind] = useState(ALL_KINDS);
  const [text, setText] = useState("");

  const afterSeq = parseAfterSeq(afterSeqText);

  const sessions = useSessions();
  const journal = useJournal({
    sessionRef: sessionRef ?? undefined,
    afterSeq,
    limit,
    live,
  });

  const items = useMemo(() => journal.data?.items ?? [], [journal.data]);
  const sortedRows = useMemo(() => sortBySeq(items), [items]);
  const kinds = useMemo(() => presentKinds(items), [items]);

  const rows = useMemo(
    () =>
      sortedRows.filter(
        (row) =>
          (kind === ALL_KINDS || row.kind === kind) &&
          matchesTextFilter(row, text),
      ),
    [sortedRows, kind, text],
  );

  const sessionOptions = useMemo(
    () => sessions.data?.items ?? [],
    [sessions.data],
  );

  const activeSession = useMemo(
    () =>
      sessionOptions.find((session) => session.session_ref === sessionRef) ??
      null,
    [sessionOptions, sessionRef],
  );

  const selectSession = useCallback(
    (nextRef: string) => navigate(`${MCP_ROUTES.journal}/${encodeURIComponent(nextRef)}`),
    [navigate],
  );

  const copyValue = useCallback(async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Could not copy the ${label.toLowerCase()}`);
    }
  }, []);

  /** The filter is client-side, so "cleared" must mean every filter at once. */
  const clearFilters = useCallback(() => {
    setKind(ALL_KINDS);
    setText("");
    setAfterSeqText("");
  }, []);

  return {
    sessionRef,
    activeSession,
    sessionOptions,
    sessionsQuery: sessions,
    journalQuery: journal,

    rows,
    kinds,
    totalReturned: items.length,
    total: journal.data?.total ?? 0,
    /** Whether a client-side filter is narrowing what the request returned. */
    isFiltered: kind !== ALL_KINDS || text.trim().length > 0,

    afterSeqText,
    setAfterSeqText,
    limit,
    setLimit,
    live,
    toggleLive: () => setLive((current) => !current),
    kind,
    setKind,
    text,
    setText,

    selectSession,
    clearFilters,
    copyValue,
    refresh: () => {
      void journal.refetch();
    },
    retrySessions: () => {
      void sessions.refetch();
    },
  };
};

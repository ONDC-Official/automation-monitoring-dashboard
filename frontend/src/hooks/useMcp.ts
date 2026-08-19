import { useQueryClient } from '@tanstack/react-query';
import { useGet } from '@/hooks/useGet';
import { usePost } from '@/hooks/usePost';
import { httpClient } from '@/services/httpClient';
import type {
    CommentBody,
    ConfigResponse,
    DismissBody,
    IncidentDetailResponse,
    IncidentListQuery,
    IncidentListResponse,
    JournalListQuery,
    JournalListResponse,
    LinkFixBody,
    RunListResponse,
    SessionListResponse,
    SessionRow,
    SetStatusBody,
    StatsResponse,
    TriageResult,
} from '@/services/types';

/**
 * The MCP section's data layer.
 *
 * Everything rides the app's own `httpClient`, so these inherit the bearer
 * interceptor — the corpus is protected by the same operator login as the rest
 * of the console — and the `ApiError` normalisation that `QueryState` renders.
 *
 * The `*Keys` factories are the cache-invalidation contract for the triage
 * mutations; keep them if you move anything.
 */

const BASE = '/api/mcp';

/** Strip `undefined` so an empty filter never reaches the query string. */
const clean = (params: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
    );

const get = <T,>(url: string, params?: Record<string, unknown>): Promise<T> =>
    httpClient
        .get<T>(url, params ? { params: clean(params) } : undefined)
        .then((r) => r.data);

/* -------------------------------------------------------------------------- */
/* Config — also the "is the MCP section switched on?" probe                    */
/* -------------------------------------------------------------------------- */

export const configKeys = { all: ['mcp', 'config'] as const };

/**
 * Answers 200 even when the section is off (`mcp_enabled: false`), which is
 * what lets the sidebar hide the group rather than render a broken one.
 */
export function useConfig() {
    return useGet<ConfigResponse>({
        queryKey: configKeys.all,
        queryFn: () => get<ConfigResponse>(`${BASE}/config`),
        staleTime: 5 * 60_000,
        retry: false,
    });
}

/* -------------------------------------------------------------------------- */
/* Corpus                                                                       */
/* -------------------------------------------------------------------------- */

export const statsKeys = { all: ['mcp', 'stats'] as const };

export function useStats() {
    return useGet<StatsResponse>({
        queryKey: statsKeys.all,
        queryFn: () => get<StatsResponse>(`${BASE}/stats`),
        refetchInterval: 30_000,
    });
}

export const incidentKeys = {
    all: ['mcp', 'incidents'] as const,
    list: (query: IncidentListQuery) => ['mcp', 'incidents', 'list', query] as const,
    detail: (fingerprint: string) =>
        ['mcp', 'incidents', 'detail', fingerprint] as const,
};

export function useIncidents(query: IncidentListQuery) {
    return useGet<IncidentListResponse>({
        queryKey: incidentKeys.list(query),
        queryFn: () =>
            get<IncidentListResponse>(
                `${BASE}/incidents`,
                query as Record<string, unknown>
            ),
    });
}

export function useIncidentDetail(fingerprint: string | undefined) {
    return useGet<IncidentDetailResponse>({
        queryKey: incidentKeys.detail(fingerprint ?? ''),
        queryFn: () =>
            get<IncidentDetailResponse>(`${BASE}/incidents/${fingerprint}`),
        enabled: Boolean(fingerprint),
    });
}

/* -------------------------------------------------------------------------- */
/* Mirrored engine state                                                        */
/* -------------------------------------------------------------------------- */

export const sessionKeys = {
    all: ['mcp', 'sessions'] as const,
    list: (limit: number, skip: number) =>
        ['mcp', 'sessions', 'list', limit, skip] as const,
    detail: (ref: string) => ['mcp', 'sessions', 'detail', ref] as const,
    runs: (ref: string) => ['mcp', 'sessions', 'runs', ref] as const,
};

export function useSessions(limit = 50, skip = 0) {
    return useGet<SessionListResponse>({
        queryKey: sessionKeys.list(limit, skip),
        queryFn: () => get<SessionListResponse>(`${BASE}/sessions`, { limit, skip }),
        refetchInterval: 30_000,
    });
}

export function useSession(ref: string | undefined) {
    return useGet<SessionRow>({
        queryKey: sessionKeys.detail(ref ?? ''),
        queryFn: () => get<SessionRow>(`${BASE}/sessions/${ref}`),
        enabled: Boolean(ref),
    });
}

export function useSessionRuns(ref: string | undefined) {
    return useGet<RunListResponse>({
        queryKey: sessionKeys.runs(ref ?? ''),
        queryFn: () => get<RunListResponse>(`${BASE}/sessions/${ref}/runs`),
        enabled: Boolean(ref),
    });
}

export const runKeys = {
    all: ['mcp', 'runs'] as const,
    list: (sessionRef?: string) => ['mcp', 'runs', 'list', sessionRef ?? null] as const,
};

export function useRuns(sessionRef?: string) {
    return useGet<RunListResponse>({
        queryKey: runKeys.list(sessionRef),
        queryFn: () => get<RunListResponse>(`${BASE}/runs`, { session_ref: sessionRef }),
        refetchInterval: 30_000,
    });
}

export const journalKeys = {
    all: ['mcp', 'journal'] as const,
    list: (ref: string, query: JournalListQuery) =>
        ['mcp', 'journal', ref, query] as const,
};

export function useJournal({
    sessionRef,
    afterSeq,
    limit,
    live = false,
}: {
    sessionRef: string | undefined;
    afterSeq: number;
    limit: number;
    /** Poll while the run is still moving. */
    live?: boolean;
}) {
    const query: JournalListQuery = { after_seq: afterSeq, limit };
    return useGet<JournalListResponse>({
        queryKey: journalKeys.list(sessionRef ?? '', query),
        queryFn: () =>
            get<JournalListResponse>(
                `${BASE}/sessions/${sessionRef}/journal`,
                query as unknown as Record<string, unknown>
            ),
        enabled: Boolean(sessionRef),
        refetchInterval: live ? 10_000 : false,
    });
}

/* -------------------------------------------------------------------------- */
/* Triage — the only writes in this section                                     */
/* -------------------------------------------------------------------------- */

/**
 * Every triage action can change the row, the detail and the rollups, so all
 * three are invalidated together. Cheaper than reasoning about which action
 * moved which counter, and wrong far less often.
 */
function useTriageInvalidation(fingerprint: string) {
    const client = useQueryClient();
    return () => {
        void client.invalidateQueries({ queryKey: incidentKeys.detail(fingerprint) });
        void client.invalidateQueries({ queryKey: incidentKeys.all });
        void client.invalidateQueries({ queryKey: statsKeys.all });
    };
}

const triageAction = <TBody,>(fingerprint: string, action: string) =>
    (body: TBody): Promise<TriageResult> =>
        httpClient
            .post<TriageResult>(
                `${BASE}/incidents/${fingerprint}/${action}`,
                body
            )
            .then((r) => r.data);

export function useSetIncidentStatus(fingerprint: string) {
    const invalidate = useTriageInvalidation(fingerprint);
    return usePost<TriageResult, SetStatusBody>({
        mutationFn: triageAction<SetStatusBody>(fingerprint, 'status'),
        onSuccess: invalidate,
    });
}

export function useCommentIncident(fingerprint: string) {
    const invalidate = useTriageInvalidation(fingerprint);
    return usePost<TriageResult, CommentBody>({
        mutationFn: triageAction<CommentBody>(fingerprint, 'comment'),
        onSuccess: invalidate,
    });
}

export function useLinkIncidentFix(fingerprint: string) {
    const invalidate = useTriageInvalidation(fingerprint);
    return usePost<TriageResult, LinkFixBody>({
        mutationFn: triageAction<LinkFixBody>(fingerprint, 'link'),
        onSuccess: invalidate,
    });
}

export function useDismissIncident(fingerprint: string) {
    const invalidate = useTriageInvalidation(fingerprint);
    return usePost<TriageResult, DismissBody>({
        mutationFn: triageAction<DismissBody>(fingerprint, 'dismiss'),
        onSuccess: invalidate,
    });
}

/**
 * Alias kept for the sidebar, which asks a different question of the same
 * endpoint: not "what is configured?" but "should this nav group exist?".
 */
export { useConfig as useMcpConfig };

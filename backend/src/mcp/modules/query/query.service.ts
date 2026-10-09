import type { Sort } from "mongodb";
import { NotFoundError } from "@/lib/errors.js";
import type {
  CorpusRepositoryPort,
  IncidentFilter,
} from "@/mcp/modules/corpus/corpus.repository.js";
import type {
  IncidentDoc,
  JournalDoc,
  RunDoc,
  SessionDoc,
} from "@/mcp/modules/corpus/corpus.schema.js";
import { renderSummary } from "@/mcp/modules/incident/incident.body.js";
import type {
  IncidentDetailResponse,
  IncidentListQuery,
  IncidentListResponse,
  IncidentRow,
  JournalRow,
  RunRow,
  SessionRow,
  StatsResponse,
} from "@/mcp/modules/query/query.schema.js";

/**
 * The read side.
 *
 * Nothing here writes, and nothing here dials out. Its whole job is
 * turning corpus documents into the flat rows `query.schema.ts` promises —
 * which is a real job, because two consumers with different constraints share
 * that contract and the flattening is where a nested field would quietly break
 * Grafana's table view.
 *
 * `undefined` becomes `null` on the way out, deliberately. `JSON.stringify`
 * drops an `undefined` property entirely, so a column would vanish from some
 * rows and not others and Infinity would infer a ragged table.
 */

export interface QueryServiceOptions {
  repository: CorpusRepositoryPort;
}

const SORTS: Record<IncidentListQuery["sort"], Sort> = {
  last_seen: { last_seen_at: -1 },
  first_seen: { first_seen_at: -1 },
  occurrences: { occurrences_total: -1 },
  runs: { distinct_runs: -1 },
};

export class QueryService {
  readonly #repository: CorpusRepositoryPort;

  constructor(options: QueryServiceOptions) {
    this.#repository = options.repository;
  }

  /* ------------------------------------------------------------- incidents */

  async listIncidents(
    query: IncidentListQuery,
  ): Promise<IncidentListResponse> {
    const filter = toFilter(query);
    const [docs, total] = await Promise.all([
      this.#repository.listIncidents(
        filter,
        SORTS[query.sort],
        query.limit,
        query.skip,
      ),
      this.#repository.countIncidents(filter),
    ]);

    return {
      items: docs.map(toIncidentRow),
      total,
      limit: query.limit,
      skip: query.skip,
    };
  }

  async getIncident(fingerprint: string): Promise<IncidentDetailResponse> {
    const incident = await this.#repository.findIncident(fingerprint);
    if (incident === undefined) {
      throw new NotFoundError(`no incident with fingerprint ${fingerprint}`);
    }

    const latest = await this.#repository.latestReportFor(fingerprint);
    const recent = await this.#repository.listReports(
      { fingerprint },
      10,
      0,
    );

    // A paste-ready write-up of the incident, rendered on read. Nothing files
    // it anywhere; it is the human view of what the corpus knows, and the
    // format is winx-parseable so pasting it into an issue by hand still works.
    const rendered = renderSummary(incident, latest?.report);

    return {
      incident: toIncidentRow(incident),
      state_counts: incident.state_counts,
      install_ids: incident.install_ids,
      mock_roles: incident.mock_roles,
      suspected_causes: incident.suspected_causes,
      latest_report: latest?.report ?? null,
      rendered_summary: {
        title: rendered.title,
        body: rendered.body,
        labels: rendered.labels,
      },
      triage_notes: incident.triage.notes ?? [],
      recent_reports: recent.map((doc) => ({
        report_doc_id: doc._id,
        install_id: doc.install_id,
        generated_at: doc.generated_at,
        state: doc.state,
        occurrences: doc.occurrences,
        narrated: doc.narrated,
        session_id: doc.session_id ?? null,
        transaction_id: doc.transaction_id ?? null,
      })),
    };
  }

  async getReport(docId: string): Promise<unknown> {
    const doc = await this.#repository.findReport(docId);
    if (doc === undefined) {
      throw new NotFoundError(`no report ${docId}`);
    }
    return doc.report;
  }

  /* ----------------------------------------------------------------- stats */

  async stats(): Promise<StatsResponse> {
    const facets = await this.#repository.facets();

    const stateOf = (key: string): number =>
      facets.latest_state.find((bucket) => bucket.value === key)?.count ?? 0;

    const incidentsTotal = facets.latest_state.reduce(
      (sum, bucket) => sum + bucket.count,
      0,
    );
    const untracked =
      facets.triage_status.find((bucket) => bucket.value === "untracked")
        ?.count ?? 0;

    const [reportsTotal, installs] = await Promise.all([
      this.#repository.countReports(),
      this.#repository.countInstalls(),
    ]);

    return {
      incidents_total: incidentsTotal,
      incidents_open: stateOf("OPEN"),
      incidents_untracked: untracked,
      reports_total: reportsTotal,
      installs,
      by_trigger: toBuckets(facets.trigger),
      by_state: toBuckets(facets.latest_state),
      by_domain: toBuckets(facets.domain),
      by_status: toBuckets(facets.triage_status),
      top_flows: facets.top_flows.map((flow) => ({
        flow_id: flow.flow_id,
        domain: flow.domain,
        occurrences: flow.occurrences_total,
        incidents: flow.incidents,
      })),
      // The two recoveries are kept apart here for the same reason the engine
      // keeps them apart in the corpus: one says the model was wrong and then
      // was not, the other says a *published* config is broken. Summing them
      // would hide the only number that is actionable outside these repos.
      recovery: {
        recovered: stateOf("RECOVERED"),
        recovered_with_override: stateOf("RECOVERED_WITH_OVERRIDE"),
        abandoned: stateOf("ABANDONED"),
        open: stateOf("OPEN"),
        unresolved: stateOf("UNRESOLVED"),
      },
    };
  }

  /* --------------------------------------------------------- mirrored state */

  async listSessions(
    limit: number,
    skip: number,
  ): Promise<{ items: SessionRow[]; total: number }> {
    const docs = await this.#repository.listSessions({}, limit, skip);
    const rows = await Promise.all(
      docs.map(async (doc) => {
        const runs = await this.#repository.listRuns(
          { session_ref: doc.session_ref },
          200,
          0,
        );
        return toSessionRow(doc, runs.length);
      }),
    );
    return { items: rows, total: rows.length };
  }

  async getSession(sessionRef: string): Promise<SessionRow> {
    const docs = await this.#repository.listSessions(
      { session_ref: sessionRef },
      1,
      0,
    );
    const doc = docs[0];
    if (doc === undefined) {
      throw new NotFoundError(`no session ${sessionRef}`);
    }
    const runs = await this.#repository.listRuns({ session_ref: sessionRef }, 200, 0);
    return toSessionRow(doc, runs.length);
  }

  async listRuns(
    sessionRef: string | undefined,
    limit: number,
    skip: number,
  ): Promise<{ items: RunRow[]; total: number }> {
    const docs = await this.#repository.listRuns(
      sessionRef !== undefined ? { session_ref: sessionRef } : {},
      limit,
      skip,
    );
    return { items: docs.map(toRunRow), total: docs.length };
  }

  async listJournal(
    sessionRef: string,
    afterSeq: number,
    limit: number,
  ): Promise<{ items: JournalRow[]; total: number }> {
    const docs = await this.#repository.listJournal(sessionRef, afterSeq, limit);
    return { items: docs.map(toJournalRow), total: docs.length };
  }
}

/* -------------------------------------------------------------------------- */
/* Mapping — pure, exported so it can be tested without a database             */
/* -------------------------------------------------------------------------- */

export function toFilter(query: IncidentListQuery): IncidentFilter {
  return {
    ...(query.domain !== undefined ? { domain: query.domain } : {}),
    ...(query.version !== undefined ? { version: query.version } : {}),
    ...(query.flow_id !== undefined ? { flow_id: query.flow_id } : {}),
    ...(query.trigger !== undefined ? { trigger: query.trigger } : {}),
    ...(query.state !== undefined ? { state: query.state } : {}),
    ...(query.status !== undefined
      ? { status: query.status as IncidentFilter["status"] }
      : {}),
    ...(query.suppressed !== undefined ? { suppressed: query.suppressed } : {}),
    ...(query.narrated !== undefined ? { narrated: query.narrated } : {}),
    ...(query.since !== undefined ? { since: query.since } : {}),
    ...(query.search !== undefined ? { search: query.search } : {}),
  };
}

export function toIncidentRow(doc: IncidentDoc): IncidentRow {
  return {
    fingerprint: doc._id,
    domain: doc.domain,
    version: doc.version,
    usecase: doc.usecase ?? null,
    flow_id: doc.flow_id,
    trigger: doc.trigger,
    code: doc.code,
    step_key: doc.step_key ?? null,
    action: doc.action ?? null,
    occurrences_total: doc.occurrences_total,
    distinct_runs: doc.distinct_runs,
    installs: doc.install_ids.length,
    first_seen_at: doc.first_seen_at,
    last_seen_at: doc.last_seen_at,
    latest_state: doc.latest_state,
    narrated: doc.narrated,
    suppressed: doc.suppressed,
    triage_status: doc.triage.status,
    triage_assignees: doc.triage.assignees,
    // `?? []` is load-bearing, not defensive: every incident written before
    // `triage.notes[]` existed has no such key, whatever the type says.
    triage_notes: (doc.triage.notes ?? []).length,
  };
}

export function toSessionRow(doc: SessionDoc, runs: number): SessionRow {
  return {
    session_ref: doc.session_ref,
    session_id: doc.session_id ?? null,
    install_id: doc.install_id,
    instance_id: doc.instance_id,
    domain: doc.domain,
    version: doc.version,
    usecase: doc.usecase ?? null,
    mock_role: doc.mock_role,
    np_type: doc.np_type,
    subscriber_ref: doc.subscriber_ref,
    callback_url: doc.callback_url,
    interaction_mode: doc.interaction_mode,
    auto_advance: doc.auto_advance,
    created_at: doc.created_at,
    expires_at: doc.expires_at,
    // Derived, because the engine cannot tell us: `CacheStore` TTL expiry is
    // silent by design and neither implementation has an eviction callback.
    active: Date.parse(doc.expires_at) > Date.now(),
    runs,
  };
}

export function toRunRow(doc: RunDoc): RunRow {
  return {
    session_ref: doc.session_ref,
    session_id: doc.session_id ?? null,
    flow_id: doc.flow_id,
    attempt: doc.attempt,
    transaction_id: doc.transaction_id ?? null,
    status: doc.status,
    step_count: doc.step_count ?? null,
    started_at: doc.started_at,
    updated_at: doc.updated_at,
  };
}

export function toJournalRow(doc: JournalDoc): JournalRow {
  return {
    session_ref: doc.session_ref,
    seq: doc.seq,
    at: doc.at,
    kind: doc.kind,
    flow_id: doc.flow_id ?? null,
    transaction_id: doc.transaction_id ?? null,
    action: doc.action ?? null,
    ack: doc.ack ?? null,
    nack_code: doc.nack_code ?? null,
    payload_id: doc.payload_id ?? null,
    overrides: doc.overrides ?? [],
    summary: doc.summary,
  };
}

function toBuckets(
  buckets: readonly { value: string; count: number }[],
): { key: string; count: number }[] {
  return buckets.map((bucket) => ({ key: bucket.value, count: bucket.count }));
}

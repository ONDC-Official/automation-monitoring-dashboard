import type { Sort } from "mongodb";
import type {
  CorpusFacets,
  CorpusRepositoryPort,
  IncidentFilter,
  ReportFilter,
  RunFilter,
  RunKey,
  RunStatusPatch,
  SessionFilter,
} from "@/mcp/modules/corpus/corpus.repository.js";
import type {
  IncidentDoc,
  JournalDoc,
  ReportDoc,
  RunDoc,
  SessionDoc,
  TriageNote,
} from "@/mcp/modules/corpus/corpus.schema.js";

/** Mirrors `MAX_TRIAGE_NOTES` in the repository. */
const MAX_TRIAGE_NOTES = 200;

/**
 * An in-memory `CorpusRepositoryPort`, for testing the ingest without Mongo.
 *
 * Written by hand rather than mocked, because the two behaviours the ingest's
 * rules depend on are behaviours, not call counts: an insert that collapses on
 * a duplicate `_id`, and a recompute that derives `occurrences_total` from the
 * **peak per run** rather than a sum of deliveries. A `vi.fn()` returning a
 * fixed value would pass whether or not the service ever recomputed anything.
 *
 * The rollup below is deliberately the same *rule* as the Mongo aggregation,
 * expressed the obvious way. If the two ever disagree, the readable one is
 * right and the pipeline has drifted.
 */
export class FakeCorpusRepository implements CorpusRepositoryPort {
  readonly reports = new Map<string, ReportDoc>();
  readonly incidents = new Map<string, IncidentDoc>();
  readonly sessions = new Map<string, SessionDoc>();
  readonly runs = new Map<string, RunDoc>();
  readonly journal = new Map<string, JournalDoc>();

  /** Every fingerprint `recomputeIncident` was asked for, in order. */
  readonly recomputes: string[] = [];

  /* -------------------------------- reports ------------------------------- */

  insertReport(doc: ReportDoc): Promise<boolean> {
    if (this.reports.has(doc._id)) return Promise.resolve(false);
    this.reports.set(doc._id, doc);
    return Promise.resolve(true);
  }

  recomputeIncident(fingerprint: string): Promise<IncidentDoc | undefined> {
    this.recomputes.push(fingerprint);

    const rows = [...this.reports.values()].filter(
      (row) => row.fingerprint === fingerprint,
    );
    if (rows.length === 0) return Promise.resolve(undefined);

    const peaks = new Map<string, number>();
    for (const row of rows) {
      const key = `${row.install_id}:${row.report_id}`;
      peaks.set(key, Math.max(peaks.get(key) ?? 0, row.occurrences));
    }

    const sorted = [...rows].sort((a, b) =>
      a.generated_at === b.generated_at
        ? a.received_at.localeCompare(b.received_at)
        : a.generated_at.localeCompare(b.generated_at),
    );
    const latest = sorted[sorted.length - 1];
    const oldest = sorted[0];
    if (latest === undefined || oldest === undefined) {
      return Promise.resolve(undefined);
    }

    const stateCounts: Record<string, number> = {};
    for (const row of rows) {
      stateCounts[row.state] = (stateCounts[row.state] ?? 0) + 1;
    }

    const existing = this.incidents.get(fingerprint);
    const doc: IncidentDoc = {
      _id: fingerprint,
      domain: latest.domain,
      version: latest.version,
      usecase: latest.usecase,
      flow_id: latest.flow_id,
      trigger: latest.trigger,
      code: latest.code,
      step_key: latest.step_key,
      action: latest.action,

      occurrences_total: [...peaks.values()].reduce((sum, n) => sum + n, 0),
      deliveries: rows.length,
      distinct_runs: peaks.size,
      install_ids: unique(rows.map((row) => row.install_id)),
      mock_roles: unique(rows.map((row) => row.mock_role)),
      first_seen_at: oldest.generated_at,
      last_seen_at: latest.generated_at,
      latest_state: latest.state,
      state_counts: stateCounts,
      narrated: rows.some((row) => row.narrated),
      suspected_causes: unique(
        rows
          .map((row) => row.suspected_cause)
          .filter((cause): cause is string => cause !== undefined),
      ),
      latest_report_doc_id: latest._id,

      // The `$setOnInsert` half: a recompute must never touch triage state.
      // `notes` above all — it is append-only, so a recompute that reset it
      // would erase an operator's timeline on the next report delivery.
      suppressed: existing?.suppressed ?? false,
      triage: existing?.triage ?? {
        status: "untracked",
        assignees: [],
        resolution: undefined,
        notes: [],
        updated_at: undefined,
      },
    };

    this.incidents.set(fingerprint, doc);
    return Promise.resolve(doc);
  }

  findReport(docId: string): Promise<ReportDoc | undefined> {
    return Promise.resolve(this.reports.get(docId));
  }

  latestReportFor(fingerprint: string): Promise<ReportDoc | undefined> {
    const rows = [...this.reports.values()]
      .filter((row) => row.fingerprint === fingerprint)
      .sort((a, b) => b.generated_at.localeCompare(a.generated_at));
    return Promise.resolve(rows[0]);
  }

  listReports(
    filter: ReportFilter,
    limit: number,
    skip: number,
  ): Promise<ReportDoc[]> {
    const rows = [...this.reports.values()].filter(
      (row) =>
        (filter.fingerprint === undefined ||
          row.fingerprint === filter.fingerprint) &&
        (filter.install_id === undefined ||
          row.install_id === filter.install_id) &&
        (filter.session_id === undefined ||
          row.session_id === filter.session_id) &&
        (filter.since === undefined || row.generated_at >= filter.since),
    );
    return Promise.resolve(rows.slice(skip, skip + limit));
  }

  countReports(filter: ReportFilter = {}): Promise<number> {
    return this.listReports(filter, Number.MAX_SAFE_INTEGER, 0).then(
      (rows) => rows.length,
    );
  }

  countInstalls(): Promise<number> {
    return Promise.resolve(
      new Set([...this.reports.values()].map((row) => row.install_id)).size,
    );
  }

  /* ------------------------------ incidents ------------------------------- */

  findIncident(fingerprint: string): Promise<IncidentDoc | undefined> {
    return Promise.resolve(this.incidents.get(fingerprint));
  }

  listIncidents(
    filter: IncidentFilter,
    _sort: Sort,
    limit: number,
    skip: number,
  ): Promise<IncidentDoc[]> {
    const rows = [...this.incidents.values()].filter(
      (row) =>
        (filter.domain === undefined || row.domain === filter.domain) &&
        (filter.flow_id === undefined || row.flow_id === filter.flow_id) &&
        (filter.trigger === undefined || row.trigger === filter.trigger) &&
        (filter.state === undefined || row.latest_state === filter.state) &&
        (filter.suppressed === undefined ||
          row.suppressed === filter.suppressed),
    );
    return Promise.resolve(rows.slice(skip, skip + limit));
  }

  countIncidents(filter: IncidentFilter): Promise<number> {
    return this.listIncidents(filter, {}, Number.MAX_SAFE_INTEGER, 0).then(
      (rows) => rows.length,
    );
  }

  setSuppressed(fingerprint: string, suppressed: boolean): Promise<void> {
    const doc = this.incidents.get(fingerprint);
    if (doc !== undefined)
      this.incidents.set(fingerprint, { ...doc, suppressed });
    return Promise.resolve();
  }

  /** Same cap as the Mongo `$slice`; the two must not disagree. */
  appendTriageNote(fingerprint: string, note: TriageNote): Promise<void> {
    const doc = this.incidents.get(fingerprint);
    if (doc !== undefined) {
      const notes = [...(doc.triage.notes ?? []), note].slice(
        -MAX_TRIAGE_NOTES,
      );
      this.incidents.set(fingerprint, {
        ...doc,
        triage: { ...doc.triage, notes, updated_at: note.at },
      });
    }
    return Promise.resolve();
  }

  setTriage(
    fingerprint: string,
    partial: Partial<IncidentDoc["triage"]>,
  ): Promise<void> {
    const doc = this.incidents.get(fingerprint);
    if (doc !== undefined) {
      this.incidents.set(fingerprint, {
        ...doc,
        triage: { ...doc.triage, ...partial },
      });
    }
    return Promise.resolve();
  }

  facets(): Promise<CorpusFacets> {
    return Promise.resolve({
      trigger: [],
      latest_state: [],
      domain: [],
      triage_status: [],
      top_flows: [],
    });
  }

  /* -------------------------- mirrored live state ------------------------- */

  upsertSession(doc: SessionDoc): Promise<void> {
    this.sessions.set(doc._id, doc);
    return Promise.resolve();
  }

  upsertRun(doc: RunDoc): Promise<void> {
    const existing = this.runs.get(doc._id);
    // Mirrors `$setOnInsert: { status }` — a replayed RUN_STARTED must not
    // walk a finished run back to `started`.
    this.runs.set(doc._id, {
      ...doc,
      ...(existing !== undefined ? { status: existing.status } : {}),
    });
    return Promise.resolve();
  }

  setRunStatus(key: RunKey, patch: RunStatusPatch): Promise<boolean> {
    const candidates = [...this.runs.values()]
      .filter(
        (run) =>
          run.install_id === key.install_id &&
          run.session_ref === key.session_ref &&
          run.flow_id === key.flow_id,
      )
      .sort((a, b) => b.attempt - a.attempt);
    const target = candidates[0];
    if (target === undefined) return Promise.resolve(false);

    this.runs.set(target._id, {
      ...target,
      status: patch.status,
      updated_at: patch.updated_at,
      ...(patch.transaction_id !== undefined
        ? { transaction_id: patch.transaction_id }
        : {}),
    });
    return Promise.resolve(true);
  }

  insertJournal(docs: JournalDoc[]): Promise<number> {
    let inserted = 0;
    for (const doc of docs) {
      if (this.journal.has(doc._id)) continue;
      this.journal.set(doc._id, doc);
      inserted += 1;
    }
    return Promise.resolve(inserted);
  }

  listSessions(
    filter: SessionFilter,
    limit: number,
    skip: number,
  ): Promise<SessionDoc[]> {
    const rows = [...this.sessions.values()].filter(
      (row) =>
        (filter.install_id === undefined ||
          row.install_id === filter.install_id) &&
        (filter.session_ref === undefined ||
          row.session_ref === filter.session_ref),
    );
    return Promise.resolve(rows.slice(skip, skip + limit));
  }

  findSession(docId: string): Promise<SessionDoc | undefined> {
    return Promise.resolve(this.sessions.get(docId));
  }

  listRuns(filter: RunFilter, limit: number, skip: number): Promise<RunDoc[]> {
    const rows = [...this.runs.values()].filter(
      (row) =>
        (filter.install_id === undefined ||
          row.install_id === filter.install_id) &&
        (filter.session_ref === undefined ||
          row.session_ref === filter.session_ref) &&
        (filter.flow_id === undefined || row.flow_id === filter.flow_id) &&
        (filter.status === undefined || row.status === filter.status),
    );
    return Promise.resolve(rows.slice(skip, skip + limit));
  }

  listJournal(
    sessionRef: string,
    afterSeq: number,
    limit: number,
  ): Promise<JournalDoc[]> {
    const rows = [...this.journal.values()]
      .filter((row) => row.session_ref === sessionRef && row.seq > afterSeq)
      .sort((a, b) => a.seq - b.seq);
    return Promise.resolve(rows.slice(0, limit));
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

import type { Collection, Db, Filter, Sort, UpdateFilter } from "mongodb";
import {
  COLLECTIONS,
  type IncidentDoc,
  type JournalDoc,
  type ReportDoc,
  type RunDoc,
  type SessionDoc,
  type TriageNote,
  type TriageStatus,
} from "@/mcp/modules/corpus/corpus.schema.js";

/**
 * All Mongo access for the corpus, in one file.
 *
 * Data access only — no rules. Whether a report *should* be accepted, what a
 * run's status becomes: none of that lives here. What does live here is the one
 * piece of logic Mongo makes easy to get subtly wrong, the incident rollup, and
 * it is documented at length below because it is the thing a future change is
 * most likely to "simplify" back into a bug.
 */

/**
 * How many triage notes one incident keeps. See `appendTriageNote`.
 *
 * Generous — an incident an operator has written 200 notes on has a problem no
 * cap will fix — but finite, because the array rides every `recomputeIncident`.
 */
const MAX_TRIAGE_NOTES = 200;

/* -------------------------------------------------------------------------- */
/* The port                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Every field is spelled `?: T | undefined`, not `?: T`.
 *
 * `exactOptionalPropertyTypes` is on, and these bags are built from parsed
 * query strings where "absent" arrives *as* `undefined`. Without the explicit
 * union every caller has to launder its own optionals through the
 * `...(x !== undefined ? { x } : {})` idiom before it can even name this type —
 * which is the idiom's right use when *storing* a document and pure friction
 * when describing a filter. `buildIncidentQuery` drops undefined regardless, so
 * the two spellings produce identical queries.
 */
export interface IncidentFilter {
  domain?: string | undefined;
  version?: string | undefined;
  flow_id?: string | undefined;
  trigger?: string | undefined;
  /** Matches `latest_state` — the state of the newest delivery, not of any. */
  state?: string | undefined;
  status?: TriageStatus | undefined;
  suppressed?: boolean | undefined;
  narrated?: boolean | undefined;
  /** ISO 8601. Incidents last seen at or after this instant. */
  since?: string | undefined;
  /** Substring, case-insensitive, over the human-readable identity fields. */
  search?: string | undefined;
}

export interface ReportFilter {
  fingerprint?: string | undefined;
  install_id?: string | undefined;
  session_id?: string | undefined;
  since?: string | undefined;
}

export interface SessionFilter {
  install_id?: string | undefined;
  session_ref?: string | undefined;
}

export interface RunFilter {
  install_id?: string | undefined;
  session_ref?: string | undefined;
  flow_id?: string | undefined;
  status?: string | undefined;
}

export interface FacetBucket {
  value: string;
  count: number;
}

export interface FlowBucket {
  domain: string;
  version: string;
  flow_id: string;
  occurrences_total: number;
  incidents: number;
}

export interface CorpusFacets {
  trigger: FacetBucket[];
  latest_state: FacetBucket[];
  domain: FacetBucket[];
  triage_status: FacetBucket[];
  top_flows: FlowBucket[];
}

/** The key of a run, as a journal line can name it: never by attempt. */
export interface RunKey {
  install_id: string;
  session_ref: string;
  flow_id: string;
}

export interface RunStatusPatch {
  status: string;
  updated_at: string;
  transaction_id?: string;
}

/**
 * The repository's public surface, extracted so a test can implement it.
 *
 * Not an abstraction for its own sake: the ingest service's rules — idempotent
 * redelivery, recompute-always, run-status derivation — are exactly the things
 * worth testing without a database, and a fake is the only way to assert
 * "recompute was called even though the insert was a duplicate".
 */
export interface CorpusRepositoryPort {
  insertReport(doc: ReportDoc): Promise<boolean>;
  recomputeIncident(fingerprint: string): Promise<IncidentDoc | undefined>;

  findIncident(fingerprint: string): Promise<IncidentDoc | undefined>;
  listIncidents(
    filter: IncidentFilter,
    sort: Sort,
    limit: number,
    skip: number,
  ): Promise<IncidentDoc[]>;
  countIncidents(filter: IncidentFilter): Promise<number>;

  findReport(docId: string): Promise<ReportDoc | undefined>;
  latestReportFor(fingerprint: string): Promise<ReportDoc | undefined>;
  listReports(
    filter: ReportFilter,
    limit: number,
    skip: number,
  ): Promise<ReportDoc[]>;
  countReports(filter?: ReportFilter): Promise<number>;
  /** How many distinct installs have ever reported. The corpus's reach. */
  countInstalls(): Promise<number>;

  setSuppressed(fingerprint: string, suppressed: boolean): Promise<void>;
  setTriage(
    fingerprint: string,
    partial: Partial<IncidentDoc["triage"]>,
  ): Promise<void>;
  appendTriageNote(fingerprint: string, note: TriageNote): Promise<void>;

  facets(): Promise<CorpusFacets>;

  upsertSession(doc: SessionDoc): Promise<void>;
  upsertRun(doc: RunDoc): Promise<void>;
  setRunStatus(key: RunKey, patch: RunStatusPatch): Promise<boolean>;
  insertJournal(docs: JournalDoc[]): Promise<number>;

  listSessions(
    filter: SessionFilter,
    limit: number,
    skip: number,
  ): Promise<SessionDoc[]>;
  findSession(docId: string): Promise<SessionDoc | undefined>;
  listRuns(filter: RunFilter, limit: number, skip: number): Promise<RunDoc[]>;
  listJournal(
    sessionRef: string,
    afterSeq: number,
    limit: number,
  ): Promise<JournalDoc[]>;
}

/* -------------------------------------------------------------------------- */
/* Query building — the only place a filter can be silently wrong              */
/* -------------------------------------------------------------------------- */

/**
 * Regex-escape, because `search` is user text arriving from a query string.
 *
 * Unescaped it is not merely wrong, it is a denial of service: `(a+)+$` against
 * a collection scan is a catastrophic backtrack running inside the server
 * process, on a route with no per-query timeout.
 */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * `IncidentFilter` → a Mongo filter document.
 *
 * Pure, exported and tested on its own. Every other query in this file is a
 * literal a reader can check by eye; this one is assembled from optional parts,
 * so a dropped clause silently *widens* the result set rather than failing —
 * a suppressed incident reappearing in the triage queue, or a "domain=TRV11"
 * view quietly showing everything. That failure mode is invisible in a UI, and
 * it is why the function exists separately from the call site.
 *
 * Note the fields that are deliberately not symmetric with their document
 * shape: `state` matches `latest_state` (the newest delivery decides, so an
 * incident that recovered stops showing as open) and `search` spans the
 * identity fields a human actually remembers, never the stored report body.
 */
export function buildIncidentQuery(
  filter: IncidentFilter,
): Filter<IncidentDoc> {
  const query: Filter<IncidentDoc> = {
    ...(filter.domain !== undefined ? { domain: filter.domain } : {}),
    ...(filter.version !== undefined ? { version: filter.version } : {}),
    ...(filter.flow_id !== undefined ? { flow_id: filter.flow_id } : {}),
    ...(filter.trigger !== undefined ? { trigger: filter.trigger } : {}),
    ...(filter.state !== undefined ? { latest_state: filter.state } : {}),
    ...(filter.status !== undefined ? { "triage.status": filter.status } : {}),
    ...(filter.suppressed !== undefined
      ? { suppressed: filter.suppressed }
      : {}),
    ...(filter.narrated !== undefined ? { narrated: filter.narrated } : {}),
    ...(filter.since !== undefined
      ? { last_seen_at: { $gte: filter.since } }
      : {}),
  };

  if (filter.search !== undefined && filter.search.trim().length > 0) {
    const pattern = escapeRegex(filter.search.trim());
    query.$or = [
      { code: { $regex: pattern, $options: "i" } },
      { flow_id: { $regex: pattern, $options: "i" } },
      { step_key: { $regex: pattern, $options: "i" } },
      { action: { $regex: pattern, $options: "i" } },
      { trigger: { $regex: pattern, $options: "i" } },
    ];
  }

  return query;
}

export function buildReportQuery(filter: ReportFilter): Filter<ReportDoc> {
  return {
    ...(filter.fingerprint !== undefined
      ? { fingerprint: filter.fingerprint }
      : {}),
    ...(filter.install_id !== undefined
      ? { install_id: filter.install_id }
      : {}),
    ...(filter.session_id !== undefined
      ? { session_id: filter.session_id }
      : {}),
    ...(filter.since !== undefined
      ? { generated_at: { $gte: filter.since } }
      : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* Rollup shapes                                                               */
/* -------------------------------------------------------------------------- */

interface RunsFacet {
  occurrences_total: number;
  distinct_runs: number;
}

interface OverallFacet {
  deliveries: number;
  install_ids: string[];
  mock_roles: string[];
  suspected_causes: (string | null)[];
  first_seen_at: string;
  last_seen_at: string;
  narrated: number;
}

interface StateFacet {
  _id: string;
  count: number;
}

interface LatestFacet {
  _id: string;
  state: string;
  domain: string;
  version: string;
  usecase?: string;
  flow_id: string;
  trigger: string;
  code: string;
  step_key?: string;
  action?: string;
}

interface RollupResult {
  runs: RunsFacet[];
  overall: OverallFacet[];
  states: StateFacet[];
  latest: LatestFacet[];
}

/* -------------------------------------------------------------------------- */
/* The Mongo implementation                                                    */
/* -------------------------------------------------------------------------- */

export class MongoCorpusRepository implements CorpusRepositoryPort {
  readonly #reports: Collection<ReportDoc>;
  readonly #incidents: Collection<IncidentDoc>;
  readonly #sessions: Collection<SessionDoc>;
  readonly #runs: Collection<RunDoc>;
  readonly #journal: Collection<JournalDoc>;

  constructor(db: Db) {
    // `ignoreUndefined` is load-bearing, not tidiness. Every document here has
    // required keys typed `string | undefined` (`usecase`, `step_key`, …), so
    // they are always *present* in the object literal even when empty. Left to
    // its default the driver would store an explicit `null`, which reads back
    // as a value rather than as absence: `usecase: null` fails a `=== undefined`
    // check, defeats the sparse indexes in `mongo.ts`, and makes two documents
    // that mean the same thing compare unequal.
    const options = { ignoreUndefined: true };
    this.#reports = db.collection<ReportDoc>(COLLECTIONS.reports, options);
    this.#incidents = db.collection<IncidentDoc>(
      COLLECTIONS.incidents,
      options,
    );
    this.#sessions = db.collection<SessionDoc>(COLLECTIONS.sessions, options);
    this.#runs = db.collection<RunDoc>(COLLECTIONS.runs, options);
    this.#journal = db.collection<JournalDoc>(COLLECTIONS.journal, options);
  }

  /* ------------------------------- reports -------------------------------- */

  /**
   * Append one delivery. `false` means it was already there.
   *
   * This is the whole of redelivery idempotence, and it rests on `_id` being
   * `{install_id}:{report_id}:{generated_at}` rather than `report_id` alone.
   * The engine re-flushes a narrated incident under the *same* `report_id`, and
   * `SpoolAndUploadSink` will resend a spool file whose `.sent` marker was lost,
   * so both "the same delivery twice" and "the same incident twice, enriched"
   * arrive here routinely. The first must collapse; the second must not.
   *
   * A duplicate is swallowed rather than thrown because it is not an error at
   * any layer above: the caller's contract is "this report is now durable", and
   * it already was.
   */
  async insertReport(doc: ReportDoc): Promise<boolean> {
    try {
      await this.#reports.insertOne(doc);
      return true;
    } catch (error) {
      if (isDuplicateKeyError(error)) return false;
      throw error;
    }
  }

  findReport(docId: string): Promise<ReportDoc | undefined> {
    return this.#reports
      .findOne({ _id: docId })
      .then((doc) => doc ?? undefined);
  }

  latestReportFor(fingerprint: string): Promise<ReportDoc | undefined> {
    return this.#reports
      .find({ fingerprint })
      .sort({ generated_at: -1, received_at: -1 })
      .limit(1)
      .next()
      .then((doc) => doc ?? undefined);
  }

  listReports(
    filter: ReportFilter,
    limit: number,
    skip: number,
  ): Promise<ReportDoc[]> {
    return this.#reports
      .find(buildReportQuery(filter))
      .sort({ generated_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  countReports(filter: ReportFilter = {}): Promise<number> {
    return this.#reports.countDocuments(buildReportQuery(filter));
  }

  /**
   * Distinct installs across the whole ledger.
   *
   * `distinct` rather than a cached counter: the number is read once per
   * overview render and a counter would be a fourth thing to keep in step with
   * the ledger, which is the class of bug `recomputeIncident` exists to avoid.
   */
  countInstalls(): Promise<number> {
    return this.#reports.distinct("install_id").then((values) => values.length);
  }

  /* ------------------------------ incidents ------------------------------- */

  /**
   * Rebuild one incident's rollups from the ledger. **Never `$inc`.**
   *
   * Two independent reasons an increment double-counts here, and either alone
   * is fatal:
   *
   * 1. `report_id` is reused. Narrating an incident the engine already flushed
   *    clears `flushed_at` and re-ships the same run under a new
   *    `generated_at`. That is a second ledger row for one run — correct, it is
   *    a second *delivery* — but incrementing on it would count the run twice.
   * 2. `incident.occurrences` from the engine is a **running total**, not a
   *    delta. It is the number of times that signature has fired in the
   *    session so far. Adding successive reports' `occurrences` sums a prefix
   *    series: three deliveries of a run that fired 3 times reads as 1+2+3 = 6.
   *
   * So `occurrences_total` is the sum of the **maximum `occurrences` per
   * distinct run**, computed by a two-stage `$group` — collapse to one row per
   * run keeping its peak, then sum the peaks. Recomputing from scratch also
   * makes the operation idempotent, which is what lets `acceptReport` call it
   * unconditionally, including on a duplicate.
   *
   * The run key is the `(install_id, report_id)` pair rather than `report_id`
   * alone. The engine mints `inc_{uuid}`, so the two are equivalent today —
   * but `reportDocId` already distrusts a bare `report_id`, and if that ever
   * stops being a UUID the pair degrades to "slightly more rows" while the
   * bare id degrades to two operators' incidents silently merging.
   */
  async recomputeIncident(
    fingerprint: string,
  ): Promise<IncidentDoc | undefined> {
    const [rollup] = await this.#reports
      .aggregate<RollupResult>([
        { $match: { fingerprint } },
        {
          $facet: {
            runs: [
              {
                $group: {
                  _id: {
                    install_id: "$install_id",
                    report_id: "$report_id",
                  },
                  peak: { $max: "$occurrences" },
                },
              },
              {
                $group: {
                  _id: null,
                  occurrences_total: { $sum: "$peak" },
                  distinct_runs: { $sum: 1 },
                },
              },
            ],
            overall: [
              {
                $group: {
                  _id: null,
                  deliveries: { $sum: 1 },
                  install_ids: { $addToSet: "$install_id" },
                  mock_roles: { $addToSet: "$mock_role" },
                  suspected_causes: { $addToSet: "$suspected_cause" },
                  first_seen_at: { $min: "$generated_at" },
                  last_seen_at: { $max: "$generated_at" },
                  // `$max` over 0/1 rather than over the boolean: "any delivery
                  // was narrated" is the question, and an int max says so in a
                  // way that does not depend on BSON's ordering of booleans.
                  narrated: { $max: { $cond: ["$narrated", 1, 0] } },
                },
              },
            ],
            states: [{ $group: { _id: "$state", count: { $sum: 1 } } }],
            // The identity fields are taken from the newest delivery rather
            // than the oldest, so a report shipped by a newer engine — one that
            // spells `action` where an older one left it out — wins.
            latest: [
              { $sort: { generated_at: -1, received_at: -1 } },
              { $limit: 1 },
              {
                $project: {
                  _id: 1,
                  state: 1,
                  domain: 1,
                  version: 1,
                  usecase: 1,
                  flow_id: 1,
                  trigger: 1,
                  code: 1,
                  step_key: 1,
                  action: 1,
                },
              },
            ],
          },
        },
      ])
      .toArray();

    const runs = rollup?.runs[0];
    const overall = rollup?.overall[0];
    const latest = rollup?.latest[0];
    // No ledger rows for this fingerprint. Nothing to roll up, and emphatically
    // nothing to upsert — an incident with no reports behind it would sit in
    // the triage queue forever with nothing to show.
    if (runs === undefined || overall === undefined || latest === undefined) {
      return undefined;
    }

    const stateCounts: Record<string, number> = {};
    for (const bucket of rollup?.states ?? []) {
      stateCounts[bucket._id] = bucket.count;
    }

    const update: UpdateFilter<IncidentDoc> = {
      $set: {
        domain: latest.domain,
        version: latest.version,
        usecase: latest.usecase,
        flow_id: latest.flow_id,
        trigger: latest.trigger,
        code: latest.code,
        step_key: latest.step_key,
        action: latest.action,

        occurrences_total: runs.occurrences_total,
        deliveries: overall.deliveries,
        distinct_runs: runs.distinct_runs,
        install_ids: [...overall.install_ids].sort(),
        mock_roles: [...overall.mock_roles].sort(),
        first_seen_at: overall.first_seen_at,
        last_seen_at: overall.last_seen_at,
        latest_state: latest.state,
        state_counts: stateCounts,
        narrated: overall.narrated > 0,
        suspected_causes: overall.suspected_causes
          .filter((cause): cause is string => typeof cause === "string")
          .sort(),
        latest_report_doc_id: latest._id,
      },
      // The triage half is owned by the operator's own actions, never by the
      // ledger. Recompute runs on every single delivery, so a `$set` here would
      // un-suppress a dismissed incident, reset its status to `untracked` and
      // erase its notes the moment it fired once more — which is precisely when
      // a human's decision matters most.
      $setOnInsert: {
        suppressed: false,
        "triage.status": "untracked",
        "triage.assignees": [],
        "triage.notes": [],
      },
    };

    const doc = await this.#incidents.findOneAndUpdate(
      { _id: fingerprint },
      update,
      { upsert: true, returnDocument: "after" },
    );
    return doc ?? undefined;
  }

  findIncident(fingerprint: string): Promise<IncidentDoc | undefined> {
    return this.#incidents
      .findOne({ _id: fingerprint })
      .then((doc) => doc ?? undefined);
  }

  listIncidents(
    filter: IncidentFilter,
    sort: Sort,
    limit: number,
    skip: number,
  ): Promise<IncidentDoc[]> {
    return this.#incidents
      .find(buildIncidentQuery(filter))
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  countIncidents(filter: IncidentFilter): Promise<number> {
    return this.#incidents.countDocuments(buildIncidentQuery(filter));
  }

  async setSuppressed(fingerprint: string, suppressed: boolean): Promise<void> {
    await this.#incidents.updateOne(
      { _id: fingerprint },
      { $set: { suppressed } },
    );
  }

  /**
   * Append one thing an operator recorded.
   *
   * Its own method rather than a branch in `setTriage`, because `setTriage`
   * builds a `$set` and `$set`-ing an array replaces it wholesale — which is
   * the exact failure that method's dotted paths exist to avoid, and it would
   * silently erase the timeline instead of a sibling field.
   *
   * `$slice` bounds the array for two reasons, and the first is the one that
   * would hurt: `recomputeIncident` runs `findOneAndUpdate` with
   * `returnDocument: "after"` on **every single report delivery**, so an
   * unbounded `notes[]` turns operator activity into a per-ingest transfer cost
   * on the one path that must never get slower. The second is the 16MB
   * document ceiling.
   */
  async appendTriageNote(
    fingerprint: string,
    note: TriageNote,
  ): Promise<void> {
    await this.#incidents.updateOne(
      { _id: fingerprint },
      {
        $push: {
          "triage.notes": { $each: [note], $slice: -MAX_TRIAGE_NOTES },
        },
        $set: { "triage.updated_at": note.at },
      },
    );
  }

  /**
   * Patch the triage half, field by field.
   *
   * Dotted paths rather than replacing `triage` wholesale: an action sets a
   * status in one call and a resolution in another, and a whole-object write
   * would blank whichever half the caller did not happen to be looking at —
   * `notes[]` above all, which is append-only and unrecoverable once flattened.
   */
  async setTriage(
    fingerprint: string,
    partial: Partial<IncidentDoc["triage"]>,
  ): Promise<void> {
    const set: Record<string, unknown> = {
      ...(partial.status !== undefined
        ? { "triage.status": partial.status }
        : {}),
      ...(partial.assignees !== undefined
        ? { "triage.assignees": partial.assignees }
        : {}),
      ...(partial.resolution !== undefined
        ? { "triage.resolution": partial.resolution }
        : {}),
      ...(partial.updated_at !== undefined
        ? { "triage.updated_at": partial.updated_at }
        : {}),
    };
    if (Object.keys(set).length === 0) return;
    await this.#incidents.updateOne({ _id: fingerprint }, { $set: set });
  }

  /**
   * Every count the overview page needs, in one round trip.
   *
   * `$facet` rather than five `countDocuments` calls: the page renders all of
   * them together, so five independent reads would let the tiles disagree with
   * each other whenever a report lands mid-render.
   */
  async facets(): Promise<CorpusFacets> {
    const [doc] = await this.#incidents
      .aggregate<{
        trigger: StateFacet[];
        latest_state: StateFacet[];
        domain: StateFacet[];
        triage_status: StateFacet[];
        top_flows: {
          _id: { domain: string; version: string; flow_id: string };
          occurrences_total: number;
          incidents: number;
        }[];
      }>([
        {
          $facet: {
            trigger: groupCount("$trigger"),
            latest_state: groupCount("$latest_state"),
            domain: groupCount("$domain"),
            triage_status: groupCount("$triage.status"),
            top_flows: [
              {
                $group: {
                  _id: {
                    domain: "$domain",
                    version: "$version",
                    flow_id: "$flow_id",
                  },
                  occurrences_total: { $sum: "$occurrences_total" },
                  incidents: { $sum: 1 },
                },
              },
              { $sort: { occurrences_total: -1 } },
              { $limit: 10 },
            ],
          },
        },
      ])
      .toArray();

    return {
      trigger: toBuckets(doc?.trigger),
      latest_state: toBuckets(doc?.latest_state),
      domain: toBuckets(doc?.domain),
      triage_status: toBuckets(doc?.triage_status),
      top_flows: (doc?.top_flows ?? []).map((entry) => ({
        domain: entry._id.domain,
        version: entry._id.version,
        flow_id: entry._id.flow_id,
        occurrences_total: entry.occurrences_total,
        incidents: entry.incidents,
      })),
    };
  }

  /* -------------------------- mirrored live state ------------------------- */

  async upsertSession(doc: SessionDoc): Promise<void> {
    const { _id, ...rest } = doc;
    await this.#sessions.updateOne({ _id }, { $set: rest }, { upsert: true });
  }

  /**
   * Upsert a run, without letting a resend walk its status backwards.
   *
   * The mirror is at-least-once, so a `RUN_STARTED` for a run that has since
   * completed is a normal event, not a bug. `$setOnInsert` on `status` is what
   * keeps that replay from resetting a finished run to `started` and stranding
   * it in the "in flight" view forever.
   */
  async upsertRun(doc: RunDoc): Promise<void> {
    const { _id, status, ...rest } = doc;
    await this.#runs.updateOne(
      { _id },
      { $set: rest, $setOnInsert: { status } },
      { upsert: true },
    );
  }

  /**
   * Move the newest attempt of a run to a new status.
   *
   * A journal line names the flow but never the attempt, and `flow_restart`
   * opens a fresh attempt under the same flow id — so "which run did this
   * `FLOW_COMPLETE` mean?" has exactly one defensible answer: the highest
   * attempt, because that is the only one the engine could still be driving.
   *
   * Answers `false` when no run matched. That is not an error: journal lines
   * and run announcements travel in the same batch but not necessarily in the
   * same order, and a status for a run we have not been told about yet is
   * simply information we cannot file.
   */
  async setRunStatus(key: RunKey, patch: RunStatusPatch): Promise<boolean> {
    const doc = await this.#runs.findOneAndUpdate(
      {
        install_id: key.install_id,
        session_ref: key.session_ref,
        flow_id: key.flow_id,
      },
      {
        $set: {
          status: patch.status,
          updated_at: patch.updated_at,
          ...(patch.transaction_id !== undefined
            ? { transaction_id: patch.transaction_id }
            : {}),
        },
      },
      { sort: { attempt: -1 }, returnDocument: "after" },
    );
    return doc !== null;
  }

  /**
   * Bulk-append journal lines, ignoring what is already there.
   *
   * `ordered: false` so one duplicate does not abandon the rest of the batch —
   * the mirror resends a whole batch when its acknowledgement is lost, and by
   * definition every line before the lost point is already stored. The unique
   * `{session_ref, seq}` index is what makes that resend a no-op instead of a
   * duplicated timeline.
   */
  async insertJournal(docs: JournalDoc[]): Promise<number> {
    if (docs.length === 0) return 0;
    try {
      const result = await this.#journal.insertMany(docs, { ordered: false });
      return result.insertedCount;
    } catch (error) {
      if (isDuplicateKeyError(error)) return insertedCountOf(error);
      throw error;
    }
  }

  listSessions(
    filter: SessionFilter,
    limit: number,
    skip: number,
  ): Promise<SessionDoc[]> {
    const query: Filter<SessionDoc> = {
      ...(filter.install_id !== undefined
        ? { install_id: filter.install_id }
        : {}),
      ...(filter.session_ref !== undefined
        ? { session_ref: filter.session_ref }
        : {}),
    };
    return this.#sessions
      .find(query)
      .sort({ received_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  findSession(docId: string): Promise<SessionDoc | undefined> {
    return this.#sessions
      .findOne({ _id: docId })
      .then((doc) => doc ?? undefined);
  }

  listRuns(filter: RunFilter, limit: number, skip: number): Promise<RunDoc[]> {
    const query: Filter<RunDoc> = {
      ...(filter.install_id !== undefined
        ? { install_id: filter.install_id }
        : {}),
      ...(filter.session_ref !== undefined
        ? { session_ref: filter.session_ref }
        : {}),
      ...(filter.flow_id !== undefined ? { flow_id: filter.flow_id } : {}),
      ...(filter.status !== undefined ? { status: filter.status } : {}),
    };
    return this.#runs
      .find(query)
      .sort({ updated_at: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
  }

  /**
   * One session's journal, oldest first, after a cursor.
   *
   * Ascending and cursor-based rather than "newest N": this feeds a timeline
   * that a client polls, and paging by seq is the only way a poll cannot miss
   * a line that landed between two requests.
   */
  listJournal(
    sessionRef: string,
    afterSeq: number,
    limit: number,
  ): Promise<JournalDoc[]> {
    return this.#journal
      .find({ session_ref: sessionRef, seq: { $gt: afterSeq } })
      .sort({ seq: 1 })
      .limit(limit)
      .toArray();
  }
}

/* -------------------------------------------------------------------------- */
/* Small helpers                                                               */
/* -------------------------------------------------------------------------- */

function groupCount(expression: string): Record<string, unknown>[] {
  return [
    { $group: { _id: expression, count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ];
}

function toBuckets(rows: StateFacet[] | undefined): FacetBucket[] {
  return (rows ?? [])
    .filter((row) => typeof row._id === "string")
    .map((row) => ({ value: row._id, count: row.count }));
}

/**
 * Mongo's "already there", by code rather than by class.
 *
 * `instanceof MongoServerError` breaks the moment two copies of the driver end
 * up on disk — a real hazard in a workspace — and the code is the part of the
 * contract that is actually stable.
 */
function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 11000
  );
}

/** How much of a partially-rejected `insertMany` actually landed. */
function insertedCountOf(error: unknown): number {
  const result = (error as { result?: { insertedCount?: unknown } }).result;
  return typeof result?.insertedCount === "number" ? result.insertedCount : 0;
}

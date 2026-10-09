import type { Logger } from "pino";
import { BadRequestError } from "@/lib/errors.js";
import type { CorpusRepositoryPort } from "@/mcp/modules/corpus/corpus.repository.js";
import {
  fingerprintOf,
  reportDocId,
  type JournalDoc,
  type ReportDoc,
  type RunDoc,
  type SessionDoc,
} from "@/mcp/modules/corpus/corpus.schema.js";
import { IssueReport } from "@/mcp/modules/ingest/report.schema.js";
import {
  RUN_STATUS_BY_JOURNAL_KIND,
  TelemetryBatch,
  TelemetryEntry,
} from "@/mcp/modules/ingest/telemetry.schema.js";

/**
 * The write side of the corpus: everything `automation-mcp` POSTs at us.
 *
 * ## The one rule that governs this whole file
 *
 * **Nothing may answer 2xx before the write is durable.**
 *
 * `SpoolAndUploadSink` on the engine writes a `.sent` marker on *any* 2xx and
 * never looks at that spool file again. There is no acknowledgement beyond the
 * status code and no second delivery to fall back on. So an "accept now, write
 * later" queue — the obvious performance win, and the change someone will
 * eventually propose — does not lose a report on a bad day, it loses one every
 * time the process restarts with work in flight, silently, in exactly the
 * situation that produced the report worth reading. Await the write. The
 * volume here is a handful of reports per run; there is nothing to optimise.
 *
 * The corollary points the other way and matters just as much: a failure must
 * surface as 5xx, never as a swallowed error and a 202, because 5xx is the only
 * way to say "still pending, send it again".
 */

export interface IngestServiceOptions {
  repository: CorpusRepositoryPort;
  logger: Logger;
  /** Injectable so tests can pin `received_at` without freezing global time. */
  now?: () => Date;
}

export interface AcceptReportResult {
  accepted: boolean;
  fingerprint: string;
  report_doc_id: string;
  /** The ledger already held this exact delivery. Not an error — see below. */
  duplicate: boolean;
}

export interface AcceptTelemetryResult {
  accepted: boolean;
  sessions: number;
  runs: number;
  journal: number;
  /** Entries this build could not read. A schema drift, not a rejection. */
  skipped: number;
  /** Echoed back so the caller can see we understood the gap it declared. */
  dropped_since_last_batch: number | undefined;
}

export class IngestService {
  readonly #repository: CorpusRepositoryPort;
  readonly #logger: Logger;
  readonly #now: () => Date;

  constructor(options: IngestServiceOptions) {
    this.#repository = options.repository;
    this.#logger = options.logger;
    this.#now = options.now ?? (() => new Date());
  }

  /* -------------------------------- reports ------------------------------- */

  /**
   * Store one issue report and refresh the incident it rolls into.
   *
   * Two decisions worth not undoing:
   *
   * **The recompute runs even when the insert was a duplicate.** It looks like
   * wasted work and is not. Two deliveries of the same fingerprint can be in
   * flight at once from two installs; the loser of that race sees a duplicate
   * `_id` only for *its own* row, while the other install's brand-new row is
   * what the incident is missing. Skipping the recompute on a duplicate would
   * leave the incident describing a corpus it no longer matches, and nothing
   * downstream ever re-triggers it. Recompute is idempotent — see
   * `recomputeIncident` — so running it unconditionally costs one aggregation
   * and removes an entire class of stale rollup.
   *
   * **A duplicate is still `accepted: true`.** The caller's question is "is
   * this report durable?", and it is. Answering anything else invites the
   * engine to keep resending a report we already hold.
   */
  async acceptReport(raw: unknown): Promise<AcceptReportResult> {
    const parsed = IssueReport.safeParse(raw);
    if (!parsed.success) {
      // Reaching here means the body lacks `report_id`, `install_id`,
      // `generated_at` or an `incident` — i.e. there is no way to key it, so
      // storing it would produce a row nothing can ever find. Everything
      // softer than that is absorbed by the schema's leniency on purpose.
      throw new BadRequestError("issue report did not parse", {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const report = parsed.data;
    const fingerprint = fingerprintOf(report);
    const docId = reportDocId(report);
    const doc = toReportDoc(
      report,
      fingerprint,
      docId,
      this.#now().toISOString(),
    );

    const inserted = await this.#repository.insertReport(doc);
    const incident = await this.#repository.recomputeIncident(fingerprint);

    this.#logger.info(
      {
        fingerprint,
        report_doc_id: docId,
        duplicate: !inserted,
        trigger: report.incident.trigger,
        code: report.incident.code,
        flow_id: report.flow_id,
        occurrences_total: incident?.occurrences_total,
        distinct_runs: incident?.distinct_runs,
      },
      inserted ? "ingested issue report" : "issue report already in ledger",
    );

    return {
      accepted: true,
      fingerprint,
      report_doc_id: docId,
      duplicate: !inserted,
    };
  }

  /* ------------------------------- telemetry ------------------------------ */

  /**
   * Absorb one mirror batch.
   *
   * Entries are applied in the order they arrive, one at a time, because a
   * `RUN_STARTED` and the `TRANSACTION_BOUND` that follows it commonly ride the
   * same batch and the second is meaningless before the first has landed.
   * Journal lines are the exception — they are collected and inserted in one
   * bulk write, since they are the bulk of the volume and none of them depends
   * on another.
   */
  async acceptTelemetry(raw: unknown): Promise<AcceptTelemetryResult> {
    const parsed = TelemetryBatch.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestError("telemetry batch did not parse", {
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const envelope = parsed.data;
    const receivedAt = this.#now();
    const receivedIso = receivedAt.toISOString();

    const journalDocs: JournalDoc[] = [];
    let sessions = 0;
    let runs = 0;
    let skipped = 0;

    for (const entry of envelope.records) {
      const result = TelemetryEntry.safeParse(entry);
      if (!result.success) {
        // Counted, never thrown. See `telemetry.schema.ts`: the mirror does not
        // retry, so refusing the batch would discard every good line with it.
        skipped += 1;
        continue;
      }

      const value = result.data;
      switch (value.kind) {
        case "SESSION_CREATED": {
          await this.#repository.upsertSession(
            toSessionDoc(
              value,
              value.install_id,
              value.instance_id,
              receivedIso,
            ),
          );
          sessions += 1;
          break;
        }
        case "RUN_STARTED": {
          await this.#repository.upsertRun(
            toRunDoc(value, value.install_id, receivedIso),
          );
          runs += 1;
          break;
        }
        case "JOURNAL": {
          journalDocs.push(
            toJournalDoc(value, value.install_id, receivedAt),
          );
          const status = RUN_STATUS_BY_JOURNAL_KIND[value.event.kind];
          if (status !== undefined && value.event.flow_id !== undefined) {
            await this.#repository.setRunStatus(
              {
                install_id: value.install_id,
                session_ref: value.session_ref,
                flow_id: value.event.flow_id,
              },
              {
                status,
                updated_at: value.event.at ?? receivedIso,
                ...(value.event.transaction_id !== undefined
                  ? { transaction_id: value.event.transaction_id }
                  : {}),
              },
            );
          }
          break;
        }
      }
    }

    const journal = await this.#repository.insertJournal(journalDocs);

    if (skipped > 0 || (envelope.dropped_since_last_batch ?? 0) > 0) {
      this.#logger.warn(
        {
          instance_id: envelope.instance_id,
          schema_version: envelope.schema_version,
          skipped,
          dropped_since_last_batch: envelope.dropped_since_last_batch,
        },
        "telemetry batch had gaps",
      );
    }

    return {
      accepted: true,
      sessions,
      runs,
      journal,
      skipped,
      dropped_since_last_batch: envelope.dropped_since_last_batch,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Wire shape → document shape                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Flatten a report into its ledger row.
 *
 * The nesting is flattened for querying and the whole report is kept verbatim
 * beside it — a projection, never a replacement. `ReportDoc.report` is the only
 * answer to "what did the engine actually send?", and the day a field means
 * something new, the flat copy is wrong and the verbatim one is not.
 *
 * `correlation` is lifted into top-level `session_id` / `transaction_id`
 * because those are the join keys to the mirrored sessions, and because they
 * are indexed sparsely in `mongo.ts` — a nested lift keeps a third-party report
 * that carries no correlation out of that index entirely rather than filling it
 * with nulls.
 */
export function toReportDoc(
  report: IssueReport,
  fingerprint: string,
  docId: string,
  receivedAt: string,
): ReportDoc {
  return {
    _id: docId,
    fingerprint,
    install_id: report.install_id,
    report_id: report.report_id,
    generated_at: report.generated_at,
    received_at: receivedAt,

    domain: report.build.domain,
    version: report.build.version,
    usecase: report.build.usecase,
    mock_role: report.mock_role,
    flow_id: report.flow_id,
    attempt: report.attempt,

    trigger: report.incident.trigger,
    code: report.incident.code,
    step_key: report.incident.step_key,
    action: report.incident.action,
    state: report.incident.state,
    occurrences: report.incident.occurrences,
    duration_ms: report.incident.duration_ms,

    // `narration` is nullish, and the distinction the producer draws is
    // "absent" vs "explicitly null" — both mean the model never answered, so
    // both collapse to `false` here.
    narrated: report.narration !== null && report.narration !== undefined,
    suspected_cause: report.narration?.suspected_cause,
    narration_outcome: report.narration?.outcome,

    session_id: report.correlation?.session_id,
    transaction_id: report.correlation?.transaction_id,

    report,
  };
}

type SessionEntry = Extract<TelemetryEntry, { kind: "SESSION_CREATED" }>;
type RunEntry = Extract<TelemetryEntry, { kind: "RUN_STARTED" }>;
type JournalEntry = Extract<TelemetryEntry, { kind: "JOURNAL" }>;

/**
 * `_id` is `{install_id}:{session_ref}`, not `session_ref` alone.
 *
 * `session_ref` is an engine-side hash of an id the engine chose, and two
 * installs are two entirely separate namespaces. Keying on the ref alone would
 * let one operator's session silently overwrite another's — the one failure in
 * a shared corpus that is impossible to notice from the inside.
 */
export function toSessionDoc(
  entry: SessionEntry,
  installId: string,
  instanceId: string,
  receivedAt: string,
): SessionDoc {
  return {
    _id: `${installId}:${entry.session_ref}`,
    install_id: installId,
    instance_id: instanceId,
    session_ref: entry.session_ref,
    // Present only under the engine's `TELEMETRY_CORRELATION`; the corpus must
    // stay useful without it, so every read path treats it as optional.
    session_id: entry.correlation?.session_id,
    domain: entry.session.domain,
    version: entry.session.version,
    usecase: entry.session.usecase,
    mock_role: entry.session.mock_role,
    np_type: entry.session.np_type,
    subscriber_ref: entry.session.subscriber_ref,
    callback_url: entry.session.callback_url,
    interaction_mode: entry.session.interaction_mode,
    auto_advance: entry.session.auto_advance,
    created_at: entry.session.created_at ?? receivedAt,
    expires_at: entry.session.expires_at ?? receivedAt,
    received_at: receivedAt,
  };
}

export function toRunDoc(
  entry: RunEntry,
  installId: string,
  receivedAt: string,
): RunDoc {
  const startedAt = entry.run.started_at ?? receivedAt;
  return {
    _id: `${installId}:${entry.session_ref}:${entry.run.flow_id}:${entry.run.attempt}`,
    install_id: installId,
    session_ref: entry.session_ref,
    session_id: entry.correlation?.session_id,
    flow_id: entry.run.flow_id,
    attempt: entry.run.attempt,
    // A run has no transaction id at RUN_STARTED — one is minted or adopted
    // only when the first payload crosses the wire. It arrives later, on the
    // TRANSACTION_BOUND journal line.
    transaction_id: entry.correlation?.transaction_id,
    // `started`, always — a run's later statuses are derived from journal
    // kinds, and `upsertRun` refuses to overwrite one that has already moved on.
    status: "started",
    step_count: entry.run.step_count,
    started_at: startedAt,
    updated_at: startedAt,
  };
}

export function toJournalDoc(
  entry: JournalEntry,
  installId: string,
  receivedAt: Date,
): JournalDoc {
  const event = entry.event;
  return {
    _id: `${installId}:${entry.session_ref}:${event.seq}`,
    install_id: installId,
    session_ref: entry.session_ref,
    session_id: entry.correlation?.session_id,
    seq: event.seq,
    at: event.at ?? receivedAt.toISOString(),
    kind: event.kind,
    flow_id: event.flow_id,
    transaction_id: event.transaction_id,
    action: event.action,
    ack: event.ack,
    nack_code: event.nack_code,
    payload_id: event.payload_id,
    overrides: event.overrides,
    summary: event.summary,
    // A `Date`, not an ISO string: the TTL index in `mongo.ts` only expires
    // BSON dates, and a string here would keep every journal line forever
    // without erroring anywhere.
    received_at: receivedAt,
  };
}

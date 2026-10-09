import { z } from "zod";

/**
 * The mirror contract: live session state, pushed from `automation-mcp`.
 *
 * Read this next to `report.schema.ts` — same leniency, same reason. The engine
 * ships separately, its `SessionEventKind` grows a member whenever a new thing
 * can happen on the wire, and an ingest that 400s on a kind it has not seen
 * would turn every engine release into a dashboard outage.
 *
 * The difference from a report is what a rejection *costs*. A report is spooled
 * and resent forever, so refusing one is a defect that eventually gets noticed.
 * A telemetry batch is best-effort: the engine drops what it cannot deliver and
 * tells us how much via `dropped_since_last_batch`. Refusing a batch here loses
 * it permanently — which is why the batch envelope is parsed separately from
 * its entries, and an entry we cannot read is **skipped, not fatal**. One
 * unrecognised line must never cost the ninety-nine around it.
 *
 * ## Why the identifiers are `_ref`
 *
 * `session_ref` and `subscriber_ref` are engine-side hashes. Correlation mode
 * additionally sends `session_id` in the clear; without it the dashboard can
 * still group, count and time everything, and simply cannot join to a report's
 * `correlation`. That has to keep working — a third-party operator mirroring
 * their runs is not obliged to hand us their subscriber URLs.
 */

/* -------------------------------------------------------------------------- */
/* Entries                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Fields every record carries, whatever its kind.
 *
 * `install_id` is **per record, not per envelope**, because that is where the
 * engine puts it (`mirror.schema.ts#MirrorRecord`). One process has one install
 * pseudonym today, so an envelope-level field would work in practice — but the
 * producer's shape is the contract, and reading it from where it is actually
 * written costs nothing and cannot drift.
 *
 * `correlation` holds the clear ids, present only when the engine runs with
 * `TELEMETRY_CORRELATION`. Same key and same shape as `IssueReport.correlation`
 * — reused by the engine rather than redefined, so a consumer joining a mirror
 * record to a report reads one contract.
 */
const RecordBase = {
  schema_version: z.number().default(1),
  emitted_at: z.string().optional(),
  install_id: z.string().default("unknown"),
  instance_id: z.string().default("unknown"),
  session_ref: z.string().min(1),
  correlation: z
    .object({
      session_id: z.string(),
      transaction_id: z.string().optional(),
    })
    .loose()
    .optional(),
};

export const TelemetrySessionCreated = z
  .object({
    ...RecordBase,
    kind: z.literal("SESSION_CREATED"),
    /**
     * Nested, as `MirrorRecord.session`, and **required**: a SESSION_CREATED
     * with no session carries no domain, version or expiry, so there is nothing
     * to store. It is counted as `skipped` rather than rejecting the batch.
     */
    session: z
      .object({
        domain: z.string().default("unknown"),
        version: z.string().default("unknown"),
        usecase: z.string().optional(),
        mock_role: z.string().default("unknown"),
        np_type: z.string().default("unknown"),
        subscriber_ref: z.string().default("unknown"),
        callback_url: z.string().default(""),
        interaction_mode: z.string().default("unknown"),
        auto_advance: z.boolean().default(false),
        created_at: z.string().optional(),
        expires_at: z.string().optional(),
      })
      .loose(),
  })
  .loose();
export type TelemetrySessionCreated = z.infer<typeof TelemetrySessionCreated>;

export const TelemetryRunStarted = z
  .object({
    ...RecordBase,
    kind: z.literal("RUN_STARTED"),
    /** Nested, as `MirrorRecord.run`. Required, for the same reason. */
    run: z
      .object({
        flow_id: z.string().default("unknown"),
        /**
         * `flow_restart` seals an attempt and opens the next under the same
         * flow id, so this is what keeps two attempts of one run from
         * overwriting each other.
         */
        attempt: z.number().default(1),
        auto_advance: z.boolean().default(false),
        started_at: z.string().optional(),
        step_count: z.number().optional(),
      })
      .loose(),
  })
  .loose();
export type TelemetryRunStarted = z.infer<typeof TelemetryRunStarted>;

/** One line of the engine's session journal, as `record.schema.ts` writes it. */
export const TelemetryJournalEvent = z
  .object({
    seq: z.number(),
    at: z.string().optional(),
    // A plain string, not the engine's enum. See the file header: a new kind is
    // an engine release, not a dashboard incident.
    kind: z.string(),
    flow_id: z.string().optional(),
    transaction_id: z.string().optional(),
    action: z.string().optional(),
    ack: z.string().optional(),
    nack_code: z.string().optional(),
    payload_id: z.string().optional(),
    overrides: z.array(z.string()).optional(),
    summary: z.string().default(""),
  })
  .loose();
export type TelemetryJournalEvent = z.infer<typeof TelemetryJournalEvent>;

export const TelemetryJournal = z
  .object({
    ...RecordBase,
    kind: z.literal("JOURNAL"),
    event: TelemetryJournalEvent,
  })
  .loose();
export type TelemetryJournal = z.infer<typeof TelemetryJournal>;

export const TelemetryEntry = z.discriminatedUnion("kind", [
  TelemetrySessionCreated,
  TelemetryRunStarted,
  TelemetryJournal,
]);
export type TelemetryEntry = z.infer<typeof TelemetryEntry>;

/* -------------------------------------------------------------------------- */
/* The envelope                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The envelope, matching `mirror.schema.ts#MirrorBatch` exactly.
 *
 * **The array is `records`, not `batch`**, and `install_id` lives on each
 * record rather than here. Both were got wrong once — the engine and this
 * ingest were written against the same prose from opposite sides, agreed on
 * every field name that mattered, and disagreed on the two that carry them.
 * Nothing would have failed loudly: the mirror POSTs, gets a 202, and the
 * corpus silently stays empty. `telemetry.contract.test.ts` posts a
 * byte-accurate engine batch for exactly this reason.
 *
 * `records` is `unknown[]` **on purpose**. Typing it as `TelemetryEntry[]`
 * would make one entry from a future engine reject the whole envelope — a
 * hundred good lines discarded because of one, permanently, since the mirror
 * does not retry. Each entry is parsed individually and failures are counted,
 * so schema drift shows up as a `skipped` number rather than a hole.
 */
export const TelemetryBatch = z
  .object({
    schema_version: z.number().default(1),
    instance_id: z.string().default("unknown"),
    sent_at: z.string().optional(),
    /**
     * What the engine's bounded buffer threw away before this batch. The only
     * honest way to read a gap in `seq`, and the reason a gap is not treated as
     * a bug on this side.
     */
    dropped_since_last_batch: z.number().optional(),
    records: z.array(z.unknown()).default([]),
  })
  .loose();
export type TelemetryBatch = z.infer<typeof TelemetryBatch>;

/**
 * Journal kinds that move a run's status, and where they move it to.
 *
 * Deliberately a small map rather than a switch over the engine's full enum:
 * these four are the transitions with a durable meaning for someone reading a
 * list of runs. Everything else is timeline detail, already stored as a journal
 * line, and inventing a status for it would only produce a column that changes
 * every few seconds and says nothing.
 */
export const RUN_STATUS_BY_JOURNAL_KIND: Readonly<Record<string, string>> = {
  TRANSACTION_BOUND: "bound",
  FLOW_COMPLETE: "complete",
  FLOW_RESTARTED: "restarted",
};

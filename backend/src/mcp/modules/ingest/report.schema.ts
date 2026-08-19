import { z } from "zod";

/**
 * The wire contract with `automation-mcp`.
 *
 * Vendored — deliberately — from
 * `automation-mcp/src/modules/feedback/feedback.schema.ts`. The two services
 * ship separately and an import across repos would couple their release cycles
 * to no benefit: this file is the *ingest's* reading of the format, and it is
 * allowed to be more permissive than the producer's writing of it.
 *
 * ## Parsing is lenient on purpose
 *
 * The producer's own comment on `REPORT_SCHEMA_VERSION` is the requirement:
 *
 * > Bumped when a field changes meaning, not when one is added. The ingest has
 * > to be able to read a spool file written by a version it has never seen.
 *
 * So: every enum is a plain `string`, `schema_version` is any number, unknown
 * keys pass through and are stored verbatim, and only the handful of fields the
 * corpus actually keys on are required. A report we half-understand is worth
 * far more than a 400 — the engine treats any non-2xx as "still pending" and
 * will resend it forever, and a report we reject is a defect nobody sees.
 *
 * The enums below are documentation and are used for facet ordering in the UI.
 * They are **not** used to validate.
 */

/** Known as of engine schema_version 1. `CONFIG_DEFECT` / `AWAIT_TIMEOUT` are declared upstream but never emitted. */
export const TRIGGER_KINDS = [
  "BLOCKED",
  "INBOUND_NACK",
  "OUTBOUND_NACK",
  "SEND_FAILED",
  "VALIDATION_FINDINGS",
  "VALIDATION_UNAVAILABLE",
  "CONFIG_DEFECT",
  "AWAIT_TIMEOUT",
  "RUN_ABANDONED",
  "INFRA_ERROR",
] as const;

export const INCIDENT_STATES = [
  "OPEN",
  "RECOVERED",
  "RECOVERED_WITH_OVERRIDE",
  "ABANDONED",
  "UNRESOLVED",
] as const;

export const NARRATION_OUTCOMES = [
  "fixed",
  "worked_around",
  "gave_up",
] as const;

export const SUSPECTED_CAUSES = [
  "our_tooling",
  "flow_config",
  "participant",
  "unknown",
] as const;

/** The run got past it, by any means. Mirrors the engine's `isRecovered`. */
export function isRecovered(state: string): boolean {
  return state === "RECOVERED" || state === "RECOVERED_WITH_OVERRIDE";
}

const ValidationFinding = z
  .object({
    layer: z.string(),
    code: z.string(),
    json_path: z.string(),
    message: z.string(),
    skip_if: z.string().optional(),
  })
  .loose();

const IncidentEvidence = z
  .object({
    message: z.string().optional(),
    runner_logs: z.array(z.string()).optional(),
    runner_stack: z.string().optional(),
    sequence: z
      .object({
        expected_action: z.string().optional(),
        expected_step_key: z.string().optional(),
        received_action: z.string().optional(),
        missed_steps: z.array(z.string()).optional(),
      })
      .loose()
      .optional(),
    delivery: z.string().optional(),
    error_codes: z.array(z.string()).optional(),
    http_status: z.number().optional(),
    ack: z.string().optional(),
    findings: z.array(ValidationFinding).optional(),
    unchecked: z
      .array(z.object({ layer: z.string(), reason: z.string() }).loose())
      .optional(),
    payload_shape: z.unknown().optional(),
  })
  .loose();

export const Narration = z
  .object({
    diagnosis: z.string(),
    attempted: z.array(z.string()).default([]),
    outcome: z.string(),
    suspected_cause: z.string(),
    tooling_gap: z.string().optional(),
    at: z.string(),
  })
  .loose();
export type Narration = z.infer<typeof Narration>;

/**
 * Join keys, in the clear, present only when the engine runs with
 * `TELEMETRY_CORRELATION` on. Absent on a third-party report, and the corpus
 * must stay useful without it.
 */
export const Correlation = z
  .object({
    session_id: z.string(),
    transaction_id: z.string().optional(),
  })
  .loose();
export type Correlation = z.infer<typeof Correlation>;

export const IssueReport = z
  .object({
    /**
     * Defaulted, not required.
     *
     * Nothing in the corpus keys on it — the fingerprint is built from the
     * build and the incident, the ledger `_id` from install/report/timestamp —
     * so a report that omits it is still completely usable. Requiring it would
     * make the one field describing *how to read the rest* the single field
     * capable of rejecting the whole report, which is exactly backwards. `0`
     * reads as "pre-versioned or unstated".
     */
    schema_version: z.number().default(0),
    report_id: z.string().min(1),
    generated_at: z.string().min(1),
    install_id: z.string().min(1),

    build: z
      .object({
        domain: z.string().default("unknown"),
        version: z.string().default("unknown"),
        usecase: z.string().optional(),
      })
      .loose(),
    mock_role: z.string().default("unknown"),

    flow_id: z.string().default("unknown"),
    attempt: z.number().default(1),

    incident: z
      .object({
        trigger: z.string(),
        code: z.string(),
        step_key: z.string().optional(),
        action: z.string().optional(),
        occurrences: z.number().default(1),
        state: z.string(),
        duration_ms: z.number().optional(),
      })
      .loose(),

    evidence: IncidentEvidence.default({}),

    journal: z
      .array(
        z
          .object({
            seq: z.number(),
            kind: z.string(),
            action: z.string().optional(),
            ack: z.string().optional(),
            nack_code: z.string().optional(),
            summary: z.string().default(""),
          })
          .loose(),
      )
      .default([]),

    /** `null`, not absent, when the model never answered. The distinction matters. */
    narration: Narration.nullish(),

    correlation: Correlation.optional(),
  })
  .loose();
export type IssueReport = z.infer<typeof IssueReport>;

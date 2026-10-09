import { createHash } from "node:crypto";
import type { IncidentDoc } from "@/mcp/modules/corpus/corpus.schema.js";
import { isRecovered, type IssueReport } from "@/mcp/modules/ingest/report.schema.js";

/**
 * Rendering one incident as a human-readable summary.
 *
 * **Nothing files this anywhere.** It is a paste-ready write-up shown in the
 * UI's Summary tab; this service has no issue tracker and makes no outbound
 * calls. It was the GitHub issue renderer until sync was removed, and the body
 * format is kept verbatim from that — see below for why that still matters.
 *
 * Pure functions, no I/O — this is the file that can be wrong in a way nothing
 * downstream catches, so it is the file with the tests.
 *
 * ## The body is a contract, not prose
 *
 * `../winx-2.0/src/issue.ts#templateFields` parses an issue body by scanning
 * `## Heading` sections and `**Bold:** value` lines into a field map, and
 * `extractFacts` then reads `domain`, `version` and `scenario name` out of it to
 * rank the `draft-*` branches of `ONDC-Official/automation-specifications`
 * (`rankBranches`). So a body pasted into an issue by hand routes straight into
 * `winx issue <n>` and on to `winx pr`.
 *
 * That hand-off matters **more** now, not less: pasting is the only route to
 * winx left. Which is the whole reason the header fields below are bold
 * key/value lines rather than a table: **a markdown table is invisible to
 * `templateFields`.** Changing them to look nicer silently breaks the hand-off,
 * and nothing fails loudly when it does — `rankBranches` just returns a worse
 * guess.
 */

/** Bounds, so one pathological report cannot produce a 400KB body. */
const MAX_FINDINGS = 15;
const MAX_JOURNAL = 25;
const MAX_RUNNER_LOGS = 20;
const MAX_ATTEMPTED = 12;
const MAX_CELL = 300;

export interface RenderedSummary {
  title: string;
  body: string;
  labels: string[];
  /** sha256 of the body, so an unchanged render is never written back. */
  bodyHash: string;
}

/* -------------------------------------------------------------------------- */
/* Title                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * `[ONDC:TRV11 2.0.0] search2_METRO_201 · search — INVALID_BPP_URI`
 *
 * Domain and version lead because `extractFacts` weights the title above the
 * body for both, and because that is the first thing a human filters on.
 */
export function renderTitle(incident: IncidentDoc): string {
  const where = incident.step_key ?? incident.action ?? incident.trigger;
  return `[${incident.domain} ${incident.version}] ${incident.flow_id} · ${where} — ${incident.code}`;
}

/* -------------------------------------------------------------------------- */
/* Labels                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Labels are the machine-readable half of the summary.
 *
 * `status/*` is deliberately **not** rendered here: triage status is authored by
 * an operator and lives on the incident document, so a render — which happens on
 * every read of the detail view — must never restate it as though it were a
 * derived fact. Only facts computed from the corpus are labels this file owns.
 */
export function renderLabels(incident: IncidentDoc): string[] {
  const labels = [
    "auto-reported",
    `trigger/${incident.trigger}`,
    `state/${incident.latest_state}`,
    `domain/${incident.domain}`,
  ];

  const causes = incident.suspected_causes.filter(
    (cause) => cause !== "unknown",
  );
  for (const cause of causes) labels.push(`cause/${cause}`);

  // The one finding that is actionable outside these repos: a *published*
  // config is broken and someone had to patch around it to get moving.
  if (incident.state_counts["RECOVERED_WITH_OVERRIDE"] !== undefined) {
    labels.push("upstream-config-defect");
  }

  return [...new Set(labels)];
}

/* -------------------------------------------------------------------------- */
/* Body                                                                        */
/* -------------------------------------------------------------------------- */

export function renderSummary(
  incident: IncidentDoc,
  report: IssueReport | undefined,
): RenderedSummary {
  const title = renderTitle(incident);
  const body = renderBody(incident, report);
  return {
    title,
    body,
    labels: renderLabels(incident),
    bodyHash: hashBody(body),
  };
}

export function hashBody(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

function renderBody(
  incident: IncidentDoc,
  report: IssueReport | undefined,
): string {
  const sections: string[] = [
    header(incident),
    summary(incident),
    ...(report ? evidenceSections(report) : []),
    ...(report?.narration ? [narration(report.narration)] : []),
    footer(incident),
  ];
  return sections.filter((section) => section.length > 0).join("\n\n");
}

/**
 * The winx-parseable header.
 *
 * **The colon goes outside the bold markers.** winx matches
 * `/^\s*\*\*(.+?)\*\*\s*:?\s*(.*)$/gm`, so `**Domain:** x` captures the key as
 * `"domain:"` — with the colon — and `fields.get("domain")` then returns
 * `undefined`. The issue still *looks* correct to a human, `extractFacts` falls
 * back to scraping the title and body, and `rankBranches` quietly returns a
 * worse guess. Nothing anywhere fails. `incident.body.test.ts` runs winx's real
 * parser over this output for exactly that reason.
 *
 * `Scenario name` is the key `extractFacts` reads the flow under — not `Flow`,
 * which it ignores entirely.
 */
function header(incident: IncidentDoc): string {
  const lines = [
    `**Domain**: ${incident.domain}`,
    `**Version**: ${incident.version}`,
    `**Scenario name**: ${incident.flow_id}`,
  ];
  if (incident.usecase !== undefined) {
    lines.push(`**Usecase**: ${incident.usecase}`);
  }
  if (incident.action !== undefined) {
    lines.push(`**Action**: ${incident.action}`);
  }
  if (incident.step_key !== undefined) {
    lines.push(`**Step**: ${incident.step_key}`);
  }
  return lines.join("\n");
}

function summary(incident: IncidentDoc): string {
  const runs = incident.distinct_runs;
  const installs = incident.install_ids.length;
  const rows = [
    ["Trigger", incident.trigger],
    ["Code", `\`${incident.code}\``],
    ["Latest state", incident.latest_state],
    ["Occurrences", String(incident.occurrences_total)],
    ["Distinct runs", String(runs)],
    ["Installations", String(installs)],
    ["First seen", incident.first_seen_at],
    ["Last seen", incident.last_seen_at],
  ];

  const table = [
    "| | |",
    "| --- | --- |",
    ...rows.map(([key, value]) => `| ${key} | ${value} |`),
  ].join("\n");

  return `## What failed\n\n${table}\n\n${verdictLine(incident)}`;
}

/**
 * One sentence saying whether anybody should act on this.
 *
 * The corpus's most valuable distinction, stated in prose because the person
 * reading the issue is deciding whether to open the flow config at all.
 */
function verdictLine(incident: IncidentDoc): string {
  if (incident.state_counts["RECOVERED_WITH_OVERRIDE"] !== undefined) {
    return (
      "> A run got past this **only with `payload_overrides`** — the published " +
      "flow config produced a payload that could not be sent as generated. " +
      "That is a defect upstream of both this dashboard and the engine."
    );
  }
  if (isRecovered(incident.latest_state)) {
    return "> The latest run recovered from this without an override.";
  }
  if (incident.latest_state === "ABANDONED") {
    return "> The run was abandoned here. Nobody got past it.";
  }
  return "> Still open at last sighting.";
}

function evidenceSections(report: IssueReport): string[] {
  const sections: string[] = [];
  const evidence = report.evidence;

  if (evidence.message !== undefined && evidence.message.length > 0) {
    sections.push(`## Message\n\n\`\`\`\n${clip(evidence.message, 2000)}\n\`\`\``);
  }

  const findings = evidence.findings ?? [];
  if (findings.length > 0) {
    const shown = findings.slice(0, MAX_FINDINGS);
    // `layer`, `code` and `json_path` are kept verbatim by the engine's
    // redaction precisely so they can be read and acted on; only `message` was
    // scrubbed. So this table is safe to render as-is.
    const table = [
      "| Layer | Code | Path | Message |",
      "| --- | --- | --- | --- |",
      ...shown.map(
        (finding) =>
          `| ${finding.layer} | \`${finding.code}\` | \`${finding.json_path}\` | ${cell(finding.message)} |`,
      ),
    ].join("\n");
    const more =
      findings.length > shown.length
        ? `\n\n_… and ${findings.length - shown.length} more._`
        : "";
    sections.push(`## Validation findings\n\n${table}${more}`);
  }

  if (evidence.sequence !== undefined) {
    const seq = evidence.sequence;
    const lines = [
      seq.expected_action !== undefined &&
        `- expected action: \`${seq.expected_action}\``,
      seq.expected_step_key !== undefined &&
        `- expected step: \`${seq.expected_step_key}\``,
      seq.received_action !== undefined &&
        `- received action: \`${seq.received_action}\``,
      seq.missed_steps !== undefined &&
        seq.missed_steps.length > 0 &&
        `- missed steps: ${seq.missed_steps.map((step) => `\`${step}\``).join(", ")}`,
    ].filter((line): line is string => typeof line === "string");
    if (lines.length > 0) {
      sections.push(`## Sequence\n\n${lines.join("\n")}`);
    }
  }

  const runnerLogs = evidence.runner_logs ?? [];
  if (runnerLogs.length > 0 || evidence.runner_stack !== undefined) {
    const parts: string[] = [];
    if (runnerLogs.length > 0) {
      parts.push(
        `\`\`\`\n${runnerLogs.slice(-MAX_RUNNER_LOGS).join("\n")}\n\`\`\``,
      );
    }
    if (evidence.runner_stack !== undefined) {
      parts.push(`\`\`\`\n${clip(evidence.runner_stack, 3000)}\n\`\`\``);
    }
    // Collapsed: this is the detail you want present and not in your way.
    sections.push(
      `<details><summary>Sandbox output from the flow's own <code>generate</code> / <code>validate</code></summary>\n\n${parts.join("\n\n")}\n\n</details>`,
    );
  }

  const delivery = [
    evidence.delivery !== undefined && `- delivery: \`${evidence.delivery}\``,
    evidence.http_status !== undefined && `- http status: ${evidence.http_status}`,
    evidence.ack !== undefined && `- ack: \`${evidence.ack}\``,
    evidence.error_codes !== undefined &&
      evidence.error_codes.length > 0 &&
      `- error codes: ${evidence.error_codes.map((code) => `\`${code}\``).join(", ")}`,
  ].filter((line): line is string => typeof line === "string");
  if (delivery.length > 0) {
    sections.push(`## Transport\n\n${delivery.join("\n")}`);
  }

  const journal = report.journal ?? [];
  if (journal.length > 0) {
    const shown = journal.slice(-MAX_JOURNAL);
    const table = [
      "| seq | kind | action | ack | summary |",
      "| --- | --- | --- | --- | --- |",
      ...shown.map(
        (entry) =>
          `| ${entry.seq} | ${entry.kind} | ${entry.action ?? ""} | ${entry.nack_code ?? entry.ack ?? ""} | ${cell(entry.summary)} |`,
      ),
    ].join("\n");
    sections.push(
      `<details><summary>Session journal (last ${shown.length})</summary>\n\n${table}\n\n</details>`,
    );
  }

  if (evidence.payload_shape !== undefined) {
    // Structuralised by the engine: keys and types survive, no value does.
    sections.push(
      `<details><summary>Payload shape</summary>\n\n\`\`\`json\n${clip(
        JSON.stringify(evidence.payload_shape, null, 2),
        6000,
      )}\n\`\`\`\n\n</details>`,
    );
  }

  return sections;
}

function narration(n: NonNullable<IssueReport["narration"]>): string {
  const attempted = n.attempted
    .slice(0, MAX_ATTEMPTED)
    .map((step, index) => `${index + 1}. ${step}`)
    .join("\n");

  const lines = [
    `**Diagnosis:** ${n.diagnosis}`,
    `**Outcome:** ${n.outcome}`,
    `**Suspected cause:** ${n.suspected_cause}`,
  ];
  if (n.tooling_gap !== undefined && n.tooling_gap.length > 0) {
    lines.push(`**Tooling gap:** ${n.tooling_gap}`);
  }

  const attemptedBlock =
    attempted.length > 0 ? `\n\n**What was tried**\n\n${attempted}` : "";

  return `## Model narration\n\n${lines.join("\n\n")}${attemptedBlock}`;
}

function footer(incident: IncidentDoc): string {
  return (
    `---\n\n` +
    `<sub>Filed automatically from the automation-mcp incident corpus. ` +
    `Fingerprint \`${incident._id.slice(0, 16)}\`. ` +
    `Identifiers are pseudonymised; payload values are replaced by type tokens.</sub>`
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function clip(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit)}…`;
}

/**
 * Make a string safe inside a markdown table cell.
 *
 * A literal `|` ends the cell and a newline ends the row, so an unescaped
 * validator message silently mangles every column to its right.
 */
function cell(value: string): string {
  return clip(value, MAX_CELL)
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

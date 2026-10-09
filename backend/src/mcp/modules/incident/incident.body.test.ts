import { describe, expect, it } from "vitest";
import type { IssueReport } from "@/mcp/modules/ingest/report.schema.js";
import {
  hashBody,
  renderSummary,
  renderLabels,
  renderTitle,
} from "@/mcp/modules/incident/incident.body.js";
import { makeIncident } from "@/mcp/test/fixtures.js";

/* -------------------------------------------------------------------------- */
/* winx's parser, reimplemented verbatim                                       */
/* -------------------------------------------------------------------------- */

/**
 * A copy of `../winx-2.0/src/issue.ts#templateFields`.
 *
 * Copied rather than imported on purpose: winx is a separate project with its
 * own release cycle, and the thing under test is *our body still satisfying its
 * parser*. If winx changes its parser, this copy going stale is exactly the
 * signal we want — a green test here plus a broken hand-off there is a far
 * worse failure than a diff someone has to reconcile.
 */
function templateFields(body: string): Map<string, string> {
  const fields = new Map<string, string>();
  const headingRe = /^#{2,4}\s*(.+?)\s*$/gm;
  const headings: { name: string; start: number; end: number }[] = [];
  for (const m of body.matchAll(headingRe)) {
    if (m.index === undefined || !m[1]) continue;
    headings.push({ name: m[1], start: m.index, end: m.index + m[0].length });
  }
  headings.forEach((h, i) => {
    const stop = headings[i + 1]?.start ?? body.length;
    fields.set(h.name.toLowerCase().trim(), body.slice(h.end, stop).trim());
  });
  for (const m of body.matchAll(/^\s*\*\*(.+?)\*\*\s*:?\s*(.*)$/gm)) {
    const name = m[1]?.toLowerCase().trim();
    const value = (m[2] ?? "").trim();
    if (name && value && !fields.has(name)) fields.set(name, value);
  }
  for (const [k, v] of [...fields]) {
    if (!v || /^_?no response_?$/i.test(v)) fields.delete(k);
  }
  return fields;
}

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                    */
/* -------------------------------------------------------------------------- */

const incident = makeIncident;

function report(overrides: Partial<IssueReport> = {}): IssueReport {
  return {
    schema_version: 1,
    report_id: "inc_1",
    generated_at: "2026-08-01T12:00:00.000Z",
    install_id: "inst_abc123456789",
    build: { domain: "ONDC:TRV11", version: "2.0.0", usecase: "METRO" },
    mock_role: "BAP",
    flow_id: "search2_METRO_201",
    attempt: 1,
    incident: {
      trigger: "VALIDATION_FINDINGS",
      code: "INVALID_BPP_URI",
      step_key: "search2",
      action: "search",
      occurrences: 3,
      state: "OPEN",
    },
    evidence: {
      message: "generate produced a payload the gate refused",
      findings: [
        {
          layer: "L1",
          code: "INVALID_BPP_URI",
          json_path: "$.context.bpp_uri",
          message: "expected string, got array",
        },
      ],
      runner_logs: ["assigning bppUri", "done"],
    },
    journal: [
      {
        seq: 4,
        kind: "OUTBOUND_SENT",
        action: "search",
        ack: "NACK",
        nack_code: "VALIDATION_ERROR",
        summary: "sent search to np_deadbeef0000",
      },
    ],
    narration: {
      diagnosis: "The published config assigns bppUri without an index.",
      attempted: ["re-ran generate", "inspected with dry_run"],
      outcome: "worked_around",
      suspected_cause: "flow_config",
      tooling_gap: "a way to see the generated payload before the gate",
      at: "2026-08-01T12:00:01.000Z",
    },
    ...overrides,
  } as IssueReport;
}

/* -------------------------------------------------------------------------- */
/* The contract that breaks silently                                           */
/* -------------------------------------------------------------------------- */

describe("the winx hand-off", () => {
  it("emits the exact template fields extractFacts reads", () => {
    const { body } = renderSummary(incident(), report());
    const fields = templateFields(body);

    // These three keys are what `extractFacts` reads to rank draft-* branches.
    // A markdown table instead of bold key/value lines would make all three
    // vanish and nothing would fail loudly.
    expect(fields.get("domain")).toBe("ONDC:TRV11");
    expect(fields.get("version")).toBe("2.0.0");
    expect(fields.get("scenario name")).toBe("search2_METRO_201");
  });

  it("keeps the domain and version parseable out of the title too", () => {
    // extractFacts weights the title above the body for both.
    const title = renderTitle(incident());
    expect(title).toContain("ONDC:TRV11");
    expect(title).toContain("2.0.0");
    expect(title).toContain("search2_METRO_201");
  });

  it("survives an incident with no step_key, action or usecase", () => {
    const { body, title } = renderSummary(
      incident({ step_key: undefined, action: undefined, usecase: undefined }),
      report(),
    );
    const fields = templateFields(body);
    expect(fields.get("domain")).toBe("ONDC:TRV11");
    expect(fields.get("scenario name")).toBe("search2_METRO_201");
    // Falls back to the trigger rather than rendering "undefined".
    expect(title).toContain("VALIDATION_FINDINGS");
    expect(title).not.toContain("undefined");
  });
});

describe("body rendering", () => {
  it("is stable — the same input hashes the same, so no-op writes are skipped", () => {
    const a = renderSummary(incident(), report());
    const b = renderSummary(incident(), report());
    expect(a.bodyHash).toBe(b.bodyHash);
    expect(a.bodyHash).toBe(hashBody(a.body));
  });

  it("changes its hash when the corpus moves on", () => {
    const before = renderSummary(incident(), report());
    const after = renderSummary(incident({ occurrences_total: 8 }), report());
    expect(after.bodyHash).not.toBe(before.bodyHash);
  });

  it("escapes pipes and newlines so a validator message cannot mangle the table", () => {
    const { body } = renderSummary(
      incident(),
      report({
        evidence: {
          findings: [
            {
              layer: "L1",
              code: "X",
              json_path: "$.a",
              message: "got a | b\nand more",
            },
          ],
        },
      } as Partial<IssueReport>),
    );
    const row = body
      .split("\n")
      .find((line) => line.includes("`$.a`") && line.startsWith("|"));
    expect(row).toBeDefined();
    expect(row).toContain("\\|");
    // The row must remain a single line, or every column right of it shifts.
    expect(row).toContain("and more");
  });

  it("renders without a report at all", () => {
    const { body } = renderSummary(incident(), undefined);
    expect(templateFields(body).get("domain")).toBe("ONDC:TRV11");
    expect(body).toContain("What failed");
  });

  it("says plainly when a published config had to be worked around", () => {
    const { body } = renderSummary(
      incident({
        latest_state: "RECOVERED_WITH_OVERRIDE",
        state_counts: { RECOVERED_WITH_OVERRIDE: 2 },
      }),
      report(),
    );
    expect(body).toContain("payload_overrides");
    expect(body).toContain("defect upstream");
  });

  it("carries the narration, including the tooling gap", () => {
    const { body } = renderSummary(incident(), report());
    expect(body).toContain("The published config assigns bppUri");
    expect(body).toContain("a way to see the generated payload before the gate");
  });
});

describe("labels", () => {
  it("derives facts, never status", () => {
    const labels = renderLabels(incident());
    expect(labels).toContain("trigger/VALIDATION_FINDINGS");
    expect(labels).toContain("state/OPEN");
    expect(labels).toContain("domain/ONDC:TRV11");
    expect(labels).toContain("cause/flow_config");
    // Status is authored by an operator and lives on the incident. A render
    // happens on every read of the detail view, so restating it here would
    // present a decision as though it were a derived fact.
    expect(labels.some((label) => label.startsWith("status/"))).toBe(false);
  });

  it("flags an upstream config defect distinctly from a plain recovery", () => {
    expect(
      renderLabels(incident({ state_counts: { RECOVERED_WITH_OVERRIDE: 1 } })),
    ).toContain("upstream-config-defect");
    expect(
      renderLabels(incident({ state_counts: { RECOVERED: 1 } })),
    ).not.toContain("upstream-config-defect");
  });

  it("drops an unknown cause rather than labelling it", () => {
    expect(renderLabels(incident({ suspected_causes: ["unknown"] }))).not.toContain(
      "cause/unknown",
    );
  });
});

import type { PromUnit } from "@/components/PromChart";

/** One metrics panel. `PromChart` takes these as flat props. */
export interface IPromPanel {
  title: string;
  description?: string;
  /** PromQL. Grafana macros (`$__range`) are not expanded — write it out. */
  query: string;
  unit?: PromUnit;
}

/**
 * A new metrics panel is a new entry here — never new recharts code.
 * The metric names are the ones automation-mcp and this dashboard actually
 * export; they match `grafana/dashboards/engine-health.json` so the two views
 * cannot drift apart.
 */
export const PANELS: IPromPanel[] = [
  {
    title: "Inbound calls by action",
    description: "Per-second rate of callbacks the mock received, by action",
    query: "sum by (action) (rate(ondc_inbound_calls_total[5m]))",
  },
  {
    title: "Inbound NACK rate",
    description: "Share of inbound calls the receiver refused",
    query:
      'sum(rate(ondc_inbound_calls_total{ack="NACK"}[5m])) / clamp_min(sum(rate(ondc_inbound_calls_total[5m])), 1e-9)',
    unit: "percent",
  },
  {
    title: "ACK window p99",
    description: "How long the receiver held the participant's connection",
    query:
      "histogram_quantile(0.99, sum by (le) (rate(ondc_inbound_duration_seconds_bucket[5m])))",
    unit: "seconds",
  },
  {
    title: "Flow runs by status",
    description: "Runs entering each terminal and non-terminal status",
    query: "sum by (status) (rate(ondc_flow_runs_total[10m]))",
  },
  {
    title: "Validation findings by layer",
    description: "L0 schema vs L1 contextual findings",
    query: "sum by (layer) (rate(ondc_validation_findings_total[10m]))",
  },
  {
    title: "Outbound send failures",
    description:
      "`unreachable` means the step is still owed; `uncertain` means it may have landed",
    query:
      'sum by (outcome) (increase(ondc_outbound_sends_total{outcome=~"unreachable|uncertain"}[5m]))',
  },
];

/**
 * The recovery breakdown, in the order it reads as a sentence.
 * `recovered_with_override` is deliberately its own segment: it says a
 * *published* config was broken and the model patched around it, which is a
 * different finding from the model simply having been wrong.
 */
export const RECOVERY_SEGMENTS = [
  {
    key: "recovered",
    label: "Recovered",
    tone: "ok",
    hint: "The model was wrong, then was not",
  },
  {
    key: "recovered_with_override",
    label: "Recovered with override",
    tone: "warn",
    hint: "Got past a defect in a published config by patching the payload",
  },
  {
    key: "open",
    label: "Open",
    tone: "info",
    hint: "Still being triaged",
  },
  {
    key: "unresolved",
    label: "Unresolved",
    tone: "neutral",
    hint: "Seen again after the last attempt",
  },
  {
    key: "abandoned",
    label: "Abandoned",
    tone: "error",
    hint: "The run gave up here",
  },
] as const;

export const FACETS = [
  { key: "by_trigger", label: "By trigger" },
  { key: "by_state", label: "By state" },
  { key: "by_domain", label: "By domain" },
  { key: "by_status", label: "By triage status" },
] as const;

/** Facet bars past this are noise on a dashboard. */
export const FACET_LIMIT = 8;

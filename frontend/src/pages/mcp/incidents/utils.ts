import type { BadgeTone } from "@/components/Badge";
import { ANY, DEFAULT_LIMIT } from "@/pages/mcp/incidents/constants";
import type {
  IncidentListQuery,
  IncidentSort,
  IssueReport,
} from "@/services/types";

export interface ReportsFilterForm {
  domain: string;
  version: string;
  flow_id: string;
  trigger: string;
  state: string;
  status: string;
  suppressed: string;
  narrated: string;
  since: string;
  search: string;
  sort: string;
  limit: string;
}

const SORTS: IncidentSort[] = [
  "last_seen",
  "first_seen",
  "occurrences",
  "runs",
];

const asSort = (value: string | null): IncidentSort =>
  SORTS.includes(value as IncidentSort) ? (value as IncidentSort) : "last_seen";

/** The URL is the filter state, so a facet link from Overview lands filtered. */
export const formFromSearchParams = (
  params: URLSearchParams,
): ReportsFilterForm => ({
  domain: params.get("domain") ?? "",
  version: params.get("version") ?? "",
  flow_id: params.get("flow_id") ?? "",
  trigger: params.get("trigger") ?? ANY,
  state: params.get("state") ?? ANY,
  status: params.get("status") ?? ANY,
  suppressed: params.get("suppressed") ?? ANY,
  narrated: params.get("narrated") ?? ANY,
  since: params.get("since") ?? "",
  search: params.get("search") ?? "",
  sort: asSort(params.get("sort")),
  limit: params.get("limit") ?? String(DEFAULT_LIMIT),
});

const text = (value: string) => (value.trim() ? value.trim() : undefined);
const choice = (value: string) => (value === ANY ? undefined : value);
const flag = (value: string) => (value === ANY ? undefined : value === "true");

export const toQuery = (
  form: ReportsFilterForm,
  skip: number,
): IncidentListQuery => ({
  ...(text(form.domain) !== undefined ? { domain: text(form.domain) } : {}),
  ...(text(form.version) !== undefined ? { version: text(form.version) } : {}),
  ...(text(form.flow_id) !== undefined ? { flow_id: text(form.flow_id) } : {}),
  ...(choice(form.trigger) !== undefined
    ? { trigger: choice(form.trigger) }
    : {}),
  ...(choice(form.state) !== undefined ? { state: choice(form.state) } : {}),
  ...(choice(form.status) !== undefined ? { status: choice(form.status) } : {}),
  ...(flag(form.suppressed) !== undefined
    ? { suppressed: flag(form.suppressed) }
    : {}),
  ...(flag(form.narrated) !== undefined
    ? { narrated: flag(form.narrated) }
    : {}),
  ...(text(form.since) !== undefined ? { since: text(form.since) } : {}),
  ...(text(form.search) !== undefined ? { search: text(form.search) } : {}),
  sort: asSort(form.sort),
  limit: Number(form.limit) || DEFAULT_LIMIT,
  skip,
});

/** Only the fields that differ from the default reach the URL. */
export const searchParamsFromForm = (
  form: ReportsFilterForm,
): URLSearchParams => {
  const params = new URLSearchParams();
  const put = (key: string, value: string | undefined) => {
    if (value !== undefined && value !== "" && value !== ANY) {
      params.set(key, value);
    }
  };
  put("domain", form.domain.trim());
  put("version", form.version.trim());
  put("flow_id", form.flow_id.trim());
  put("trigger", form.trigger);
  put("state", form.state);
  put("status", form.status);
  put("suppressed", form.suppressed);
  put("narrated", form.narrated);
  put("since", form.since.trim());
  put("search", form.search.trim());
  if (form.sort !== "last_seen") put("sort", form.sort);
  if (form.limit !== String(DEFAULT_LIMIT)) put("limit", form.limit);
  return params;
};

/* -------------------------------------------------------------------------- */
/* Tones                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * `RECOVERED_WITH_OVERRIDE` is amber, not emerald, and that is the point: the
 * run got past it only by patching a published config, which is somebody
 * else's bug still standing.
 */
export const stateTone = (state: string): BadgeTone => {
  switch (state.toUpperCase()) {
    case "RECOVERED":
      return "ok";
    case "RECOVERED_WITH_OVERRIDE":
      return "warn";
    case "ABANDONED":
      return "error";
    case "UNRESOLVED":
      return "error";
    case "OPEN":
      return "info";
    default:
      return "neutral";
  }
};

export const triageTone = (status: string): BadgeTone => {
  switch (status.toLowerCase()) {
    case "fixed":
      return "ok";
    case "wontfix":
      return "neutral";
    case "in_progress":
    case "planned":
      return "info";
    case "triaged":
      return "warn";
    case "new":
      return "error";
    default:
      return "neutral";
  }
};

export const triggerTone = (trigger: string): BadgeTone => {
  switch (trigger.toUpperCase()) {
    case "VALIDATION_UNAVAILABLE":
    case "AWAIT_TIMEOUT":
      return "warn";
    case "INFRA_ERROR":
    case "SEND_FAILED":
    case "RUN_ABANDONED":
      return "error";
    case "CONFIG_DEFECT":
      return "info";
    default:
      return "neutral";
  }
};

export const findingTone = (layer: string): BadgeTone =>
  layer.toUpperCase() === "L0" ? "error" : "warn";

/* -------------------------------------------------------------------------- */
/* The raw report                                                               */
/* -------------------------------------------------------------------------- */

/**
 * `latest_report` is `unknown` on the wire because ingest parses leniently. We
 * narrow it structurally rather than trusting it: a report written by a newer
 * engine must still render everything we *do* understand.
 */
export const asIssueReport = (value: unknown): Partial<IssueReport> | null =>
  typeof value === "object" && value !== null
    ? (value as Partial<IssueReport>)
    : null;

export const pagesFor = (total: number, limit: number) =>
  limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;

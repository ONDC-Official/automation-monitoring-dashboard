import type { BadgeTone } from "@/components/Badge";
import type { FacetBucket } from "@/services/types";

/** Bar width as a percentage of the largest bucket, floored so 1 is visible. */
export const facetWidth = (count: number, max: number) =>
  max <= 0 ? 0 : Math.max(2, Math.round((count / max) * 100));

export const topBuckets = (buckets: FacetBucket[], limit: number) =>
  [...buckets].sort((a, b) => b.count - a.count).slice(0, limit);

export const bucketMax = (buckets: FacetBucket[]) =>
  buckets.reduce((max, bucket) => Math.max(max, bucket.count), 0);

/**
 * Triage status → the fixed palette. Anything unresolved and unowned is amber
 * rather than red: it is a backlog, not an outage.
 */
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

export const segmentClass = (tone: string) => {
  switch (tone) {
    case "ok":
      return "bg-status-ok";
    case "warn":
      return "bg-status-warn";
    case "error":
      return "bg-status-error";
    case "info":
      return "bg-primary";
    default:
      return "bg-status-idle";
  }
};

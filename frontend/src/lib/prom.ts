import type { PromMatrixResult, PromRangeResponse } from "@/services/types";

export interface PromSeries {
  /** The key each row stores this series' value under. */
  key: string;
  /** What the legend shows. */
  name: string;
}

export interface PromChartData {
  rows: Array<Record<string, number>>;
  series: PromSeries[];
}

/** `{action="search", le="0.5"}` → `action=search · le=0.5`, minus `__name__`. */
export const seriesName = (result: PromMatrixResult, index: number) => {
  const labels = Object.entries(result.metric).filter(
    ([key]) => key !== "__name__",
  );
  if (labels.length === 0) {
    return result.metric.__name__ ?? `series ${index + 1}`;
  }
  return labels.map(([key, value]) => `${key}=${value}`).join(" · ");
};

/**
 * Prometheus answers one array of `[ts, value]` per series; recharts wants one
 * row per timestamp with a column per series. Series are sparse — a label that
 * only appeared for part of the window leaves gaps, which recharts renders as a
 * break in the line rather than a drop to zero.
 */
export const toChartData = (
  response: PromRangeResponse | undefined,
): PromChartData => {
  const results = response?.data?.result ?? [];
  const series: PromSeries[] = results.map((result, index) => ({
    key: `s${index}`,
    name: seriesName(result, index),
  }));

  const byTimestamp = new Map<number, Record<string, number>>();
  results.forEach((result, index) => {
    for (const [timestamp, raw] of result.values) {
      const row = byTimestamp.get(timestamp) ?? { t: timestamp };
      const value = Number(raw);
      if (!Number.isNaN(value)) row[`s${index}`] = value;
      byTimestamp.set(timestamp, row);
    }
  });

  const rows = [...byTimestamp.values()].sort(
    (a, b) => (a.t ?? 0) - (b.t ?? 0),
  );
  return { rows, series };
};

/** Chart tokens, in order. Five is the palette; a sixth series wraps. */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export const chartColor = (index: number) =>
  CHART_COLORS[index % CHART_COLORS.length] as string;

/** Axis ticks: seconds are noise at an hour's range, dates are noise at all. */
export const formatAxisTime = (timestamp: number) =>
  new Date(timestamp * 1_000).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });

export const formatMetricValue = (value: number) => {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(2)}k`;
  if (abs >= 1) return value.toFixed(2);
  if (abs >= 0.001) return value.toFixed(4);
  return value.toExponential(2);
};

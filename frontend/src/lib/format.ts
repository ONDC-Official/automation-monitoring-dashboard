/** Small, framework-agnostic formatting helpers shared by more than one page. */

const NUMBER_FORMAT = new Intl.NumberFormat("en-US");

export const formatNumber = (value: number | null | undefined) =>
  value === null || value === undefined || Number.isNaN(value)
    ? "—"
    : NUMBER_FORMAT.format(value);

export const formatDateTime = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export const formatTime = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString("en-GB", { hour12: false });
};

const UNITS: Array<[limit: number, divisor: number, unit: string]> = [
  [60_000, 1_000, "s"],
  [3_600_000, 60_000, "m"],
  [86_400_000, 3_600_000, "h"],
  [Number.POSITIVE_INFINITY, 86_400_000, "d"],
];

/** "12s ago" / "in 4m" — precise enough for a wire log, cheap enough to poll. */
export const formatRelative = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const delta = Date.now() - date.getTime();
  const abs = Math.abs(delta);
  if (abs < 1_000) return "just now";
  const match = UNITS.find(([limit]) => abs < limit);
  if (!match) return iso;
  const [, divisor, unit] = match;
  const value = Math.floor(abs / divisor);
  return delta >= 0 ? `${value}${unit} ago` : `in ${value}${unit}`;
};

export const formatDuration = (seconds: number | null | undefined) => {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
    return "—";
  }
  const total = Math.floor(seconds);
  const days = Math.floor(total / 86_400);
  const hours = Math.floor((total % 86_400) / 3_600);
  const minutes = Math.floor((total % 3_600) / 60);
  const secs = total % 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

export const formatPercent = (value: number, total: number) =>
  total <= 0 ? "0%" : `${Math.round((value / total) * 100)}%`;

/** Long ids are unreadable in a table cell and useless when truncated blind. */
export const truncateMiddle = (value: string, max = 18) => {
  if (value.length <= max) return value;
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return `${value.slice(0, head)}…${value.slice(value.length - tail)}`;
};

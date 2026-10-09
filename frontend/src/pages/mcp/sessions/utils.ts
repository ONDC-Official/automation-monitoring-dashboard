/** Pure helpers for the sessions page. No React, no I/O. */

import type { BadgeTone } from "@/components/Badge";
import type { SessionRow } from "@/services/types";

/**
 * Run status is a free string on the wire — the engine's vocabulary grows
 * without asking the dashboard — so this maps what we know and answers
 * `neutral` for the rest rather than inventing a colour per new value.
 */
const RUN_STATUS_TONES: Record<string, BadgeTone> = {
  complete: "ok",
  completed: "ok",
  failed: "error",
  error: "error",
  gave_up: "error",
  abandoned: "error",
  waiting: "warn",
  input_required: "warn",
  blocked: "warn",
  pending: "warn",
};

export const runStatusTone = (status: string): BadgeTone =>
  RUN_STATUS_TONES[status.trim().toLowerCase()] ?? "neutral";

/**
 * `active` is derived by the backend from `expires_at`, because TTL expiry is
 * silent in the engine. Never re-derive it here.
 */
export const sessionTone = (active: boolean): BadgeTone =>
  active ? "ok" : "neutral";

export const sessionStateLabel = (active: boolean) =>
  active ? "active" : "expired";

/** An unparseable timestamp sorts last rather than poisoning the comparison. */
const epoch = (iso: string | null | undefined) => {
  if (!iso) return 0;
  const value = new Date(iso).getTime();
  return Number.isNaN(value) ? 0 : value;
};

/** Newest `created_at` first. Copies — never sorts the query cache in place. */
export const sortSessions = (sessions: SessionRow[]): SessionRow[] =>
  [...sessions].sort((a, b) => epoch(b.created_at) - epoch(a.created_at));

/** "TRV11 · 2.0.0" — the build a session is pinned to. */
export const formatBuild = (domain: string, version: string) =>
  `${domain} · ${version}`;

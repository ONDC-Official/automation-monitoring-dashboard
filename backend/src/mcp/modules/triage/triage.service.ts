import { NotFoundError } from "@/lib/errors.js";
import type { CorpusRepositoryPort } from "@/mcp/modules/corpus/corpus.repository.js";
import type {
  IncidentDoc,
  TriageNote,
  TriageStatus,
} from "@/mcp/modules/corpus/corpus.schema.js";
import type { TriageResult } from "@/mcp/modules/query/query.schema.js";

/**
 * What an operator decided about an incident.
 *
 * ## Truth lives here, and only here
 *
 * This was a sync engine: status, comments and open/closed were authored on
 * GitHub and mirrored back, and Mongo owned only the corpus and `suppressed`.
 * That is gone. There is no external tracker, nothing is filed anywhere, and
 * every field below is authored by an operator against this database.
 *
 * The practical consequence is the one that used to bite: an action can no
 * longer half-succeed. Every method here is a write inside the request, so a
 * failure is an exception the error middleware turns into a 5xx — there is no
 * "recorded locally but not posted" state left to report, which is why
 * `TriageResult` has no `synced`.
 *
 * ## Notes are the timeline
 *
 * Free text — a status note, a comment, a fix reference, a dismissal reason —
 * used to exist only inside a GitHub issue body, which meant that with sync off
 * (the default, and how this ran in practice) it was accepted by the API and
 * discarded. `triage.notes[]` is where it lands now, and every action appends
 * one even when it carries no text: the state transition is itself the event
 * worth keeping, and `updated_at` only remembers the most recent one.
 */

export interface TriageServiceOptions {
  repository: CorpusRepositoryPort;
}

export class TriageService {
  readonly #repository: CorpusRepositoryPort;

  constructor(options: TriageServiceOptions) {
    this.#repository = options.repository;
  }

  /* --------------------------------------------------------------- actions */

  async setStatus(
    fingerprint: string,
    status: TriageStatus,
    note: string | undefined,
  ): Promise<TriageResult> {
    const incident = await this.#require(fingerprint);
    const at = new Date().toISOString();

    await this.#repository.appendTriageNote(fingerprint, {
      at,
      kind: "status",
      body: note ?? "",
      status,
    });
    await this.#repository.setTriage(fingerprint, { status, updated_at: at });

    return this.#result(
      fingerprint,
      status,
      incident,
      `Status set to ${status}.`,
    );
  }

  async comment(fingerprint: string, body: string): Promise<TriageResult> {
    const incident = await this.#require(fingerprint);
    const at = new Date().toISOString();

    await this.#repository.appendTriageNote(fingerprint, {
      at,
      kind: "comment",
      body,
    });

    return this.#result(
      fingerprint,
      incident.triage.status,
      incident,
      "Note recorded.",
    );
  }

  /**
   * Record where the fix lives, and move the incident to `in_progress`.
   *
   * Deliberately **not** routed through `comment()`, which is what it used to
   * do to borrow that method's issue-comment body. Delegating now would append
   * two notes for one action.
   */
  async linkFix(
    fingerprint: string,
    reference: string,
    note: string | undefined,
  ): Promise<TriageResult> {
    const incident = await this.#require(fingerprint);
    const at = new Date().toISOString();

    await this.#repository.appendTriageNote(fingerprint, {
      at,
      kind: "link",
      body: note ?? "",
      reference,
    });
    await this.#repository.setTriage(fingerprint, {
      status: "in_progress",
      updated_at: at,
    });

    return this.#result(fingerprint, "in_progress", incident, "Fix linked.");
  }

  /**
   * Stop this fingerprint appearing in the queue, without losing what it recorded.
   *
   * This is the "delete" the surface offers, and it is a suppression rather
   * than a deletion on purpose: the reports stay, the counts stay, and a later
   * recurrence still shows up in the corpus. What stops is the noise.
   */
  async dismiss(fingerprint: string, reason: string): Promise<TriageResult> {
    const incident = await this.#require(fingerprint);
    const at = new Date().toISOString();

    await this.#repository.appendTriageNote(fingerprint, {
      at,
      kind: "dismiss",
      body: reason,
    });
    await this.#repository.setSuppressed(fingerprint, true);
    await this.#repository.setTriage(fingerprint, {
      status: "wontfix",
      resolution: "not_planned",
      updated_at: at,
    });

    return this.#result(
      fingerprint,
      "wontfix",
      incident,
      "Suppressed — future occurrences are recorded but stay out of the queue.",
    );
  }

  /* --------------------------------------------------------------- helpers */

  async #require(fingerprint: string): Promise<IncidentDoc> {
    const incident = await this.#repository.findIncident(fingerprint);
    if (incident === undefined) {
      throw new NotFoundError(`no incident with fingerprint ${fingerprint}`);
    }
    return incident;
  }

  /**
   * `notes` counts the incident as the caller now leaves it — the one it read,
   * plus the one this action appended.
   *
   * Read off the incident rather than re-fetched: a second round trip to report
   * a number would be a read the action does not otherwise need, and every
   * document predating `triage.notes[]` is missing the key entirely, so the
   * `?? []` is load-bearing rather than defensive.
   */
  #result(
    fingerprint: string,
    status: string,
    incident: IncidentDoc,
    message: string,
  ): TriageResult {
    return {
      fingerprint,
      status,
      notes: (incident.triage.notes ?? []).length + 1,
      message,
    };
  }
}

export type { TriageNote };

import { beforeEach, describe, expect, it } from "vitest";
import { NotFoundError } from "@/lib/errors.js";
import { toReportDoc } from "@/mcp/modules/ingest/ingest.service.js";
import { TriageService } from "@/mcp/modules/triage/triage.service.js";
import { FakeCorpusRepository } from "@/mcp/test/fake-corpus-repository.js";
import { makeIncident, makeReport } from "@/mcp/test/fixtures.js";

/**
 * What an operator records has to survive the request.
 *
 * Every assertion here would have passed vacuously before GitHub sync was
 * removed — or worse, silently: with no gateway configured (the default, and
 * how this ran in production) `comment` returned "the comment was NOT posted"
 * and wrote nothing, while `setStatus` and `dismiss` discarded their free text
 * into an issue body that was never created. The API accepted all four and kept
 * roughly half of what it was given.
 *
 * Run against the fake rather than Mongo deliberately: the Mongo suite is
 * `describe.skip` without `MONGO_TEST_URL`, and the regression these cover is
 * the kind that must fail on a default `npm test`.
 */

const FP = "a".repeat(64);

describe("TriageService", () => {
  let repository: FakeCorpusRepository;
  let service: TriageService;

  beforeEach(() => {
    repository = new FakeCorpusRepository();
    repository.incidents.set(FP, makeIncident({ _id: FP }));
    service = new TriageService({ repository });
  });

  const notes = () => repository.incidents.get(FP)?.triage.notes ?? [];
  const triage = () => repository.incidents.get(FP)?.triage;

  describe("setStatus", () => {
    it("records the status and its note", async () => {
      const result = await service.setStatus(FP, "planned", "waiting on spec");

      expect(triage()?.status).toBe("planned");
      expect(notes()).toHaveLength(1);
      expect(notes()[0]).toMatchObject({
        kind: "status",
        body: "waiting on spec",
        status: "planned",
      });
      expect(result).toMatchObject({ status: "planned", notes: 1 });
    });

    it("still appends when no note was given", async () => {
      // The transition is the event worth keeping — `updated_at` only ever
      // remembers the most recent one, so without this the history is lost.
      await service.setStatus(FP, "triaged", undefined);

      expect(notes()).toHaveLength(1);
      expect(notes()[0]).toMatchObject({ kind: "status", body: "" });
    });
  });

  describe("comment", () => {
    it("persists the body, and does not claim it went nowhere", async () => {
      // The regression this whole change exists for.
      const result = await service.comment(FP, "reproduced on staging");

      expect(notes()).toHaveLength(1);
      expect(notes()[0]).toMatchObject({
        kind: "comment",
        body: "reproduced on staging",
      });
      expect(result.message).not.toMatch(/NOT posted/i);
      expect(result.message).not.toMatch(/github/i);
    });

    it("leaves the status alone", async () => {
      await service.comment(FP, "just a note");
      expect(triage()?.status).toBe("untracked");
    });
  });

  describe("linkFix", () => {
    it("appends exactly one note", async () => {
      // It used to delegate to `comment()` to borrow its issue-comment body.
      // Left that way, one action would write two notes.
      await service.linkFix(FP, "https://github.com/x/y/pull/12", "one-liner");

      expect(notes()).toHaveLength(1);
      expect(notes()[0]).toMatchObject({
        kind: "link",
        body: "one-liner",
        reference: "https://github.com/x/y/pull/12",
      });
    });

    it("moves the incident to in_progress", async () => {
      const result = await service.linkFix(FP, "abc1234", undefined);

      expect(triage()?.status).toBe("in_progress");
      expect(result.status).toBe("in_progress");
    });
  });

  describe("dismiss", () => {
    it("suppresses the fingerprint and keeps the reason", async () => {
      await service.dismiss(FP, "upstream fixed it");

      expect(repository.incidents.get(FP)?.suppressed).toBe(true);
      expect(triage()?.status).toBe("wontfix");
      expect(triage()?.resolution).toBe("not_planned");
      expect(notes()[0]).toMatchObject({
        kind: "dismiss",
        body: "upstream fixed it",
      });
    });
  });

  describe("the timeline", () => {
    it("accumulates in order, and tracks updated_at", async () => {
      await service.comment(FP, "first");
      await service.setStatus(FP, "planned", "second");
      await service.linkFix(FP, "ref", "third");
      await service.dismiss(FP, "fourth");

      expect(notes().map((note) => note.body)).toEqual([
        "first",
        "second",
        "third",
        "fourth",
      ]);
      expect(triage()?.updated_at).toBe(notes()[3]?.at);
    });

    it("survives a redelivery recomputing the incident", async () => {
      // The most destructive plausible regression of this change: an operator's
      // work erased the next time the engine reports the same fingerprint.
      //
      // A report has to exist for this to prove anything — `recomputeIncident`
      // returns early when the fingerprint has none, and the assertions below
      // would then pass against an untouched document.
      await repository.insertReport(
        toReportDoc(makeReport(), FP, "doc_1", "2026-08-02T00:00:00.000Z"),
      );

      await service.comment(FP, "keep me");
      await service.setStatus(FP, "planned", undefined);

      const recomputed = await repository.recomputeIncident(FP);
      expect(recomputed).toBeDefined();

      expect(notes()).toHaveLength(2);
      expect(notes()[0]?.body).toBe("keep me");
      expect(triage()?.status).toBe("planned");
    });
  });

  describe("an unknown fingerprint", () => {
    it.each([
      ["setStatus", (s: TriageService) => s.setStatus("nope", "new", undefined)],
      ["comment", (s: TriageService) => s.comment("nope", "hi")],
      ["linkFix", (s: TriageService) => s.linkFix("nope", "ref", undefined)],
      ["dismiss", (s: TriageService) => s.dismiss("nope", "why")],
    ])("is a NotFoundError from %s", async (_name, call) => {
      await expect(call(service)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

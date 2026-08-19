import { pino } from "pino";
import { beforeEach, describe, expect, it } from "vitest";
import { BadRequestError } from "@/lib/errors.js";
import { fingerprintOf } from "@/mcp/modules/corpus/corpus.schema.js";
import { IngestService } from "@/mcp/modules/ingest/ingest.service.js";
import { FakeCorpusRepository } from "@/mcp/test/fake-corpus-repository.js";
import { makeNarration, makeReport } from "@/mcp/test/fixtures.js";

const logger = pino({ level: "silent" });

describe("IngestService.acceptReport", () => {
  let repository: FakeCorpusRepository;
  let service: IngestService;

  beforeEach(() => {
    repository = new FakeCorpusRepository();
    service = new IngestService({ repository, logger });
  });

  it("accepts a valid report and fingerprints it", async () => {
    const report = makeReport();
    const result = await service.acceptReport(report);

    expect(result.accepted).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(result.fingerprint).toBe(fingerprintOf(report));
    expect(result.report_doc_id).toBe(
      `${report.install_id}:${report.report_id}:${report.generated_at}`,
    );

    const stored = repository.reports.get(result.report_doc_id);
    expect(stored?.domain).toBe("ONDC:TRV11");
    expect(stored?.trigger).toBe("VALIDATION_FINDINGS");
    expect(stored?.code).toBe("INVALID_BPP_URI");
    expect(stored?.step_key).toBe("search2_METRO_201_select");
    // The verbatim copy is the only answer to "what did the engine send?".
    expect(stored?.report).toEqual(report);
  });

  it("collapses the exact same delivery, and still recomputes", async () => {
    const report = makeReport();
    const first = await service.acceptReport(report);
    const second = await service.acceptReport(report);

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    // Still `accepted`: the caller asked whether the report is durable, and it
    // is. Anything else invites the engine to resend a report we already hold.
    expect(second.accepted).toBe(true);
    expect(repository.reports.size).toBe(1);
    // Recompute runs on the duplicate too — a concurrent first delivery from
    // another install may have landed in between, and nothing else would ever
    // fold it into the incident.
    expect(repository.recomputes).toEqual([
      first.fingerprint,
      first.fingerprint,
    ]);
  });

  it("makes one incident out of two deliveries of the same run", async () => {
    const at = "2026-07-31T09:00:00.000Z";
    const later = "2026-07-31T09:05:00.000Z";
    const base = makeReport({
      report_id: "inc_same_run",
      generated_at: at,
      incident: { occurrences: 3 },
    });
    // The re-flush after narration: same run, same `report_id`, new
    // `generated_at`, and `occurrences` is a running total rather than a delta.
    const narrated = makeReport({
      report_id: "inc_same_run",
      generated_at: later,
      incident: { occurrences: 5 },
      narration: makeNarration(),
    });

    await service.acceptReport(base);
    await service.acceptReport(narrated);

    expect(repository.reports.size).toBe(2);
    expect(repository.incidents.size).toBe(1);

    const incident = repository.incidents.get(fingerprintOf(base));
    expect(incident?.deliveries).toBe(2);
    expect(incident?.distinct_runs).toBe(1);
    // The peak, not the sum: 5, never 3 + 5.
    expect(incident?.occurrences_total).toBe(5);
    expect(incident?.narrated).toBe(true);
    expect(incident?.suspected_causes).toEqual(["flow_config"]);
    expect(incident?.first_seen_at).toBe(at);
    expect(incident?.last_seen_at).toBe(later);
  });

  it("keeps two different flows apart even on the same code", async () => {
    await service.acceptReport(makeReport({ flow_id: "search2_METRO_201" }));
    await service.acceptReport(makeReport({ flow_id: "confirm_METRO_301" }));
    expect(repository.incidents.size).toBe(2);
  });

  it("parses a report with no schema_version — leniency is the contract", async () => {
    // `report.schema.ts` exists to read a spool file written by a version it
    // has never seen. A missing envelope field must cost a field, not a report.
    const { schema_version: _dropped, ...withoutVersion } = makeReport();
    const result = await service.acceptReport({
      ...withoutVersion,
      // And a member of an enum this build has never heard of.
      incident: { ...makeReport().incident, trigger: "SOME_FUTURE_TRIGGER" },
    });

    expect(result.accepted).toBe(true);
    expect(repository.reports.get(result.report_doc_id)?.trigger).toBe(
      "SOME_FUTURE_TRIGGER",
    );
  });

  it("throws BadRequestError when the body cannot be keyed at all", async () => {
    await expect(
      service.acceptReport({ hello: "world" }),
    ).rejects.toBeInstanceOf(BadRequestError);
    await expect(service.acceptReport(null)).rejects.toBeInstanceOf(
      BadRequestError,
    );
    // No `incident` means no trigger and no code, so no fingerprint — a row
    // nothing could ever find again.
    const { incident: _dropped, ...withoutIncident } = makeReport();
    await expect(service.acceptReport(withoutIncident)).rejects.toBeInstanceOf(
      BadRequestError,
    );
    expect(repository.reports.size).toBe(0);
  });

  it("lifts correlation into the indexed join keys when present", async () => {
    const result = await service.acceptReport(
      makeReport({
        correlation: {
          session_id: "sess_1234",
          transaction_id: "txn_9876",
        },
      }),
    );
    const stored = repository.reports.get(result.report_doc_id);

    expect(stored?.session_id).toBe("sess_1234");
    expect(stored?.transaction_id).toBe("txn_9876");
  });

  it("leaves the join keys undefined on a third-party report", async () => {
    // No correlation mode: the corpus has to stay useful without it, and the
    // sparse index in `mongo.ts` has to stay free of nulls.
    const result = await service.acceptReport(makeReport());
    const stored = repository.reports.get(result.report_doc_id);

    expect(stored?.session_id).toBeUndefined();
    expect(stored?.transaction_id).toBeUndefined();
    expect(stored?.narrated).toBe(false);
    expect(stored?.suspected_cause).toBeUndefined();
  });

  it("pins received_at to the injected clock", async () => {
    const frozen = new Date("2026-08-17T12:00:00.000Z");
    const pinned = new IngestService({
      repository,
      logger,
      now: () => frozen,
    });
    const result = await pinned.acceptReport(makeReport());
    expect(repository.reports.get(result.report_doc_id)?.received_at).toBe(
      frozen.toISOString(),
    );
  });
});

describe("IngestService.acceptTelemetry", () => {
  let repository: FakeCorpusRepository;
  let service: IngestService;

  beforeEach(() => {
    repository = new FakeCorpusRepository();
    service = new IngestService({ repository, logger });
  });

  const envelope = {
    schema_version: 1,
    instance_id: "inst_1",
  };

  /**
   * Stamp the per-record fields the engine puts on every `MirrorRecord`.
   *
   * `install_id` lives on the record, not the envelope — see
   * `telemetry.schema.ts`. These tests originally had it the other way round,
   * which is exactly the mismatch `telemetry.contract.test.ts` now guards.
   */
  const rec = (entry: Record<string, unknown>): Record<string, unknown> => ({
    schema_version: 1,
    install_id: "install_a1b2c3",
    instance_id: "inst_1",
    ...entry,
  });

  it("absorbs sessions, runs and journal lines from one batch", async () => {
    const result = await service.acceptTelemetry({
      ...envelope,
      records: [
        rec({
          kind: "SESSION_CREATED",
          session_ref: "sref_1",
          session: {
            domain: "ONDC:TRV11",
            version: "2.0.0",
            usecase: "METRO",
            mock_role: "BAP",
            np_type: "BPP",
            subscriber_ref: "sub_1",
            callback_url: "https://mock.example/ONDC:TRV11/2.0.0/buyer",
            interaction_mode: "llm_auto",
            auto_advance: true,
            created_at: "2026-07-31T09:00:00.000Z",
            expires_at: "2026-07-31T10:00:00.000Z",
          },
        }),
        rec({
          kind: "RUN_STARTED",
          session_ref: "sref_1",
          run: {
            flow_id: "search2_METRO_201",
            attempt: 1,
            auto_advance: true,
            started_at: "2026-07-31T09:00:01.000Z",
          },
        }),
        rec({
          kind: "JOURNAL",
          session_ref: "sref_1",
          event: {
            seq: 1,
            at: "2026-07-31T09:00:02.000Z",
            kind: "OUTBOUND_SENT",
            flow_id: "search2_METRO_201",
            action: "search",
            summary: "sent search",
          },
        }),
      ],
    });

    expect(result).toMatchObject({
      accepted: true,
      sessions: 1,
      runs: 1,
      journal: 1,
      skipped: 0,
    });
    expect(repository.sessions.size).toBe(1);
    expect(
      repository.runs.get("install_a1b2c3:sref_1:search2_METRO_201:1")?.status,
    ).toBe("started");
    // A `Date`, not a string — the TTL index in `mongo.ts` only expires dates,
    // and a string would quietly keep every journal line forever.
    expect(
      repository.journal.get("install_a1b2c3:sref_1:1")?.received_at,
    ).toBeInstanceOf(Date);
  });

  it("derives run status from the journal kinds that mean something", async () => {
    await service.acceptTelemetry({
      ...envelope,
      records: [
        rec({
          kind: "RUN_STARTED",
          session_ref: "sref_1",
          run: { flow_id: "f1", attempt: 1, auto_advance: false },
        }),
        rec({
          kind: "JOURNAL",
          session_ref: "sref_1",
          event: {
            seq: 1,
            kind: "TRANSACTION_BOUND",
            flow_id: "f1",
            transaction_id: "txn_1",
            at: "2026-07-31T09:00:03.000Z",
          },
        }),
      ],
    });
    const bound = repository.runs.get("install_a1b2c3:sref_1:f1:1");
    expect(bound?.status).toBe("bound");
    expect(bound?.transaction_id).toBe("txn_1");

    await service.acceptTelemetry({
      ...envelope,
      records: [
        rec({
          kind: "JOURNAL",
          session_ref: "sref_1",
          event: { seq: 2, kind: "FLOW_COMPLETE", flow_id: "f1" },
        }),
      ],
    });
    expect(repository.runs.get("install_a1b2c3:sref_1:f1:1")?.status).toBe(
      "complete",
    );

    // A kind with no durable meaning for a run leaves the status alone rather
    // than inventing a column that changes every few seconds.
    await service.acceptTelemetry({
      ...envelope,
      records: [
        rec({
          kind: "JOURNAL",
          session_ref: "sref_1",
          event: { seq: 3, kind: "INBOUND_ACK", flow_id: "f1" },
        }),
      ],
    });
    expect(repository.runs.get("install_a1b2c3:sref_1:f1:1")?.status).toBe(
      "complete",
    );
  });

  it("skips an unreadable entry instead of losing the batch with it", async () => {
    // The mirror does not retry. One line from a future engine must never cost
    // the ninety-nine around it.
    const result = await service.acceptTelemetry({
      ...envelope,
      dropped_since_last_batch: 12,
      records: [
        { kind: "SOMETHING_NEW", session_ref: "sref_1" },
        rec({
          kind: "JOURNAL",
          session_ref: "sref_1",
          event: { seq: 7, kind: "ATTENTION" },
        }),
      ],
    });

    expect(result.skipped).toBe(1);
    expect(result.journal).toBe(1);
    expect(result.dropped_since_last_batch).toBe(12);
  });

  it("makes a resent batch a no-op", async () => {
    const batch = {
      ...envelope,
      records: [
        rec({
          kind: "JOURNAL",
          session_ref: "sref_1",
          event: { seq: 1, kind: "INBOUND_ACK" },
        }),
      ],
    };
    expect((await service.acceptTelemetry(batch)).journal).toBe(1);
    expect((await service.acceptTelemetry(batch)).journal).toBe(0);
    expect(repository.journal.size).toBe(1);
  });

  it("accepts an envelope carrying only records, since install_id is per record", async () => {
    // `install_id` used to be asserted here as a required envelope field. It is
    // not one — the engine puts it on each `MirrorRecord`, and requiring it on
    // the envelope is precisely the mismatch that would have made the mirror
    // POST, receive a 202, and fill nothing. See `telemetry.contract.test.ts`.
    await expect(
      service.acceptTelemetry({ instance_id: "inst_1", records: [] }),
    ).resolves.toMatchObject({ accepted: true, sessions: 0, skipped: 0 });
  });

  it("throws BadRequestError only when the envelope is not an envelope", async () => {
    // The one thing worth refusing. Everything softer is skipped and counted,
    // because the mirror does not retry.
    await expect(service.acceptTelemetry("not an object")).rejects.toBeInstanceOf(
      BadRequestError,
    );
  });
});

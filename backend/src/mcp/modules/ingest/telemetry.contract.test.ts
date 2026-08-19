import { pino } from "pino";
import { describe, expect, it } from "vitest";
import { IngestService } from "@/mcp/modules/ingest/ingest.service.js";
import { FakeCorpusRepository } from "@/mcp/test/fake-corpus-repository.js";

/**
 * The cross-service contract test.
 *
 * Everything else about the mirror is tested with a fake on one side or the
 * other. This posts a batch shaped **exactly** as
 * `automation-mcp/src/modules/mirror/mirror.schema.ts#MirrorBatch` emits it,
 * transcribed field for field.
 *
 * It exists because the two sides were written from the same prose, agreed on
 * every field name that mattered, and disagreed on the two that *carry* them:
 * the engine sends `records` with `install_id` on each record, and this ingest
 * originally expected `batch` with `install_id` on the envelope. Neither side
 * would have failed loudly — the mirror POSTs, gets a 202, and the corpus
 * silently stays empty. That is the worst failure mode this system has, because
 * "the engine is not mirroring" and "nothing is happening" look identical.
 *
 * **If the engine's `MirrorBatch` changes, this fixture must be retranscribed.**
 * It is deliberately a literal rather than an import: the two repos ship
 * separately, so a copy going stale is the signal we want.
 */

const logger = pino({ level: "silent" });

/** Transcribed from `MirrorBatch` / `MirrorRecord`, engine schema_version 1. */
const ENGINE_BATCH = {
  schema_version: 1,
  instance_id: "inst-proc-0001",
  sent_at: "2026-08-17T12:00:05.000Z",
  dropped_since_last_batch: 0,
  records: [
    {
      schema_version: 1,
      emitted_at: "2026-08-17T12:00:00.000Z",
      install_id: "inst_abc123456789",
      instance_id: "inst-proc-0001",
      session_ref: "sess_1111aaaa2222",
      correlation: { session_id: "real-session-id" },
      kind: "SESSION_CREATED",
      session: {
        domain: "ONDC:TRV11",
        version: "2.0.0",
        usecase: "METRO",
        mock_role: "BAP",
        np_type: "BPP",
        subscriber_ref: "np_deadbeef0000",
        callback_url: "https://mock.example/ondc/TRV11/2.0.0/buyer",
        interaction_mode: "llm_auto",
        auto_advance: true,
        created_at: "2026-08-17T12:00:00.000Z",
        expires_at: "2026-08-19T12:00:00.000Z",
      },
    },
    {
      schema_version: 1,
      emitted_at: "2026-08-17T12:00:01.000Z",
      install_id: "inst_abc123456789",
      instance_id: "inst-proc-0001",
      session_ref: "sess_1111aaaa2222",
      correlation: { session_id: "real-session-id" },
      kind: "RUN_STARTED",
      run: {
        flow_id: "search2_METRO_201",
        attempt: 1,
        auto_advance: true,
        started_at: "2026-08-17T12:00:01.000Z",
      },
    },
    {
      schema_version: 1,
      emitted_at: "2026-08-17T12:00:02.000Z",
      install_id: "inst_abc123456789",
      instance_id: "inst-proc-0001",
      session_ref: "sess_1111aaaa2222",
      correlation: {
        session_id: "real-session-id",
        transaction_id: "real-txn-id",
      },
      kind: "JOURNAL",
      event: {
        seq: 1,
        at: "2026-08-17T12:00:02.000Z",
        kind: "TRANSACTION_BOUND",
        flow_id: "search2_METRO_201",
        transaction_id: "txn_aaaabbbbcccc",
        summary: "bound transaction txn_aaaabbbbcccc",
      },
    },
    {
      schema_version: 1,
      emitted_at: "2026-08-17T12:00:03.000Z",
      install_id: "inst_abc123456789",
      instance_id: "inst-proc-0001",
      session_ref: "sess_1111aaaa2222",
      kind: "JOURNAL",
      event: {
        seq: 2,
        at: "2026-08-17T12:00:03.000Z",
        kind: "OUTBOUND_SENT",
        flow_id: "search2_METRO_201",
        transaction_id: "txn_aaaabbbbcccc",
        action: "search",
        ack: "ACK",
        payload_id: "pl_0001",
        overrides: ["$.context.bpp_uri"],
        summary: "sent search to np_deadbeef0000",
      },
    },
    {
      schema_version: 1,
      emitted_at: "2026-08-17T12:00:04.000Z",
      install_id: "inst_abc123456789",
      instance_id: "inst-proc-0001",
      session_ref: "sess_1111aaaa2222",
      kind: "JOURNAL",
      event: {
        seq: 3,
        at: "2026-08-17T12:00:04.000Z",
        kind: "FLOW_COMPLETE",
        flow_id: "search2_METRO_201",
        transaction_id: "txn_aaaabbbbcccc",
        summary: "flow complete",
      },
    },
  ],
};

function build() {
  const repository = new FakeCorpusRepository();
  const service = new IngestService({ repository, logger });
  return { repository, service };
}

describe("the engine's MirrorBatch, byte-for-byte", () => {
  it("is accepted with nothing skipped", async () => {
    const { service } = build();
    const result = await service.acceptTelemetry(ENGINE_BATCH);

    // `skipped > 0` is the tell. The ingest never rejects a batch, so a shape
    // mismatch shows up here and nowhere else.
    expect(result).toMatchObject({ sessions: 1, runs: 1, skipped: 0 });
  });

  it("stores the session with its expiry and its pseudonyms", async () => {
    const { repository, service } = build();
    await service.acceptTelemetry(ENGINE_BATCH);

    const session = [...repository.sessions.values()][0];
    expect(session).toMatchObject({
      session_ref: "sess_1111aaaa2222",
      install_id: "inst_abc123456789",
      domain: "ONDC:TRV11",
      version: "2.0.0",
      mock_role: "BAP",
      subscriber_ref: "np_deadbeef0000",
      // Carried because session expiry is not observable: the engine's store
      // expires entries silently and has no eviction callback.
      expires_at: "2026-08-19T12:00:00.000Z",
    });
  });

  it("lifts the clear ids out of `correlation`, not off the record", async () => {
    const { repository, service } = build();
    await service.acceptTelemetry(ENGINE_BATCH);

    expect([...repository.sessions.values()][0]?.session_id).toBe(
      "real-session-id",
    );
  });

  it("keeps working when correlation is absent", async () => {
    // A third-party operator mirroring their runs is not obliged to hand us
    // their session ids; the corpus must still group, count and time.
    const { repository, service } = build();
    await service.acceptTelemetry({
      ...ENGINE_BATCH,
      records: ENGINE_BATCH.records.map((record) => {
        const { correlation: _dropped, ...rest } = record as Record<
          string,
          unknown
        >;
        return rest;
      }),
    });

    const session = [...repository.sessions.values()][0];
    expect(session?.session_id).toBeUndefined();
    expect(session?.session_ref).toBe("sess_1111aaaa2222");
  });

  it("stores every journal line, with overrides and payload handles intact", async () => {
    const { repository, service } = build();
    await service.acceptTelemetry(ENGINE_BATCH);

    const lines = [...repository.journal.values()].sort(
      (a, b) => a.seq - b.seq,
    );
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatchObject({
      kind: "OUTBOUND_SENT",
      action: "search",
      ack: "ACK",
      payload_id: "pl_0001",
      // A non-empty list means the payload that went out was NOT the one the
      // flow config generated — the single most important thing a journal line
      // can say about a step.
      overrides: ["$.context.bpp_uri"],
    });
  });

  it("derives the run's status from the journal, ending at complete", async () => {
    const { repository, service } = build();
    await service.acceptTelemetry(ENGINE_BATCH);

    const run = [...repository.runs.values()][0];
    expect(run?.status).toBe("complete");
    expect(run?.flow_id).toBe("search2_METRO_201");
  });

  it("skips an unreadable entry without losing the rest of the batch", async () => {
    // The mirror does not retry, so one line from a future engine must never
    // cost the ninety-nine around it.
    const { service } = build();
    const result = await service.acceptTelemetry({
      ...ENGINE_BATCH,
      records: [
        ...ENGINE_BATCH.records,
        { kind: "SOMETHING_NEW_IN_A_LATER_ENGINE", session_ref: "sess_x" },
      ],
    });

    expect(result.skipped).toBe(1);
    expect(result.sessions).toBe(1);
    expect(result.journal).toBe(3);
  });
});

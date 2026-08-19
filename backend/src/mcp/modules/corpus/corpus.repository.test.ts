import { MongoClient } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureIndexes } from "@/mcp/lib/mongo.js";
import {
  buildIncidentQuery,
  MongoCorpusRepository,
} from "@/mcp/modules/corpus/corpus.repository.js";
import {
  fingerprintOf,
  reportDocId,
  type ReportDoc,
} from "@/mcp/modules/corpus/corpus.schema.js";
import { toReportDoc } from "@/mcp/modules/ingest/ingest.service.js";
import { makeNarration, makeReport } from "@/mcp/test/fixtures.js";

/**
 * `buildIncidentQuery` gets its own suite because it is the only query in the
 * repository assembled from optional parts. Everything else is a literal a
 * reviewer can check by eye; a dropped clause here does not throw, it widens —
 * a suppressed incident reappears, a domain filter shows every domain — and a
 * UI cannot tell you that happened.
 */
describe("buildIncidentQuery", () => {
  it("maps an empty filter to an empty query, matching everything", () => {
    expect(buildIncidentQuery({})).toEqual({});
  });

  it("maps each scalar filter onto its own field", () => {
    expect(buildIncidentQuery({ domain: "ONDC:TRV11" })).toEqual({
      domain: "ONDC:TRV11",
    });
    expect(buildIncidentQuery({ version: "2.0.0" })).toEqual({
      version: "2.0.0",
    });
    expect(buildIncidentQuery({ flow_id: "search2_METRO_201" })).toEqual({
      flow_id: "search2_METRO_201",
    });
    expect(buildIncidentQuery({ trigger: "VALIDATION_FINDINGS" })).toEqual({
      trigger: "VALIDATION_FINDINGS",
    });
  });

  it("maps `state` onto `latest_state`, not onto `state_counts`", () => {
    // The newest delivery decides. An incident whose last report said
    // RECOVERED must drop out of an `state=OPEN` view even though its
    // `state_counts` still remembers the OPEN ones.
    expect(buildIncidentQuery({ state: "OPEN" })).toEqual({
      latest_state: "OPEN",
    });
  });

  it("maps `status` onto the dotted triage path", () => {
    expect(buildIncidentQuery({ status: "in_progress" })).toEqual({
      "triage.status": "in_progress",
    });
  });

  it("keeps `false` for the boolean filters", () => {
    // The bug this pins: a truthiness check drops `suppressed: false`, which is
    // the default view of the triage queue — so every dismissed incident comes
    // back the first time someone reloads the page.
    expect(buildIncidentQuery({ suppressed: false })).toEqual({
      suppressed: false,
    });
    expect(buildIncidentQuery({ suppressed: true })).toEqual({
      suppressed: true,
    });
    expect(buildIncidentQuery({ narrated: false })).toEqual({
      narrated: false,
    });
    expect(buildIncidentQuery({ narrated: true })).toEqual({ narrated: true });
  });

  it("maps `since` to an inclusive lower bound on last_seen_at", () => {
    expect(buildIncidentQuery({ since: "2026-07-01T00:00:00.000Z" })).toEqual({
      last_seen_at: { $gte: "2026-07-01T00:00:00.000Z" },
    });
  });

  it("spreads `search` across the identity fields, case-insensitively", () => {
    const query = buildIncidentQuery({ search: "bpp_uri" });
    expect(query.$or).toEqual([
      { code: { $regex: "bpp_uri", $options: "i" } },
      { flow_id: { $regex: "bpp_uri", $options: "i" } },
      { step_key: { $regex: "bpp_uri", $options: "i" } },
      { action: { $regex: "bpp_uri", $options: "i" } },
      { trigger: { $regex: "bpp_uri", $options: "i" } },
    ]);
  });

  it("escapes regex metacharacters in `search`", () => {
    // Unescaped this is a catastrophic backtrack running in-process, on a route
    // with no per-query timeout. It is a denial of service, not a typo.
    const query = buildIncidentQuery({ search: "(a+)+$" });
    const first = (query.$or ?? [])[0] as
      { code: { $regex: string } } | undefined;
    expect(first?.code.$regex).toBe("\\(a\\+\\)\\+\\$");
  });

  it("ignores a blank search rather than matching everything twice", () => {
    expect(buildIncidentQuery({ search: "   " })).toEqual({});
  });

  it("combines every filter into one query", () => {
    expect(
      buildIncidentQuery({
        domain: "ONDC:TRV11",
        version: "2.0.0",
        flow_id: "search2_METRO_201",
        trigger: "VALIDATION_FINDINGS",
        state: "OPEN",
        status: "new",
        suppressed: false,
        narrated: true,
        since: "2026-07-01T00:00:00.000Z",
        search: "select",
      }),
    ).toEqual({
      domain: "ONDC:TRV11",
      version: "2.0.0",
      flow_id: "search2_METRO_201",
      trigger: "VALIDATION_FINDINGS",
      latest_state: "OPEN",
      "triage.status": "new",
      suppressed: false,
      narrated: true,
      last_seen_at: { $gte: "2026-07-01T00:00:00.000Z" },
      $or: [
        { code: { $regex: "select", $options: "i" } },
        { flow_id: { $regex: "select", $options: "i" } },
        { step_key: { $regex: "select", $options: "i" } },
        { action: { $regex: "select", $options: "i" } },
        { trigger: { $regex: "select", $options: "i" } },
      ],
    });
  });
});

/* -------------------------------------------------------------------------- */
/* Mongo-backed — opt-in                                                       */
/* -------------------------------------------------------------------------- */

const mongoTestUrl = process.env.MONGO_TEST_URL;
const describeMongo = mongoTestUrl === undefined ? describe.skip : describe;

describeMongo("MongoCorpusRepository (needs MONGO_TEST_URL)", () => {
  const url = mongoTestUrl ?? "";
  const database = `corpus_test_${Date.now()}`;
  let client: MongoClient;
  let repository: MongoCorpusRepository;

  beforeAll(async () => {
    client = new MongoClient(url);
    await client.connect();
    const db = client.db(database);
    await ensureIndexes(db, 30);
    repository = new MongoCorpusRepository(db);
  });

  afterAll(async () => {
    await client.db(database).dropDatabase();
    await client.close();
  });

  function doc(report: ReturnType<typeof makeReport>): ReportDoc {
    return toReportDoc(
      report,
      fingerprintOf(report),
      reportDocId(report),
      new Date().toISOString(),
    );
  }

  it("collapses a redelivery and sums peaks, not deliveries", async () => {
    const first = makeReport({
      report_id: "inc_peak",
      generated_at: "2026-07-31T09:00:00.000Z",
      incident: { occurrences: 3 },
    });
    // Same run, re-flushed after narration: same `report_id`, new
    // `generated_at`, a higher running total. Two ledger rows, one run.
    const narrated = makeReport({
      report_id: "inc_peak",
      generated_at: "2026-07-31T09:05:00.000Z",
      incident: { occurrences: 5, state: "RECOVERED_WITH_OVERRIDE" },
      narration: makeNarration(),
    });
    // A different operator hitting the same wall.
    const other = makeReport({
      report_id: "inc_other",
      install_id: "install_zzz",
      generated_at: "2026-07-31T10:00:00.000Z",
      incident: { occurrences: 2 },
    });

    expect(await repository.insertReport(doc(first))).toBe(true);
    expect(await repository.insertReport(doc(first))).toBe(false);
    expect(await repository.insertReport(doc(narrated))).toBe(true);
    expect(await repository.insertReport(doc(other))).toBe(true);

    const fingerprint = fingerprintOf(first);
    const incident = await repository.recomputeIncident(fingerprint);

    expect(incident?.deliveries).toBe(3);
    expect(incident?.distinct_runs).toBe(2);
    // 5 (peak of inc_peak) + 2 (peak of inc_other). Not 3+5+2, and not 1 each.
    expect(incident?.occurrences_total).toBe(7);
    expect(incident?.install_ids).toEqual(["install_a1b2c3", "install_zzz"]);
    expect(incident?.first_seen_at).toBe("2026-07-31T09:00:00.000Z");
    expect(incident?.last_seen_at).toBe("2026-07-31T10:00:00.000Z");
    expect(incident?.latest_state).toBe("OPEN");
    expect(incident?.narrated).toBe(true);
    expect(incident?.suspected_causes).toEqual(["flow_config"]);
    expect(incident?.triage.status).toBe("untracked");
    expect(incident?.suppressed).toBe(false);
  });

  it("never clobbers triage state on recompute", async () => {
    const report = makeReport({
      report_id: "inc_triage",
      flow_id: "confirm_1",
    });
    await repository.insertReport(doc(report));
    const fingerprint = fingerprintOf(report);
    await repository.recomputeIncident(fingerprint);

    await repository.setSuppressed(fingerprint, true);
    await repository.setTriage(fingerprint, {
      status: "in_progress",
      assignees: ["someone"],
    });

    // A second delivery of the same defect must not undo a human's decision.
    await repository.insertReport(
      doc(
        makeReport({
          report_id: "inc_triage_2",
          flow_id: "confirm_1",
          generated_at: "2026-08-01T00:00:00.000Z",
        }),
      ),
    );
    const after = await repository.recomputeIncident(fingerprint);

    expect(after?.suppressed).toBe(true);
    expect(after?.triage.status).toBe("in_progress");
    expect(after?.triage.assignees).toEqual(["someone"]);
    expect(after?.deliveries).toBe(2);
  });

  it("answers undefined for a fingerprint with no ledger rows", async () => {
    expect(await repository.recomputeIncident("nothing-here")).toBeUndefined();
    expect(await repository.findIncident("nothing-here")).toBeUndefined();
  });

  it("stores absent optionals as absent, never as null", async () => {
    // A build with no use-case at all — `ReportDoc.usecase` is a required key
    // holding `undefined`, and without `ignoreUndefined` the driver would write
    // it as an explicit `null` that no `=== undefined` check ever matches.
    const report = {
      ...makeReport({ report_id: "inc_no_usecase" }),
      build: { domain: "ONDC:TRV11", version: "2.0.0" },
    };
    await repository.insertReport(doc(report));
    const stored = await repository.findReport(reportDocId(report));

    expect(stored?.usecase).toBeUndefined();
    expect(Object.keys(stored ?? {})).not.toContain("usecase");
  });

  it("ignores journal lines it already holds", async () => {
    const lines = [1, 2, 3].map((seq) => ({
      _id: `install_a1b2c3:sref:${seq}`,
      install_id: "install_a1b2c3",
      session_ref: "sref",
      session_id: undefined,
      seq,
      at: "2026-07-31T09:00:00.000Z",
      kind: "OUTBOUND_SENT",
      flow_id: "search2_METRO_201",
      transaction_id: undefined,
      action: "search",
      ack: undefined,
      nack_code: undefined,
      payload_id: undefined,
      overrides: undefined,
      summary: "sent search",
      received_at: new Date(),
    }));

    expect(await repository.insertJournal(lines)).toBe(3);
    // The whole batch resent after a lost acknowledgement.
    expect(await repository.insertJournal(lines)).toBe(0);
    expect((await repository.listJournal("sref", 0, 10)).length).toBe(3);
    expect((await repository.listJournal("sref", 2, 10)).length).toBe(1);
  });
});

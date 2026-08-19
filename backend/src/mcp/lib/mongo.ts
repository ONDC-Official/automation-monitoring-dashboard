import { MongoClient, type Db } from "mongodb";
import type { Logger } from "pino";
import { COLLECTIONS } from "@/mcp/modules/corpus/corpus.schema.js";

/**
 * The Mongo connection, and the indexes the corpus depends on.
 *
 * Indexes are created at boot rather than by a migration tool. They are all
 * `createIndex`, which is idempotent, and the set is small enough that the
 * honest trade is "one fewer moving part" — but note the consequence: an index
 * added here only exists after a deploy, so a query written against a new index
 * must ship in the same release.
 */

export interface MongoHandle {
  client: MongoClient;
  db: Db;
  close(): Promise<void>;
}

export async function connectMongo(options: {
  url: string;
  database: string;
  retentionDays: number;
  logger: Logger;
}): Promise<MongoHandle> {
  const client = new MongoClient(options.url, {
    // Bounded so a dead Mongo surfaces as a failing readiness probe rather than
    // a request that hangs until the 30s request timeout.
    serverSelectionTimeoutMS: 5_000,
    connectTimeoutMS: 5_000,
  });

  await client.connect();
  const db = client.db(options.database);
  await ensureIndexes(db, options.retentionDays);
  options.logger.info(
    { database: options.database },
    "connected to mongodb and ensured indexes",
  );

  return {
    client,
    db,
    close: () => client.close(),
  };
}

export async function ensureIndexes(
  db: Db,
  retentionDays: number,
): Promise<void> {
  const reports = db.collection(COLLECTIONS.reports);
  await reports.createIndex({ fingerprint: 1, generated_at: -1 });
  await reports.createIndex({ received_at: -1 });
  await reports.createIndex({ install_id: 1, report_id: 1 });
  await reports.createIndex({ session_id: 1 }, { sparse: true });
  await reports.createIndex({ domain: 1, version: 1, flow_id: 1 });

  const incidents = db.collection(COLLECTIONS.incidents);
  await incidents.createIndex({ last_seen_at: -1 });
  await incidents.createIndex({ occurrences_total: -1 });
  await incidents.createIndex({ "triage.status": 1, last_seen_at: -1 });
  await incidents.createIndex({ domain: 1, version: 1, flow_id: 1 });
  await incidents.createIndex({ trigger: 1, latest_state: 1 });

  // Dropped rather than merely un-created. Deleting a `createIndex` call leaves
  // the index in place on every database that has already booted, so this one
  // would survive as a sparse unique index over `github.issue_number` — a key
  // no document will ever carry again. Guarded because it must be a no-op on a
  // fresh database and on every boot after the first, which is the same
  // idempotence the rest of this function already promises.
  await incidents.dropIndex("github.issue_number_1").catch(() => undefined);

  const sessions = db.collection(COLLECTIONS.sessions);
  await sessions.createIndex({ received_at: -1 });
  await sessions.createIndex({ expires_at: -1 });
  await sessions.createIndex({ session_ref: 1 });

  const runs = db.collection(COLLECTIONS.runs);
  await runs.createIndex({ updated_at: -1 });
  await runs.createIndex({ session_ref: 1, flow_id: 1 });

  const journal = db.collection(COLLECTIONS.journal);
  await journal.createIndex({ session_ref: 1, seq: 1 }, { unique: true });
  await journal.createIndex({ at: -1 });
  // The bulky, least individually valuable documents. A TTL index is the only
  // thing in this service that deletes anything on its own.
  await journal.createIndex(
    { received_at: 1 },
    { expireAfterSeconds: retentionDays * 24 * 60 * 60 },
  );
}

import type { Logger } from "pino";
import type { Config } from "@/mcp/config.js";
import { logger as defaultLogger } from "@/observability/logger.js";
import { connectMongo, type MongoHandle } from "@/mcp/lib/mongo.js";
import {
  MongoCorpusRepository,
  type CorpusRepositoryPort,
} from "@/mcp/modules/corpus/corpus.repository.js";
import { IngestService } from "@/mcp/modules/ingest/ingest.service.js";
import { QueryService } from "@/mcp/modules/query/query.service.js";
import { TriageService } from "@/mcp/modules/triage/triage.service.js";

/**
 * Everything expensive or shared, built once per process.
 *
 * Same shape and same reasoning as `automation-mcp/src/container.ts`: the MCP
 * server factory runs per HTTP request and must stay cheap, so the Mongo
 * connection, the undici agent and every service are constructed here and
 * closed over.
 *
 * Test seams follow the engine's convention — an optional override per
 * dependency, so a test can inject a fake without a mocking framework.
 */

export interface Container {
  readonly config: Config;
  readonly logger: Logger;
  readonly services: {
    readonly corpus: CorpusRepositoryPort;
    readonly ingest: IngestService;
    readonly query: QueryService;
    readonly triage: TriageService;
  };
  readonly mongo: MongoHandle | undefined;
  ping(): Promise<boolean>;
  dispose(): Promise<void>;
}

export interface CreateContainerOptions {
  logger?: Logger;
  /** Inject to run without a database. */
  repository?: CorpusRepositoryPort;
}

export async function createContainer(
  config: Config,
  options: CreateContainerOptions = {},
): Promise<Container> {
  const logger = options.logger ?? defaultLogger;

  let mongo: MongoHandle | undefined;
  let repository = options.repository;

  if (repository === undefined) {
    mongo = await connectMongo({
      url: config.MONGO_URL,
      database: config.MONGO_DB,
      retentionDays: config.TELEMETRY_RETENTION_DAYS,
      logger,
    });
    repository = new MongoCorpusRepository(mongo.db);
  }

  const triage = new TriageService({ repository });
  const ingest = new IngestService({ repository, logger });
  const query = new QueryService({ repository });

  // The ingest is a write surface a third party reaches, so whether it is
  // authenticated is a fact the operator is owed in print at boot rather than
  // by reading a config file back.
  logger.info(
    {
      mongo_db: config.MONGO_DB,
      ingest_authenticated: config.INGEST_API_KEY !== undefined,
    },
    "dashboard container ready",
  );

  const capturedRepository = repository;
  let disposed = false;

  return {
    config,
    logger,
    services: { corpus: capturedRepository, ingest, query, triage },
    mongo,
    async ping(): Promise<boolean> {
      if (mongo === undefined) return true;
      try {
        await mongo.db.admin().ping();
        return true;
      } catch {
        return false;
      }
    },
    async dispose(): Promise<void> {
      if (disposed) return;
      disposed = true;
      await mongo?.close().catch(() => undefined);
    },
  };
}

# ONDC Admin Monitoring Dashboard

A read-only admin console for the ONDC automation stack, with **two subjects**.

### 1. The mock playground service

Live observation of `automation-mock-playground-service`:

- **Redis Explorer** — business-decoded view of the cache (DB0 = business state,
  DB1 = runner config). Keys are decoded by their business prefix and validated
  against the service's Zod schemas; you see the typed "business" view, the raw
  blob, TTL, and a schema-validation badge — not just raw cache.
- **Logs** — purpose-built Loki viewer with structured filtering
  (level / transaction_id / session_id / correlation_id / domain / version),
  pretty JSON-log rendering, and live tail (SSE).
- **Metrics** — native Recharts panels from the Prometheus query API.
- **Grafana** — embeds the existing provisioned dashboards.
- **Overview** — live health of every dependency + Redis keyspace counts.

### 2. The MCP corpus

The durable corpus, triage loop and ops view for **`automation-mcp`** — the MCP
server that plays a mock ONDC network participant.

The engine already reports itself: it captures every stuck run, redacts it
structurally, renders an `IssueReport` and POSTs it to `FEEDBACK_ENDPOINT_URL`,
alongside a live mirror of session/run/journal state. **This dashboard is what
is on the other end of those URLs.**

- **MCP Overview** — the corpus at a glance: incidents, recovery mix, worst
  flows, and engine health panels from Prometheus.
- **Incidents** — the corpus, filtered and paged, with a detail sheet (summary,
  findings, narration, deliveries, raw report) and triage actions.
- **Sessions** and **Journal** — mirrored live state from the engine, down to
  the per-step wire log.

**This section is optional.** With `MONGO_URL` unset the dashboard boots
exactly as before: `/api/mcp/*` answers 503 and the nav group is hidden. An
operator who only watches the playground service never has to run a MongoDB.

## Stack

| | |
|---|---|
| Backend | Node 22+, Express 5 (ESM), TypeScript, ioredis, MongoDB, zod, pino, axios |
| Frontend | Vite, React 19, TypeScript, Tailwind 4, shadcn/ui, TanStack Query, Recharts, React Router 7 |

Two self-contained packages (no workspaces), matching the house repo layout.

## Layout

```
├── backend/     read-only aggregation/proxy API + the MCP corpus and triage
├── frontend/    React dashboard UI
├── grafana/     provisioned datasources and dashboards for the corpus + engine
├── docker-compose.dev.yml        mongo for local development
└── docker-compose.override.yml   enables Grafana iframe embedding on the existing obs stack
```

## Prerequisites

For the playground-service half, have these reachable (defaults in parentheses):

- Redis (`localhost:6379`) — the same instance the service uses
- Prometheus (`localhost:9090`), Loki (`localhost:3100`), Grafana (`localhost:3005`)
  — from `automation-mock-playground-service/docker-compose.observability.yml`
- The service's `/health` (`localhost:3000/health`)

For the MCP half, a MongoDB — `docker compose -f docker-compose.dev.yml up -d`.

## Run (local dev)

```bash
# 1. Backend
cd backend
cp .env.example .env        # adjust hosts/ports; set MONGO_URL to enable MCP
npm install
npm run dev                 # http://localhost:4090

# 2. Frontend (separate terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5190  (proxies /api -> :4090)
```

Open http://localhost:5190.

> Ports are **4090 / 5190** on purpose — the sibling `automation-frontend`
> apps use 4000 / 5173 and the mock service uses 3000. Vite uses `strictPort`,
> so a collision fails loudly instead of silently moving to another port.

## Backend API

Operator surfaces under `/api` (bearer-gated when `ADMIN_TOKEN` is set):

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Aggregate up/down for Redis, Prometheus, Loki, Grafana, the service, and Mongo |
| `GET /api/redis/{dbs,scan,inspect}` | Redis business view (SCAN, never KEYS) |
| `GET /api/metrics/{query,query_range,targets,rules}` | Prometheus proxy |
| `GET /api/logs/{query_range,labels,tail}` | Loki proxy + live tail over SSE |
| `GET /api/grafana/{dashboards,embed/:uid}` | Grafana discovery + embed URLs |
| `GET /api/mcp/config` | Whether the MCP section is configured — **always 200** |
| `GET /api/mcp/{stats,incidents,sessions,runs}` | The corpus read API |
| `POST /api/mcp/incidents/:fp/{status,comment,link,dismiss}` | Triage |

**Machine surfaces, deliberately outside the operator login** — each carries its
own credential:

| Endpoint | Auth |
|---|---|
| `POST /ingest/reports`, `POST /ingest/telemetry` | `INGEST_API_KEY` bearer |
| `GET /mcp-metrics` | `METRICS_TOKEN` bearer (off by default) |

> `/mcp-metrics` is this service's own Prometheus **exposition**;
> `/api/metrics/*` is a **proxy** that queries Prometheus. Opposite directions —
> the names are distinct so a scrape config cannot be pointed at the proxy.

## Pointing the engine at this dashboard

In `automation-mcp/.env`:

```bash
FEEDBACK_ENDPOINT_URL=http://127.0.0.1:4090/ingest/reports
MIRROR_ENDPOINT_URL=http://127.0.0.1:4090/ingest/telemetry
FEEDBACK_API_KEY=<same as INGEST_API_KEY here>
MIRROR_API_KEY=<same as INGEST_API_KEY here>
TELEMETRY_CORRELATION=true   # deep-link a report to the run that caused it
FEEDBACK_SALT=<any stable string>
```

`FEEDBACK_SALT` matters more than it looks: unset, the engine generates one per
process, so `install_id` changes on every restart and one operator looks like
many.

## Grafana embedding

Grafana refuses iframe embedding by default. Layer the override onto the
service's observability stack:

```bash
cd ../automation-mock-playground-service
docker compose \
  -f docker-compose.observability.yml \
  -f ../automation-monitoring-dashboard/docker-compose.override.yml \
  up -d grafana
```

The corpus dashboards additionally need the
`yesoreyeram-infinity-datasource` plugin, and the `Corpus` datasource must send
`ADMIN_TOKEN` as a bearer — `/api/mcp/*` is behind the operator gate, and
without the header every panel renders empty with nothing saying why. See
`grafana/provisioning/datasources/datasources.yml`.

## Keeping schemas in sync

Two vendored copies, both deliberate, both needing a manual re-sync:

- `backend/src/redis/schemas.ts` — copied from the monitored service
  (`src/types/cache-types.ts` et al.). Key decoding is in `redis/key-codec.ts`.
- `backend/src/mcp/modules/ingest/report.schema.ts` — the `IssueReport` wire
  contract, vendored from the engine and **deliberately more lenient than the
  producer**: a rejected report is resent by the engine's spool forever, so
  unknown fields pass through and are stored verbatim.

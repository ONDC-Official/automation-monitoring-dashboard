# ONDC Admin Monitoring Dashboard

A dedicated, read-only admin console for observing the
`automation-mock-playground-service` microservice in real time:

- **Redis Explorer** — business-decoded view of the cache (DB0 = business state,
  DB1 = runner config). Keys are decoded by their business prefix and validated
  against the service's Zod schemas; you see the typed "business" view, the raw
  blob, TTL, and a schema-validation badge — not just raw cache.
- **Logs** — purpose-built Loki viewer with structured filtering
  (level / transaction_id / session_id / correlation_id / domain / version),
  pretty JSON-log rendering, and live tail (SSE).
- **Metrics** — native Recharts panels from the Prometheus query API.
- **Grafana** — embeds the existing provisioned dashboards (hybrid approach:
  use Grafana where it's stronger, custom UI for the log/search pain points).
- **Overview** — live health of every dependency + Redis keyspace counts.

> The dashboard is **read-only** today. Redis write / "auto-correct" lives as a
> stub at `backend/src/redis/repair.ts` to be built out later.

## Stack

| | |
|---|---|
| Backend | Node 22+, Express 5, TypeScript, ioredis, zod, pino, axios |
| Frontend | Vite, React 19, TypeScript, Tailwind 4, shadcn/ui, TanStack Query/Table, Recharts, React Router 7 |

Two self-contained packages (no workspaces), matching the house repo layout.

## Layout

```
automation-monitoring/
├── backend/    # read-only aggregation/proxy API (Redis decode + Prometheus/Loki/Grafana proxies)
├── frontend/   # React dashboard UI
└── docker-compose.override.yml   # enables Grafana iframe embedding on the existing obs stack
```

## Prerequisites

The dashboard observes the existing infra of `automation-mock-playground-service`.
Have these reachable (defaults in parentheses):

- Redis (`localhost:6379`) — the same instance the service uses
- Prometheus (`localhost:9090`), Loki (`localhost:3100`), Grafana (`localhost:3005`)
  — from `automation-mock-playground-service/docker-compose.observability.yml`
- The service's `/health` (`localhost:3000/mock/playground/health`)

## Run (local dev)

```bash
# 1. Backend
cd backend
cp .env.example .env        # adjust hosts/ports if needed
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

All under `/api` (bearer-gated only if `ADMIN_TOKEN` is set):

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Aggregate up/down for Redis, Prometheus, Loki, Grafana, the service |
| `GET /api/redis/dbs` | Per-DB key counts + business-type taxonomy |
| `GET /api/redis/scan?db=&match=&cursor=` | SCAN page of decoded keys (never KEYS) |
| `GET /api/redis/inspect?db=&key=` | Decoded business view + raw + schema validation |
| `GET /api/metrics/{query,query_range,targets,rules}` | Prometheus proxy |
| `GET /api/logs/{query_range,labels}` | Loki proxy |
| `GET /api/logs/tail?query=` | Loki live tail over SSE |
| `GET /api/grafana/{dashboards,embed/:uid}` | Grafana discovery + embed URLs |

## Grafana embedding

Grafana refuses iframe embedding by default. Layer the override onto the
service's observability stack:

```bash
cd ../automation-mock-playground-service
docker compose \
  -f docker-compose.observability.yml \
  -f ../automation-monitoring/docker-compose.override.yml \
  up -d grafana
```

## Keeping schemas in sync

`backend/src/redis/schemas.ts` is **copied** from the monitored service
(`src/types/cache-types.ts` et al.) — the repos are independent. Re-sync it when
those schemas change. Key-decoding logic lives in `backend/src/redis/key-codec.ts`.

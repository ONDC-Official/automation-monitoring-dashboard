# CLAUDE.md — automation-monitoring-dashboard

Guidance for Claude Code in this repo.

---

## 1. What this is

A read-only admin console for the ONDC automation stack, with **two subjects**:

| Section | Subject | Data source |
| --- | --- | --- |
| Overview · Redis Explorer · Logs · Metrics · Grafana | `automation-mock-playground-service` | Redis (read-only) + proxies to Prometheus, Loki, Grafana |
| **MCP Corpus** (`/mcp/*`) | `automation-mcp` — the mock ONDC network participant | MongoDB, fed by the engine's own `feedback` and `mirror` sinks |

The MCP section absorbed a separate repo (`automation-mcp-dashboard`) rather
than shipping as a second deployment. The engine already reported every stuck
run: `feedback/` captures incidents deterministically, redacts them
structurally, renders an `IssueReport`, spools it to disk and POSTs it to
`FEEDBACK_ENDPOINT_URL`. **This service is the thing that was on the other end
of that URL and did not exist.**

Four decisions fix the shape. Do not relitigate them silently:

| Decision | Choice |
| --- | --- |
| **Where triage happens** | **MongoDB, here.** Status, notes, fix links and dismissals are authored in this dashboard and land on the incident document as `triage.notes[]`. There is no external tracker, nothing is filed anywhere, and this service makes no outbound calls on an operator's behalf. |
| **Where the corpus lives** | **MongoDB.** `reports` is an immutable ledger; `incidents` is a derived cache plus triage state. |
| **Observability** | **Standard tooling, embedded.** Prometheus + Loki + Grafana; the app embeds Grafana rather than redrawing it. |
| **MCP is optional** | `MONGO_URL` unset ⇒ the section is off: `/api/mcp/*` answers 503 and the nav group is hidden. An operator who only watches the playground service must never be made to run a MongoDB. |

### "MCP" here means the corpus, not the protocol

`backend/src/mcp/`, `/api/mcp/*`, the `mcp_enabled` config key, `/mcp-metrics`,
the frontend's `/mcp/*` routes and the "MCP Corpus" nav label all predate the
removal of two features this service used to carry:

- a **Streamable-HTTP MCP server** at `/mcp` — 11 tools and a prompt, letting an
  agent read and triage the corpus directly. It sat outside `requireAdminToken`
  (which is scoped to `/api`), so it was an unauthenticated read surface over
  everything the corpus holds.
- a **GitHub issue sync** — issue filing, an HMAC webhook, and triage state
  mirrored back from labels and open/closed. It shipped off by default and was
  never switched on, which meant the free text an operator typed into a comment
  or a status note was accepted by the API and then discarded.

Both are gone. The names stayed, deliberately: it keeps these files diff-able
against `automation-mcp-dashboard`, so a fix landing there can still be replayed
here by eye. **Read "MCP" as "the corpus fed by `automation-mcp`".** Nothing in
this repo speaks the Model Context Protocol.

Two artefacts of the removal survive on disk and are inert: a `github`
sub-document on incidents created before the change (never read; not migrated,
because a stale field beside the history is a better forensic trail than a
destructive collection-wide update at boot), and stale `triage.comment_count`
values. The `github.issue_number_1` index *is* dropped, at boot, in `mongo.ts` —
deleting a `createIndex` call does not remove an index from a database that has
already run.

## 2. The contracts that break silently

### The ingest must not answer 2xx before the write is durable

The engine's `SpoolAndUploadSink` writes a `.sent` marker on **any** 2xx and
never retries that file. A premature `202` does not delay a report — it
destroys it. A 4xx is a permanent refusal; a 5xx is a promise to accept later.
Never blur them. `backend/src/lib/errors.ts` exists to make a service choose one
by throwing, and `middlewares/error.ts` checks `isHttpError` **before** its
axios branch so a deliberate 502 is not re-derived from an upstream status.

**Corollary, new since the merge:** never mount middleware above `/ingest` that
can 4xx for infrastructural reasons. That is why the disabled-MCP response is
**503 and not 404**.

### `report_id` is not unique per delivery

Narrating an already-flushed incident clears `flushed_at` on the engine and
re-ships with the **same `report_id`** and a new `generated_at`. Hence the
ledger `_id` of `{install_id}:{report_id}:{generated_at}`.

### Rollups are recomputed by aggregation, never `$inc`-ed

`occurrences` from the engine is already a _running total_, not a delta, so
`$inc` double-counts twice over. `occurrences_total` is the **sum of the max
`occurrences` per distinct run** — a two-stage `$group`. Pinned by a test.

### The rendered summary is parsed by winx

`incident.body.ts` renders an incident as markdown for the detail sheet's
Summary tab. Nothing files it anywhere — but pasting it into an issue by hand is
now the *only* route into winx, so its format matters more than it did when a
sync engine wrote it.

`../winx-2.0/src/issue.ts#templateFields` reads `## Heading` sections and
`**Bold**: value` lines; `extractFacts` reads `domain`, `version` and
`scenario name` from them to rank spec branches.

**The colon goes outside the bold markers.** `**Domain:** x` captures the key as
`"domain:"`, `fields.get("domain")` returns `undefined`, the body still looks
right to a human, and `rankBranches` silently returns a worse guess. Nothing
fails. `incident.body.test.ts` runs a verbatim copy of winx's parser over our
output for exactly this reason.

### The fingerprint deliberately excludes `install_id`

`sha256(domain|version|usecase|flow_id|trigger|step_key|code)`. The whole value
of a corpus is seeing that four operators hit the same wall.

### `RECOVERED_WITH_OVERRIDE` is not `RECOVERED`

One says a **published** flow config produced a payload that could not be sent
and somebody had to patch around it; the other says the model was wrong and then
was not. Only the first is actionable outside these repos, which is why it earns
its own label in the rendered summary and its own line in the stats rollup.

### `/mcp-metrics` is not `/api/metrics/*`

Opposite directions. `/mcp-metrics` is this service's own Prometheus
**exposition** (scraped); `/api/metrics/*` is a read-through **proxy** that
queries Prometheus for the Metrics page. The distinct name is the only thing
stopping a scrape config from pointing at a proxy.

### The Grafana Corpus datasource needs a bearer

`/api/mcp/*` sits behind `requireAdminToken`. The Infinity datasource must send
`ADMIN_TOKEN`, or every corpus panel renders empty **with no error saying why**.
See `grafana/provisioning/datasources/datasources.yml`.

## 3. Layering and conventions

### Backend (`backend/`)

- **Express 5, ESM** (`"type": "module"`). Relative imports carry `.js`
  suffixes; `@/*` maps to `src/*` and is resolved at build time by `tsc-alias`.
  Without `tsc-alias` the built output has bare `@/` specifiers that Node cannot
  resolve — it breaks in the image and not in `npm run dev`.
- **`route → service → repository`**, one way, never skipped. A service never
  imports Express; it chooses a status code by throwing.
- **Schemas first** — `*.schema.ts` with zod, types from `z.infer`. Request
  validation goes through `middlewares/validate.ts`, which throws
  `BadRequestError`. The MCP query schemas carry real behaviour (coercion,
  `limit` caps) — do not drop them.
- `config/env.ts` is the **only** reader of `process.env`. `mcp/config.ts`
  re-shapes it for the ported modules; it is an adapter, not a second reader.
- **One self-contained subtree.** Everything in the corpus section lives under
  `backend/src/mcp/` — container, domain modules, Express routers, tests. The
  rest of the backend touches it in exactly four places: `server.ts` (mounts
  `/ingest`), `routes/index.ts` (`/api/mcp`), `routes/health.ts` (the `mongo`
  dep) and `middlewares/error.ts` (`isHttpError`).
- **`/ingest` sits above `express.json()` and above `requireAdminToken`, and
  both are load-bearing** — `ingestRoutes` installs its own parser at
  `INGEST_BODY_LIMIT_BYTES` (the app-wide 2mb one would silently win and 413 the
  engine), and the engine authenticates with `INGEST_API_KEY` rather than an
  operator bearer. `server.ts` states this where the mount is.

### Frontend (`frontend/`)

Follows `frontend/CONVENTIONS.md`, which is prescriptive. Its PR checklist is
the review checklist. In short: React 19 · Vite · Tailwind v4 (CSS-first, no
config file) · shadcn-shaped components in `components/<Name>/index.tsx` ·
TanStack Query for all server state · one axios `httpClient` · RHF for forms ·
`@/` imports only · `cn()` for every conditional class.

Two names that look interchangeable and are not:

- **`Badge` vs `StatusBadge`.** `Badge` classifies by emphasis; `StatusBadge`
  classifies by state on the fixed palette (`ok`/`warn`/`error`/…). They are
  separate because `badgeVariants` defaults `variant: "default"`, so a caller
  passing only a tone would still get `bg-primary` underneath.
- **`Tooltip` vs `HintTooltip`.** `Tooltip` is the Radix Root; `HintTooltip` is
  the hover-a-thing-read-a-string wrapper.

Status colours are fixed app-wide: green = ok/up, amber = warn/degraded,
red = down/error, grey = not configured. Tokens live in `src/index.css`.

**`DepState` is `boolean | "disabled"`.** `"disabled"` is a truthy string —
check for it *first*, or a switched-off dependency renders as up.

## 4. Layout

```
backend/src/
  config/env.ts      the only process.env reader; fail-fast at boot
  server.ts          mount order is load-bearing — read the comments
  middlewares/       auth (operator login) · error (honours HttpError) · validate
  lib/errors.ts      HttpError family; how a service picks a status code
  proxies/ redis/    the playground-service half
  mcp/               the corpus section, self-contained
    config.ts        adapter over config/env.ts
    container.ts     Mongo and the four services
    index.ts         initMcp(): the runtime, or undefined when switched off
    lib/             mongo (+ index bootstrap and one guarded drop)
    modules/
      ingest/    the lenient vendored IssueReport schema + telemetry
      corpus/    fingerprinting, the aggregation rollup, all Mongo access
      incident/  incident → markdown summary (winx contract); pure, tested
      triage/    the four operator actions and the notes[] timeline
      query/     the read contract shared by the web app and Grafana Infinity
    routes/    Express routers: ingest · query · metrics
frontend/src/
  pages/mcp/         overview · incidents · sessions · journal
  hooks/useMcp.ts    the whole MCP data layer
grafana/             provisioned datasources and dashboards
```

## 5. Commands

```bash
docker compose -f docker-compose.dev.yml up -d   # mongo

cd backend  && npm run dev     # API on :4090
cd frontend && npm run dev     # web app on :5190

cd backend && npm run type-check && npm run lint && npm test && npm run build
cd frontend && npm run lint && npm run build
```

Mongo-backed repository tests are opt-in:
`MONGO_TEST_URL=mongodb://127.0.0.1:27017 npm test`.

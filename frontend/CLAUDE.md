# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**ONDC Monitor** — read-only admin/observability dashboard for the `automation-mock-playground-service`. Frontend only; it renders, never mutates. All data comes from a backend aggregation API that fronts Redis, Prometheus, Loki, Grafana, and the monitored service's health. Five pages, one per concern: Overview, Redis Explorer, Logs, Metrics, Grafana.

## Commands

```bash
npm run dev      # vite dev server, port 5190 (strictPort — fails loud on collision)
npm run build    # tsc -b && vite build  (typecheck is part of build)
npm run lint     # eslint .
npm run preview  # serve built dist/
```

No test runner configured. To typecheck without building: `npx tsc -b`.

## Stack

React 19 · TypeScript (strict) · Vite 8 · Tailwind **v4** · shadcn/ui (new-york) · TanStack Query · react-router-dom v7 · recharts · sonner · radix-ui · lucide-react.

Notes: `@tanstack/react-table` is a dep but **unused** (tables use the plain `ui/table` primitives). `next-themes` appears only inside vendored `ui/sonner.tsx` — there is no theme toggle wired; a `.dark` token block exists in `index.css` but the app renders light.

## Architecture

- **`main.tsx`** wires the provider stack: `QueryClientProvider` → `BrowserRouter` → `TooltipProvider` → `<App/>` + `<Toaster/>`. QueryClient defaults: `refetchOnWindowFocus: false`, `retry: 1`, `staleTime: 5s` (live-ops tuning).
- **`App.tsx`** = the router. Every route is a page wrapped by `AppShell`. Unknown paths redirect to `/`.
- **`AppShell`** (`components/layout/`) = sidebar (driven by the `NAV` array) + header with `HealthIndicator`. Routed page renders as `children`.
- **`lib/api.ts`** is the single data layer: one typed `api` object exposing every endpoint, plus all request/response `interface`s and the `BusinessType` union. Everything goes through the `/api` proxy. The private `request<T>` helper builds the URL + throws `ApiError` on non-2xx. Add new endpoints here, never `fetch` inline.
- **Server state lives in TanStack Query**, never in ad-hoc effects. `useQuery` / `useInfiniteQuery`; query keys are arrays (`['redis-scan', db, match]`). Live data uses `refetchInterval` (health 10s, charts 30s). The one exception is Loki **live tail** — a raw `EventSource` to `api.logsTailUrl(...)`, cleaned up in a `useEffect` return (see `LogsPage`).

### Backend / proxy

Vite proxies `/api` → `http://localhost:4090` (see `vite.config.ts`; the comment in `api.ts` saying `:4000` is stale). The monitored service is `automation-mock-playground-service` — its `src/observability/metrics.ts` defines the Prometheus metrics the `MetricsPage` queries. Redis **DB0 = business** data, **DB1 = runner config**. Logs are pino→Loki structured, filtered by a trace envelope: `transaction_id` / `session_id` / `correlation_id` / `domain` / `version`. Grafana embedding needs `GF_SECURITY_ALLOW_EMBEDDING=true`.

## Conventions & reuse — follow these

- **Path alias:** `@/` → `src/`. Always import via `@/...`, never deep relatives.
- **`cn(...)`** (`lib/utils.ts`, clsx + tailwind-merge) is the only way class strings get composed. Use it for any conditional className.
- **`import type`** for type-only imports — `verbatimModuleSyntax` is on, so mixed imports fail the build.
- **Reusable building blocks — prefer these over rolling your own:**
  - `PageHeader` — every page's title/description/actions row.
  - `JsonViewer` — dependency-free collapsible JSON tree (search, expand/collapse-all, copy). Already reused by the Redis inspector and Logs rows. Props let you disable search / cap height.
  - `PromChart` — a full Prometheus line-chart panel from `{title, description, query}`. Add metrics by appending to the `PANELS` array in `MetricsPage`, not by writing new chart code.
- **`src/components/ui/` is vendored shadcn/ui** — eslint-ignored, do not hand-edit or lint-fix. Extend via new components that consume them. They follow the CVA variant pattern (`buttonVariants`) and carry `data-slot` attributes; add variants there, not inline overrides.
- **Status-color convention** (used in `HealthIndicator`, `OverviewPage`, `LogsPage`): `emerald` = ok/up, `amber` = warn/degraded, `red` = down/error.
- **`BusinessType`** (`api.ts`) is the canonical Redis-key classification enum; reuse it, don't restring values.

### Naming

- Components & pages: PascalCase, **named** `export function X` (only `JsonViewer` also default-exports). Pages live in `src/pages/` as `<Name>Page.tsx` exporting `<Name>Page`.
- Component placement: shared → `src/components/`, app chrome → `src/components/layout/`, primitives → `src/components/ui/`.
- Module-level constants: `UPPER_SNAKE` (`NAV`, `LEVELS`, `COLORS`, `PANELS`, `DEP_LABELS`, `ALL`). Helpers: `camelCase` (`buildLogQL`, `ttlLabel`, `levelColor`, `seriesName`).
- Comments explain **why**, not what (port choice, the JsonViewer remount-to-reseed trick, query tuning). Match that bar.

### Theming

Tailwind v4 is **CSS-first**: no `tailwind.config`. The theme is CSS variables in `src/index.css` (`:root` + `.dark`), oklch colors, with `--chart-1..5` and `--sidebar-*` tokens. Charts must reference `var(--chart-N)` / `var(--border)` etc. so they track the theme (see `PromChart`'s `COLORS`).

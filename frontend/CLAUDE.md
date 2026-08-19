# CLAUDE.md — frontend

Guidance for Claude Code in `frontend/`. The house style guide is
[`CONVENTIONS.md`](./CONVENTIONS.md) and it is **prescriptive** — this file
describes what is here; that one says how to add to it.

> An earlier version of this file described `lib/api.ts`, `src/components/ui/`,
> an `AppShell` and `<Name>Page.tsx` filenames. None of those exist. If
> something below stops matching the tree, fix this file in the same PR.

## What this is

The UI for a read-only admin console with two subjects: the
`automation-mock-playground-service` (Overview, Redis Explorer, Logs, Metrics,
Grafana) and the `automation-mcp` corpus (the `/mcp/*` section). It renders and
never mutates, with one exception — the triage actions, which write status,
notes, fix links and dismissals to the corpus through the backend.

## Commands

```bash
npm run dev      # vite, port 5190 (strictPort — fails loud on collision)
npm run build    # tsc -b && vite build (typecheck is part of build)
npm run lint     # eslint .
```

No test runner is configured. `npx tsc -b` typechecks without building.

## Stack

React 19 · TypeScript (strict, `verbatimModuleSyntax` — use `import type`) ·
Vite 8 · Tailwind **v4** (CSS-first: no `tailwind.config`, the theme is CSS
variables in `src/index.css`) · shadcn-shaped components built on `radix-ui` +
CVA · TanStack Query v5 · axios · Redux Toolkit + redux-persist (auth and theme
only) · react-hook-form · react-router-dom v7 · recharts · sonner ·
lucide-react.

## Architecture

- **`main.tsx`** wires the provider stack: `Provider` → `PersistGate` →
  `QueryClientProvider` → `BrowserRouter` (basename from `VITE_BASE_URL`) →
  `TooltipProvider` → `GlobalSpinner` + `App` + `Toaster`.
- **`components/Routes`** is the router. `/login` is public; everything else is
  inside `ProtectedLayout`, which redirects when `state.auth.isAuthenticated`
  is false. Unknown paths redirect to `/`.
- **`components/Layout`** is the chrome: a sidebar driven by `NAV` plus
  `NAV_GROUPS` from `Layout/constants.ts`, and a header with `HealthIndicator`,
  the theme toggle and the account menu. **Add a page by adding an entry to
  those arrays — never a new `NavLink`.**
- **`services/httpClient.ts`** is the only place a request is made. One axios
  instance, a request interceptor attaching the persisted bearer, and a
  response interceptor normalising every failure into `ApiError`. Use
  `errorMessage(e)` to render one.
- **Server state lives in TanStack Query**, never in ad-hoc effects. Domain
  hooks in `hooks/` wrap the generic `useGet`/`usePost`/`usePatch`; each exports
  a `*Keys` factory, which is the cache-invalidation contract.
- **Pages** are `pages/<name>/index.tsx` (presentational) plus a
  `use<Name>Page.ts` holding all state, derived data and handlers, plus
  `constants.ts` and pure `utils.ts`.

## The MCP section

`pages/mcp/{overview,incidents,sessions,journal}` and `hooks/useMcp.ts`, all
reading `/api/mcp/*`.

Three things about it are easy to get wrong:

- **It can be switched off.** `useMcpConfig()` reports `mcp_enabled`, and
  `Layout` hides the whole nav group when it is false. That endpoint answers
  200 even when the section is off — it must, or the app could not tell
  "switched off" from "broken". While the probe is in flight the group stays
  hidden: a nav item that appears a beat late beats one that appears and
  vanishes.
- **Routes are the state.** `/mcp/incidents/:fingerprint` and
  `/mcp/sessions/:sessionRef` open their detail sheets, so a link is
  shareable and survives a reload. Build internal links from `MCP_ROUTES`
  (`pages/mcp/constants.ts`), never a hardcoded `/mcp`.
- **Prometheus, Loki and Grafana are reached through the backend's proxies**
  (`/api/metrics/*`, `/api/logs/*`, `/api/grafana/*`), never directly from the
  browser. The repo these pages came from called those hosts directly; that was
  dropped deliberately — it needs CORS on infrastructure we do not own.

## Naming traps

| These look interchangeable | They are not |
| --- | --- |
| `Badge` / `StatusBadge` | `Badge` classifies by emphasis; `StatusBadge` by state (`ok`/`warn`/`error`/`info`/`neutral`/`outline`). Separate because `badgeVariants` defaults `variant: "default"` and would paint `bg-primary` under any tone. |
| `Tooltip` / `HintTooltip` | `Tooltip` is the Radix Root. `HintTooltip` is the `{label, children, side}` wrapper. |
| `DepState` | `boolean \| "disabled"`. `"disabled"` is **truthy** — test for it before the boolean, or a switched-off dependency renders as up. |
| `mcp_enabled`, `/mcp/*`, "MCP Corpus" | **"MCP" names the corpus, not a protocol.** The backend served a Streamable-HTTP MCP server once; it was removed and the names stayed so these files stay diff-able against `automation-mcp-dashboard`. `mcp_enabled` reports whether `MONGO_URL` is set — nothing more. |

## Theming

Tailwind v4 is CSS-first: the theme is CSS variables in `src/index.css`
(`:root` + `.dark`), re-exported as utilities through `@theme inline`. Dark mode
is class-based, toggled in one place, with a pre-paint script in `index.html`.

Status colours are fixed app-wide — green = ok/up, amber = warn/degraded,
red = down/error, grey = idle/not-configured — and available as
`bg-status-ok`, `text-status-error`, `bg-status-warn-soft` and so on. Never
reach for a raw `emerald-500`. Charts must reference `var(--chart-N)` so they
track the theme.

## Env

`VITE_API_BASE_URL` (axios baseURL) and `VITE_BASE_URL` (Vite `base` **and**
router `basename`) are the only browser-visible variables; both are baked at
image build time. `BACKEND_URL` is dev-server-only — Vite proxies `/api` to it.
Adding a `VITE_` variable means editing `src/vite-env.d.ts` too.

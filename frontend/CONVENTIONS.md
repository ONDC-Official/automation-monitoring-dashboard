# Frontend Best Practices

The house standard for React frontends. Two audiences:

- **Existing projects** — this is descriptive. When in doubt, grep for a similar file and match it.
- **New projects** — this is prescriptive. Scaffold to match this from day one; don't "start simple and refactor later."

Every rule here exists because the alternative caused a real problem: server data in Redux, three chart implementations, hex colors that broke dark mode, `fetch` calls scattered across components.

---

## 1. Stack

| Concern             | Library                                                       | Notes                                                                           |
| ------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Framework           | React 19                                                      | Function components only, no class components                                   |
| Language            | TypeScript (strict)                                           | `strict`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` all on |
| Build tool          | Vite                                                          | `@vitejs/plugin-react`                                                          |
| Styling             | Tailwind CSS v4                                               | CSS-first config (no`tailwind.config.*`), theme lives in `src/index.css`        |
| Variant styling     | class-variance-authority (CVA)                                | For components with multiple visual variants                                    |
| Class merging       | `clsx` + `tailwind-merge` via `cn()` in `src/lib/utils.ts`    | The only sanctioned way to compose classNames                                   |
| UI primitives       | `radix-ui`                                                    | Headless, unstyled, wrapped by our own components                               |
| Icons               | `lucide-react`                                                | The only icon set                                                               |
| Server state        | `@tanstack/react-query` v5                                    | All API data — no ad-hoc`useEffect` fetching                                    |
| Client/global state | `@reduxjs/toolkit` + `react-redux` + `redux-persist`          | Only auth session and theme (see §5)                                            |
| Forms               | `react-hook-form`                                             | All forms, no manual/uncontrolled form state                                    |
| HTTP                | `axios` via a single instance in `src/services/httpClient.ts` | Never call`fetch`/`axios` directly from a component or hook                     |
| Routing             | `react-router-dom` v7                                         |                                                                                 |
| Charts              | `recharts`                                                    | Wrapped by`PromChart` — extend via data, not new chart code                     |
| Toasts              | `sonner`                                                      | `toast.success(...)`, `toast.error(...)`                                        |

**Path alias:** `@/` → `src/`. Always import via `@/…`, never `../../..` chains.

Adding a dependency outside this list is a decision, not a detail — justify it in the PR. Prefer composing what's already here.

---

## 2. Project structure

```
src/
  components/    shared, reusable UI (PascalCase folder per component)
  pages/         one folder per route (lowercase folder name)
  hooks/         generic data-fetching hooks + domain hooks
  services/      httpClient + shared API types
  store/         redux slices (auth, theme)
  lib/           small framework-agnostic utilities (cn, etc.)
```

### Component folder shape

Every shared component gets its own folder, PascalCase, with `index.tsx` as the entry point:

```
components/Button/
  index.tsx        // the component
  variants.ts      // CVA variant definitions, if the component has variants
components/FormInput/
  index.tsx
  types.ts         // prop types, if non-trivial
```

- One component (or one tightly-coupled family, e.g. `Card`/`CardHeader`/`CardTitle`) per folder.
- Visual variants (button, badge, tabs) → CVA config in a sibling `variants.ts`, not inline in `index.tsx`.
- More than a couple of inline prop fields → extract to a sibling `types.ts`.
- Import from the folder path (`@/components/Button`), never reach into internals.

### Page folder shape

Pages are feature folders, not single files:

```
pages/logs/
  index.tsx           // presentational shell — composes sub-components, no business logic
  useLogsPage.ts      // all state + derived data + handlers for the page
  constants.ts        // DEFAULT_STREAM, RANGES, etc.
  utils.ts            // buildLogQL, parseLine — pure helper functions
  FilterForm.tsx      // page-local sub-components, flat in the folder
  QueryOptionsBar.tsx
  LogsList.tsx
  LogsFooter.tsx
  LogRow.tsx
```

- `index.tsx` stays presentational. All `useState`, derived values, and handlers live in a colocated `use<Page>Page.ts`. The page destructures that hook and renders.
- Sub-components used only by that page live flat in the page folder — no nested `components/` subfolder.
- Page-local pure logic (parsing, formatting, query building) → `utils.ts`. Page-local static data → `constants.ts`.
- The moment a sub-component or util is needed by a second page, promote it to `src/components` or `src/lib`.

---

## 3. Naming conventions

| Thing                                    | Convention                  | Examples                                       |
| ---------------------------------------- | --------------------------- | ---------------------------------------------- |
| Component folders & files                | PascalCase                  | `Button`, `FormInput`, `HealthIndicator`       |
| Page folders                             | lowercase                   | `logs`, `redis`, `overview`                    |
| Page component                           | PascalCase                  | `const Logs = () => …`                         |
| Hooks                                    | camelCase,`use` prefix      | `useLogsPage`, `useHealthQuery`, `useGet`      |
| Constants                                | UPPER_SNAKE_CASE            | `RANGES`, `DEFAULT_STREAM`, `NAV`              |
| Helpers                                  | camelCase                   | `buildLogQL`, `parseLine`, `cn`, `ttlLabel`    |
| Component prop types (in`types.ts`)      | `I`-prefixed PascalCase     | `IProps`, `IOption`                            |
| Domain/API types (in`services/types.ts`) | plain PascalCase, no prefix | `HealthResponse`, `ScanResult`, `BusinessType` |

The `I`-prefix split is deliberate and narrow: it applies only inside component-local `types.ts` files. Domain types never take it.

**React Query key factories** — a camelCase object named `<domain>Keys` exporting `as const` tuples:

```ts
export const healthKeys = { all: ["health"] as const };

export const grafanaKeys = {
    dashboards: ["grafana-dashboards"] as const,
    embed: (uid: string) => ["grafana-embed", uid] as const,
};
```

---

## 4. TypeScript rules

- `import type { … }` for anything type-only. `verbatimModuleSyntax` is on — getting this wrong fails the build, not just lint.
- No `any` without a very good reason and a comment explaining it. No unused locals/params — the compiler enforces this.
- Prefer `interface` for object/prop shapes, `type` for unions and function signatures.
- Domain/API types are centralized in `src/services/types.ts`, each annotated with the backend file it mirrors. Reuse them — don't redeclare a shape that already exists there.
- When the backend contract changes, edit `services/types.ts` first and let TypeScript surface every call site that needs fixing. That's the whole point of centralizing them.

---

## 5. State management — split by kind, don't mix

Two systems, two very different jobs. Picking the right one is the most important architectural decision in the app.

### Server state → TanStack Query, always

Anything from the backend goes through React Query. Never fetch in a `useEffect` and stuff the result into `useState`.

- Generic hooks in `src/hooks/useGet.ts`, `usePost.ts`, `usePatch.ts`, `useInfiniteGet.ts` are thin typed wrappers around `useQuery`/`useMutation`/`useInfiniteQuery`. Use these, not the TanStack hooks directly, so every call site looks the same.
- Domain hooks (`useHealth.ts`, `useLogs.ts`, `useMetrics.ts`, `useRedis.ts`, `useGrafana.ts`, `useLogin.ts`) wrap the generic hooks with the actual `httpClient` call, query key, and options. A new endpoint's hook goes here.
- Every domain hook file exports a `<domain>Keys` factory. Query keys are never inlined as raw arrays at the call site.
- Live-updating data uses `refetchInterval` (health: 10s, charts: 30s), not manual polling.
- Global `QueryClient` defaults (set once in `main.tsx`): `refetchOnWindowFocus: false`, `retry: 1`, `staleTime: 5_000`. Don't override per-query unless the data genuinely needs different freshness semantics.

### Client/global UI state → Redux Toolkit, sparingly

Redux is reserved for state that is truly global **and** needs to survive reloads: auth session (`authSlice`) and theme (`themeSlice`), both persisted via `redux-persist` to localStorage. `createSlice`, plain reducers mutating via Immer, no thunks for state this simple.

Do **not** reach for Redux for page-local UI state — filters, toggles, modal open/closed, form drafts. That's local `useState` inside the page's `use<Page>Page.ts`, or `react-hook-form` state if it's form data.

### Rule of thumb

- Comes from the server → **React Query**
- Survives a refresh and is needed app-wide → **Redux (+ persist)**
- Everything else → **local component/hook state**

---

## 6. Data layer

- One axios instance: `src/services/httpClient.ts`. It sets `baseURL` from `VITE_API_BASE_URL`, a 30s timeout, and a response interceptor that normalizes any failure into a typed `ApiError` (`status`, `message`, `body`). Never instantiate axios or call `fetch` elsewhere.
- Never call `httpClient` directly from a component. It's called only from inside a domain hook (`hooks/useXxx.ts`), which wraps it in `useGet`/`usePost`/`usePatch`.
- API request/response shapes live in `services/types.ts`, annotated with which backend file they mirror.
- Errors surfaced to the user go through the hook's `isError`/`error` state and render inline (see `PromChart`'s "query failed" fallback) — never swallowed.

The chain is always: **component → domain hook → generic hook → httpClient**. No shortcuts through the middle.

---

## 7. Styling

- Tailwind v4, CSS-first. There is no `tailwind.config.*`; design tokens are CSS variables in `src/index.css` under `:root` and `.dark` (colors, `--chart-1..5`, `--sidebar-*`, `--radius`). Add new tokens there, not as one-off hex values in components.
- Always compose classNames with `cn()` from `@/lib/utils`, especially for conditional classes. Never string-concatenate or use template literals for classNames.
- Variants use CVA, not ternaries sprinkled through JSX. A `variant`/`size` prop means a `variants.ts` file and `VariantProps<typeof xVariants>` on the props.
- Status colors are fixed across the app: **emerald = ok/up, amber = warn/degraded, red = down/error**. Reuse these; don't invent new status colors.
- Components needing `asChild`-style polymorphism use Radix's `Slot`, matching `Button`.
- Presentational primitives set `data-slot="<name>"` on their root element (see `Card`, `Button`) — it's used for compound-component styling hooks (`has-data-[slot=…]`).
- Charts reference CSS variables (`var(--chart-1)`, `var(--border)`, `var(--muted-foreground)`) instead of hardcoded colors, so they track the active theme.

---

## 8. Forms

All forms use `react-hook-form`. The pattern:

1. The page/feature gets a `use<Thing>` hook that owns `useForm`, validation rules, and the submit handler, and returns `register`/`handleSubmit`/`errors`/`isSubmitting`.
2. The component destructures that hook and renders `Form*` primitives: `FormInput`, `FormPasswordInput`, `FormSelect` — each wraps a base primitive (`Input`, `Select`) with a label, error, and either a `registration` prop (RHF `register`) or `control`+`name` (RHF-controlled, e.g. for Radix Select).
3. Inline field errors render via each `Form*`'s `error` prop; form-level errors use `errors.root.message`.
4. Validation rules are passed inline to `register(...)` — e.g. `{ required: "Username is required" }`. Introduce a schema resolver (zod/yup) only when a form's validation genuinely outgrows inline rules. Don't add that dependency preemptively.

---

## 9. Routing

- All routes are declared in one place: `components/Routes/index.tsx`.
- Auth-gating is a `ProtectedLayout` wrapper that reads `state.auth.isAuthenticated` from Redux and renders either `<Navigate to="/login" />` or `<Layout><Outlet /></Layout>`. New authenticated pages are added as children of that route — never hand-roll a per-page auth check.
- Unknown paths redirect to `/` via a catch-all `*` route. No bespoke 404 page unless product asks for one.
- `Layout` (`components/Layout`) is the app chrome (sidebar + header). Sidebar nav is data-driven from `components/Layout/constants.ts`'s `NAV` array — add a page to the sidebar by adding an entry there, not by hand-writing another `<NavLink>`.

---

## 10. Reusable building blocks — use these, don't reinvent

- **`PageHeader`** — every page's title/description/actions row.
- **`JsonViewer`** — dependency-free collapsible JSON tree with search, expand/collapse-all, copy-to-clipboard.
- **`PromChart`** — a complete Prometheus line-chart panel from `{ title, description, query }`. New metrics panel = a new entry in the page's `PANELS` list, not new recharts boilerplate.
- **`Table`, `Tabs`, `Sheet`, `DropdownMenu`, `Tooltip`** — Radix-backed, already themed. Extend by composition, never by forking.

Before building any UI, check this list and `src/components`. Reinventing one of these is the most common review rejection.

---

## 11. Linting & formatting

- ESLint (`eslint.config.js`) with `@eslint/js` recommended, `typescript-eslint` recommended, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`.
- `npm run lint` before pushing. `npm run build` runs `tsc -b` first, so a type error fails the build, not just lint.
- **Formatting: double quotes, 2-space indentation.** New projects wire up Prettier + lint-staged/husky on day one so this is enforced automatically rather than reviewed by hand. In an existing codebase with mixed style, apply this to new and edited files only — don't reformat untouched files, and flag "add Prettier" for the backlog instead of hand-fixing file by file.

### PR checklist

- [ ] `npm run lint` passes
- [ ] `npm run build` passes (typecheck + build)
- [ ] No new file uses `../../` imports where `@/` would work
- [ ] New API types added to `services/types.ts`, not inlined at the call site
- [ ] New server data goes through a domain hook in `hooks/`, not fetched ad hoc
- [ ] New classNames composed with `cn()`
- [ ] New page logic lives in `use<Page>Page.ts`, not in `index.tsx`
- [ ] New query hook exports a `<domain>Keys` factory

---

## 12. Do / Don't summary

**Do**

- Put page logic in a colocated `use<Page>Page.ts`; keep `index.tsx` presentational.
- Wrap every new endpoint in a domain hook under `hooks/`, using `useGet`/`usePost`/`usePatch`/`useInfiniteGet`.
- Export a `<domain>Keys` factory alongside any new React Query hook.
- Reuse `PageHeader`, `JsonViewer`, `PromChart`, and the `Form*` components instead of rebuilding them.
- Use `cn()` + CVA for anything with conditional or variant classNames.
- Add new design tokens to `index.css`, referenced via `var(--token)`.

**Don't**

- Don't call `fetch`/`axios` or `httpClient` directly from a component.
- Don't put server data in Redux, or page-local UI toggles in Redux.
- Don't hardcode hex colors in components — use theme tokens.
- Don't create a new chart implementation — extend `PromChart`.
- Don't reach into `@/components/Xxx/variants` or `…/types` from outside that component's own files; import the component's public surface only.
- Don't use relative import chains (`../../../lib/utils`) — use `@/lib/utils`.

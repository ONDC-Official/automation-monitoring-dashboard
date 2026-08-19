/**
 * Where this section lives in the URL.
 *
 * Every internal link and `navigate()` in `pages/mcp/**` builds from this
 * rather than hardcoding `/mcp`, so the section can be re-mounted in one edit.
 * The pages were written for a standalone app whose routes were `/reports`,
 * `/sessions` and `/journal`; those are now nested, and `reports` was renamed
 * to `incidents` to match the API, the Mongo collection and the vocabulary the
 * whole system uses.
 */
export const MCP_BASE = "/mcp";

export const MCP_ROUTES = {
  overview: MCP_BASE,
  incidents: `${MCP_BASE}/incidents`,
  sessions: `${MCP_BASE}/sessions`,
  journal: `${MCP_BASE}/journal`,
} as const;

import {
  Activity,
  Bug,
  Database,
  Gauge,
  LayoutDashboard,
  ScrollText,
  Waypoints,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MCP_ROUTES } from "@/pages/mcp/constants";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end: boolean;
}

export interface NavGroup {
  label: string;
  /**
   * A capability this group depends on. `"mcp"` means the group is hidden
   * unless `/api/mcp/config` reports `mcp_enabled` — a deployment with no
   * MONGO_URL has no corpus, and showing four pages that all 503 would be
   * worse than showing none.
   */
  requires?: "mcp";
  items: NavItem[];
}

/** The dashboard's original subject: the mock playground service. */
const NAV: NavItem[] = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/redis", label: "Redis Explorer", icon: Database, end: false },
  { to: "/logs", label: "Logs", icon: ScrollText, end: false },
  { to: "/metrics", label: "Metrics", icon: Activity, end: false },
  { to: "/grafana", label: "Grafana", icon: Gauge, end: false },
];

/**
 * Sections below the main nav. Add a page by adding an entry — never a new
 * `NavLink` in `Layout`.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    label: "MCP Corpus",
    requires: "mcp",
    items: [
      { to: MCP_ROUTES.overview, label: "Overview", icon: LayoutDashboard, end: true },
      { to: MCP_ROUTES.incidents, label: "Incidents", icon: Bug, end: false },
      { to: MCP_ROUTES.sessions, label: "Sessions", icon: Waypoints, end: false },
      { to: MCP_ROUTES.journal, label: "Journal", icon: ScrollText, end: false },
    ],
  },
];

export { NAV, NAV_GROUPS };

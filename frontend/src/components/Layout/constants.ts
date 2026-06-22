import {
  Activity,
  Database,
  Gauge,
  LayoutDashboard,
  ScrollText,
} from "lucide-react";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/redis", label: "Redis Explorer", icon: Database, end: false },
  { to: "/logs", label: "Logs", icon: ScrollText, end: false },
  { to: "/metrics", label: "Metrics", icon: Activity, end: false },
  { to: "/grafana", label: "Grafana", icon: Gauge, end: false },
];

export { NAV };

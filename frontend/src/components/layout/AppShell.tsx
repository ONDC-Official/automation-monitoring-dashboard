import { NavLink } from "react-router-dom";
import {
    Activity,
    Database,
    Gauge,
    LayoutDashboard,
    ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HealthIndicator } from "./HealthIndicator";

const NAV = [
    { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/redis", label: "Redis Explorer", icon: Database, end: false },
    { to: "/logs", label: "Logs", icon: ScrollText, end: false },
    { to: "/metrics", label: "Metrics", icon: Activity, end: false },
    { to: "/grafana", label: "Grafana", icon: Gauge, end: false },
];

export function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
            <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
                <div className="flex h-14 items-center gap-2 border-b px-5">
                    <span className="font-semibold tracking-tight">
                        Automation Monitor
                    </span>
                    <div className="ml-auto">
                        <HealthIndicator />
                    </div>
                </div>
                <nav className="flex flex-1 flex-col gap-1 p-3">
                    {NAV.map(({ to, label, icon: Icon, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            className={({ isActive }) =>
                                cn(
                                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                    isActive
                                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                                )
                            }
                        >
                            <Icon className="size-4" />
                            {label}
                        </NavLink>
                    ))}
                </nav>
                <div className="border-t p-3 text-xs text-muted-foreground">
                    <div>Read-only admin dashboard</div>
                    <div>Real-time production observability</div>
                </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col">
                <main className="min-h-0 flex-1 overflow-auto p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}

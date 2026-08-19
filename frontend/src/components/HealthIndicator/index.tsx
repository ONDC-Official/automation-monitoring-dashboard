import { useHealthQuery } from "@/hooks/useHealth";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/Tooltip";
import { LABELS } from "@/components/HealthIndicator/constants";

const HealthIndicator = () => {
  const { data, isError } = useHealthQuery({ refetchInterval: 10_000 });

  const deps = data?.deps;
  const overall = isError ? "down" : data?.status === "ok" ? "ok" : "degraded";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
          <span
            className={cn(
              "size-2 rounded-full",
              overall === "ok"
                ? "bg-emerald-500"
                : overall === "degraded"
                ? "bg-amber-500"
                : "bg-red-500"
            )}
          />
          <span className="capitalize">{overall}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="p-0">
        <ul className="min-w-44 divide-y">
          {deps
            ? Object.entries(deps).map(([k, state]) => (
                <li
                  key={k}
                  className="flex items-center justify-between gap-4 px-3 py-1.5 text-xs"
                >
                  <span>{LABELS[k] ?? k}</span>
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      // `"disabled"` is a truthy string — check it first, or a
                      // switched-off dependency reads as up.
                      state === "disabled"
                        ? "bg-status-idle"
                        : state
                          ? "bg-status-ok"
                          : "bg-status-error"
                    )}
                  />
                </li>
              ))
            : null}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
};

export default HealthIndicator;

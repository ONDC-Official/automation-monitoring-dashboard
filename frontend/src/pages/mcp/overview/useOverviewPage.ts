import { useMemo } from "react";
import { useConfig } from "@/hooks/useMcp";
import { useHealthQuery } from "@/hooks/useHealth";
import { useSessions } from "@/hooks/useMcp";
import { useStats } from "@/hooks/useMcp";
import { FACET_LIMIT } from "@/pages/mcp/overview/constants";
import { bucketMax, topBuckets } from "@/pages/mcp/overview/utils";
import type { FacetBucket } from "@/services/types";

export interface OverviewTile {
  label: string;
  value: number | null;
  hint: string;
}

export const useOverviewPage = () => {
  const stats = useStats();
  const health = useHealthQuery({ refetchInterval: 10_000 });
  const config = useConfig();
  const sessions = useSessions();

  const tiles = useMemo<OverviewTile[]>(() => {
    const data = stats.data;
    return [
      {
        label: "Incidents",
        value: data?.incidents_total ?? null,
        hint: "Distinct fingerprints in the corpus",
      },
      {
        label: "Open",
        value: data?.incidents_open ?? null,
        hint: "Not fixed, not dismissed",
      },
      {
        label: "Untriaged",
        value: data?.incidents_untracked ?? null,
        hint: "Nobody has picked these up yet",
      },
      {
        label: "Reports",
        value: data?.reports_total ?? null,
        hint: "Individual incident reports received",
      },
      {
        label: "Installs",
        value: data?.installs ?? null,
        hint: "Distinct engine installs reporting in",
      },
      {
        label: "Sessions",
        value: sessions.data?.total ?? null,
        hint: "Mirrored mock-NP sessions",
      },
    ];
  }, [stats.data, sessions.data]);

  const facets = useMemo(() => {
    const data = stats.data;
    const pick = (buckets: FacetBucket[] | undefined) => {
      const list = topBuckets(buckets ?? [], FACET_LIMIT);
      return { buckets: list, max: bucketMax(list) };
    };
    return {
      by_trigger: pick(data?.by_trigger),
      by_state: pick(data?.by_state),
      by_domain: pick(data?.by_domain),
      by_status: pick(data?.by_status),
    };
  }, [stats.data]);

  const recoveryTotal = useMemo(() => {
    const recovery = stats.data?.recovery;
    if (!recovery) return 0;
    return Object.values(recovery).reduce((sum, value) => sum + value, 0);
  }, [stats.data]);

  return {
    stats,
    health,
    config,
    tiles,
    facets,
    recovery: stats.data?.recovery ?? null,
    recoveryTotal,
    topFlows: stats.data?.top_flows ?? [],
    refresh: () => {
      void stats.refetch();
      void health.refetch();
      void sessions.refetch();
    },
  };
};

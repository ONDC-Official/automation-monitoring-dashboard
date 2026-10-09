import { RefreshCw } from "lucide-react";
import Button from "@/components/Button";
import PageHeader from "@/components/PageHeader";
import { PromChart } from "@/components/PromChart";
import { FacetBars } from "@/pages/mcp/overview/FacetBars";
import { HealthPanel } from "@/pages/mcp/overview/HealthPanel";
import { PANELS } from "@/pages/mcp/overview/constants";
import { RecoveryPanel } from "@/pages/mcp/overview/RecoveryPanel";
import { StatTile } from "@/pages/mcp/overview/StatTile";
import { TopFlowsTable } from "@/pages/mcp/overview/TopFlowsTable";
import { useOverviewPage } from "@/pages/mcp/overview/useOverviewPage";

export const Overview = () => {
  const {
    stats,
    health,
    config,
    tiles,
    facets,
    recovery,
    recoveryTotal,
    topFlows,
    refresh,
  } = useOverviewPage();

  return (
    <>
      <PageHeader
        title="Overview"
        description="The corpus at a glance: what is failing, how often, and whether the engine that reports it is healthy."
        actions={
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw />
            Refresh
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((tile) => (
          <StatTile
            key={tile.label}
            label={tile.label}
            value={tile.value}
            hint={tile.hint}
            isLoading={stats.isLoading}
          />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HealthPanel
          health={health.data}
          config={config.data}
          isLoading={health.isLoading}
          isError={health.isError}
          error={health.error}
          onRetry={refresh}
        />
        <RecoveryPanel
          recovery={recovery}
          total={recoveryTotal}
          isLoading={stats.isLoading}
          isError={stats.isError}
          error={stats.error}
          onRetry={refresh}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FacetBars
          title="By trigger"
          description="What kind of thing went wrong"
          buckets={facets.by_trigger.buckets}
          max={facets.by_trigger.max}
          isLoading={stats.isLoading}
          isError={stats.isError}
          error={stats.error}
          filterParam="trigger"
        />
        <FacetBars
          title="By state"
          description="Where the run ended up"
          buckets={facets.by_state.buckets}
          max={facets.by_state.max}
          isLoading={stats.isLoading}
          isError={stats.isError}
          error={stats.error}
          filterParam="state"
        />
        <FacetBars
          title="By domain"
          buckets={facets.by_domain.buckets}
          max={facets.by_domain.max}
          isLoading={stats.isLoading}
          isError={stats.isError}
          error={stats.error}
          filterParam="domain"
        />
        <FacetBars
          title="By triage status"
          buckets={facets.by_status.buckets}
          max={facets.by_status.max}
          isLoading={stats.isLoading}
          isError={stats.isError}
          error={stats.error}
          filterParam="status"
        />
      </section>

      <TopFlowsTable
        flows={topFlows}
        isLoading={stats.isLoading}
        isError={stats.isError}
        error={stats.error}
      />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        {PANELS.map((panel) => (
          <PromChart key={panel.title} {...panel} />
        ))}
      </section>
    </>
  );
};

// Default export to match this app's page convention (see components/Routes).
export default Overview;

import PageHeader from "@/components/PageHeader";
import { PromChart } from "@/components/PromChart";
import { PANELS } from "@/pages/metrics/constants";

const Metrics = () => (
  <div className="space-y-4">
    <PageHeader
      title="Metrics"
      description="Native charts from the Prometheus query API. Edit the queries in src/pages/metrics/constants.ts."
    />
    <div className="grid gap-4 lg:grid-cols-2">
      {PANELS.map((p) => (
        <PromChart key={p.title} {...p} />
      ))}
    </div>
  </div>
);

export default Metrics;

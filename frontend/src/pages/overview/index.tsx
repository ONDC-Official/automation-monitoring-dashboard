import { useHealthQuery } from "@/hooks/useHealth";
import { useRedisDbs } from "@/hooks/useRedis";
import PageHeader from "@/components/PageHeader";
import { DepsSection } from "@/pages/overview/DepsSection";
import { RedisSection } from "@/pages/overview/RedisSection";

const Overview = () => {
  const health = useHealthQuery({ refetchInterval: 10_000 });
  const dbs = useRedisDbs();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Live health of every dependency the dashboard observes."
      />
      <DepsSection deps={health.data?.deps} />
      <RedisSection dbs={dbs.data?.dbs ?? []} />
    </div>
  );
};

export default Overview;

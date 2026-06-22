import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const DEP_LABELS: Record<string, string> = {
    redisDb0: 'Redis DB0 (business)',
    redisDb1: 'Redis DB1 (runner)',
    prometheus: 'Prometheus',
    loki: 'Loki',
    grafana: 'Grafana',
    monitoredService: 'Mock Service',
};

export function OverviewPage() {
    const health = useQuery({
        queryKey: ['health'],
        queryFn: api.health,
        refetchInterval: 10_000,
    });
    const dbs = useQuery({ queryKey: ['redis-dbs'], queryFn: api.redisDbs });

    return (
        <div className="space-y-6">
            <PageHeader
                title="Overview"
                description="Live health of every dependency the dashboard observes."
            />

            <section>
                <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                    Dependencies
                </h2>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                    {health.isLoading
                        ? Array.from({ length: 6 }).map((_, i) => (
                              <Skeleton key={i} className="h-20" />
                          ))
                        : Object.entries(health.data?.deps ?? {}).map(
                              ([k, up]) => (
                                  <Card key={k}>
                                      <CardContent className="flex flex-col gap-2 p-4">
                                          <span className="text-xs text-muted-foreground">
                                              {DEP_LABELS[k] ?? k}
                                          </span>
                                          <span className="flex items-center gap-2 text-sm font-medium">
                                              <span
                                                  className={cn(
                                                      'size-2.5 rounded-full',
                                                      up
                                                          ? 'bg-emerald-500'
                                                          : 'bg-red-500'
                                                  )}
                                              />
                                              {up ? 'Up' : 'Down'}
                                          </span>
                                      </CardContent>
                                  </Card>
                              )
                          )}
                </div>
            </section>

            <section>
                <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                    Redis keyspace
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                    {(dbs.data?.dbs ?? []).map(db => (
                        <Card key={db.db}>
                            <CardHeader>
                                <CardTitle className="text-base">
                                    DB{db.db} · {db.label}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex items-end justify-between">
                                <div>
                                    <div className="text-3xl font-semibold">
                                        {db.dbsize.toLocaleString()}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        keys
                                    </div>
                                </div>
                                <Link
                                    to={`/redis?db=${db.db}`}
                                    className="text-sm text-primary underline-offset-4 hover:underline"
                                >
                                    Explore →
                                </Link>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </section>
        </div>
    );
}

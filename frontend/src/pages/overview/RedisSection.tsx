import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card";

interface DbInfo {
  db: number;
  label: string;
  dbsize: number;
}

interface Props {
  dbs: DbInfo[];
}

export function RedisSection({ dbs }: Props) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">
        Redis keyspace
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {dbs.map((db) => (
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
                <div className="text-xs text-muted-foreground">keys</div>
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
  );
}

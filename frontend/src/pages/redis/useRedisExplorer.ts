import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useRedisDbs, useRedisScan, useRedisInspect } from "@/hooks/useRedis";
import { ALL } from "./constants";

export function useRedisExplorer() {
  const [searchParams] = useSearchParams();
  const [db, setDb] = useState<number>(Number(searchParams.get("db") ?? 0));
  const [match, setMatch] = useState("*");
  const [matchInput, setMatchInput] = useState("*");
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [keyFilter, setKeyFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const dbs = useRedisDbs();
  const scan = useRedisScan(db, match);
  const inspect = useRedisInspect(db, selected);

  const dbOptions = dbs.data?.dbs ?? [
    { db: 0, label: "business", dbsize: 0 },
    { db: 1, label: "runner config", dbsize: 0 },
  ];
  const dbTotal = dbOptions.find((d) => d.db === db)?.dbsize;

  const loaded = useMemo(
    () => (scan.data?.pages ?? []).flatMap((p) => p.keys),
    [scan.data]
  );

  const typeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const k of loaded) m[k.businessType] = (m[k.businessType] ?? 0) + 1;
    return m;
  }, [loaded]);

  const keyQuery = keyFilter.trim().toLowerCase();

  const keys = useMemo(
    () =>
      loaded.filter(
        (k) =>
          (typeFilter === ALL || k.businessType === typeFilter) &&
          (!keyQuery || k.key.toLowerCase().includes(keyQuery))
      ),
    [loaded, typeFilter, keyQuery]
  );

  const onDbChange = (v: string) => {
    setDb(Number(v));
    setSelected(null);
  };

  const onScan = () => setMatch(matchInput || "*");

  return {
    db, onDbChange,
    matchInput, setMatchInput,
    typeFilter, setTypeFilter,
    keyFilter, setKeyFilter,
    selected, setSelected,
    dbOptions, dbTotal,
    loaded, typeCounts, keyQuery, keys,
    scan, inspect,
    onScan,
  };
}

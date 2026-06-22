import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";
import Button from "@/components/Button";
import { useRedisExplorer } from "./useRedisExplorer";
import { RedisToolbar } from "./RedisToolbar";
import { RedisTable } from "./RedisTable";
import { KeyInspector } from "./KeyInspector";

const Redis = () => {
  const {
    db,
    onDbChange,
    matchInput,
    setMatchInput,
    typeFilter,
    setTypeFilter,
    keyFilter,
    setKeyFilter,
    selected,
    setSelected,
    dbOptions,
    dbTotal,
    loaded,
    typeCounts,
    keyQuery,
    keys,
    scan,
    inspect,
    onScan,
  } = useRedisExplorer();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Redis Explorer"
        description="SCAN-based, business-decoded view of the cache. Read-only."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => scan.refetch()}
            disabled={scan.isFetching}
          >
            <RefreshCw
              className={cn(
                "size-4",
                scan.isFetching && !scan.isFetchingNextPage && "animate-spin"
              )}
            />
            Refresh
          </Button>
        }
      />

      <RedisToolbar
        db={db}
        onDbChange={onDbChange}
        matchInput={matchInput}
        setMatchInput={setMatchInput}
        onScan={onScan}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        keyFilter={keyFilter}
        setKeyFilter={setKeyFilter}
        dbOptions={dbOptions}
        typeCounts={typeCounts}
        loadedCount={loaded.length}
        shownCount={keys.length}
        dbTotal={dbTotal}
      />

      <RedisTable
        keys={keys}
        selected={selected}
        onSelect={setSelected}
        keyQuery={keyQuery}
        hasNextPage={scan.hasNextPage}
        isFetchingNextPage={scan.isFetchingNextPage}
        onLoadMore={() => scan.fetchNextPage()}
      />

      <KeyInspector
        selected={selected}
        onClose={() => setSelected(null)}
        inspect={inspect}
      />
    </div>
  );
};

export default Redis;

import { Search, X } from "lucide-react";
import Button from "@/components/Button";
import { Input } from "@/components/Input";
import FormSelect from "@/components/FormSelect";
import { ALL, BUSINESS_TYPES } from "./constants";

interface DbOption {
  db: number;
  label: string;
  dbsize: number;
}

interface Props {
  db: number;
  onDbChange: (v: string) => void;
  matchInput: string;
  setMatchInput: (v: string) => void;
  onScan: () => void;
  typeFilter: string;
  setTypeFilter: (v: string) => void;
  keyFilter: string;
  setKeyFilter: (v: string) => void;
  dbOptions: DbOption[];
  typeCounts: Record<string, number>;
  loadedCount: number;
  shownCount: number;
  dbTotal: number | undefined;
}

export function RedisToolbar({
  db,
  onDbChange,
  matchInput,
  setMatchInput,
  onScan,
  typeFilter,
  setTypeFilter,
  keyFilter,
  setKeyFilter,
  dbOptions,
  typeCounts,
  loadedCount,
  shownCount,
  dbTotal,
}: Props) {
  const dbSelectOptions = dbOptions.map((d) => ({
    label: `DB${d.db} · ${d.label}${d.dbsize ? ` · ${d.dbsize.toLocaleString()} keys` : ""}`,
    value: String(d.db),
  }));

  const typeSelectOptions = BUSINESS_TYPES.map((t) => ({
    label:
      t === ALL
        ? `All types (${loadedCount})`
        : `${t}${typeCounts[t] ? ` (${typeCounts[t]})` : ""}`,
    value: t,
  }));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FormSelect
        value={String(db)}
        onChange={onDbChange}
        options={dbSelectOptions}
        triggerClassName="w-56"
        size="sm"
      />

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onScan();
        }}
      >
        <Input
          value={matchInput}
          onChange={(e) => setMatchInput(e.target.value)}
          placeholder="SCAN MATCH e.g. FLOW_STATUS_*"
          className="w-64 font-mono text-xs"
        />
        <Button type="submit" variant="secondary" size="sm">
          Scan
        </Button>
      </form>

      <FormSelect
        value={typeFilter}
        onChange={setTypeFilter}
        options={typeSelectOptions}
        placeholder="Business type"
        triggerClassName="w-52"
        size="sm"
      />

      <div className="relative w-56">
        <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={keyFilter}
          onChange={(e) => setKeyFilter(e.target.value)}
          placeholder="Filter loaded keys…"
          className="px-7"
        />
        {keyFilter ? (
          <button
            type="button"
            onClick={() => setKeyFilter("")}
            className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      <span className="ml-auto text-sm text-muted-foreground">
        {shownCount.toLocaleString()} shown ·{" "}
        {loadedCount.toLocaleString()} loaded
        {typeof dbTotal === "number" && dbTotal > 0
          ? ` · ${dbTotal.toLocaleString()} in DB`
          : ""}
      </span>
    </div>
  );
}

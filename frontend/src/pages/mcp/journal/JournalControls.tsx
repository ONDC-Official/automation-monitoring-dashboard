import { Pause, Play, RefreshCw, X } from "lucide-react";
import Button from "@/components/Button";
import { Input } from "@/components/Input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select";
import { HintTooltip } from "@/components/Tooltip";
import { ControlField } from "@/pages/mcp/journal/ControlField";
import {
  ALL_KINDS,
  LIMIT_OPTIONS,
  LIVE_POLL_SECONDS,
} from "@/pages/mcp/journal/constants";
import { kindLabel } from "@/pages/mcp/journal/utils";
import { cn } from "@/lib/utils";

interface IJournalControlsProps {
  live: boolean;
  onToggleLive: () => void;
  isFetching: boolean;
  onRefresh: () => void;
  limit: number;
  onLimitChange: (limit: number) => void;
  afterSeqText: string;
  onAfterSeqChange: (value: string) => void;
  kind: string;
  kinds: string[];
  onKindChange: (kind: string) => void;
  text: string;
  onTextChange: (text: string) => void;
  onClear: () => void;
}

/**
 * `after_seq` and `limit` are server-side (they change the request); kind and
 * text are client-side filters over what came back. The labels say so, because
 * an operator who confuses the two silently narrows the fetch itself.
 */
export const JournalControls = ({
  live,
  onToggleLive,
  isFetching,
  onRefresh,
  limit,
  onLimitChange,
  afterSeqText,
  onAfterSeqChange,
  kind,
  kinds,
  onKindChange,
  text,
  onTextChange,
  onClear,
}: IJournalControlsProps) => (
  <div className="flex flex-wrap items-end gap-3">
    <ControlField label="Tail">
      <div className="flex items-center gap-1.5">
        <HintTooltip
          label={
            live
              ? `Live: refetching every ${LIVE_POLL_SECONDS}s`
              : "Paused: the log only refreshes when you ask it to"
          }
        >
          <Button
            variant={live ? "default" : "outline"}
            size="sm"
            onClick={onToggleLive}
            aria-pressed={live}
          >
            {live ? <Pause /> : <Play />}
            {live ? `Live · ${LIVE_POLL_SECONDS}s poll` : "Paused"}
          </Button>
        </HintTooltip>
        <HintTooltip label="Refetch now">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            aria-label="Refetch the journal"
          >
            <RefreshCw className={cn(isFetching && "animate-spin")} />
          </Button>
        </HintTooltip>
      </div>
    </ControlField>

    <ControlField label="Limit">
      <Select
        value={String(limit)}
        onValueChange={(next) => onLimitChange(Number(next))}
      >
        <SelectTrigger className="w-24" aria-label="Limit">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LIMIT_OPTIONS.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </ControlField>

    <ControlField label="After seq" htmlFor="journal-after-seq">
      <Input
        id="journal-after-seq"
        className="w-28 font-mono"
        inputMode="numeric"
        placeholder="0"
        value={afterSeqText}
        onChange={(event) => onAfterSeqChange(event.target.value)}
      />
    </ControlField>

    <ControlField label="Kind">
      <Select value={kind} onValueChange={onKindChange}>
        <SelectTrigger className="w-56" aria-label="Kind">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_KINDS}>All kinds</SelectItem>
          {kinds.map((option) => (
            <SelectItem key={option} value={option}>
              {kindLabel(option)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </ControlField>

    <ControlField
      label="Filter"
      htmlFor="journal-text"
      className="min-w-56 flex-1"
    >
      <Input
        id="journal-text"
        placeholder="action, flow, transaction id, NACK code…"
        value={text}
        onChange={(event) => onTextChange(event.target.value)}
      />
    </ControlField>

    <Button variant="ghost" size="sm" onClick={onClear}>
      <X />
      Clear
    </Button>
  </div>
);

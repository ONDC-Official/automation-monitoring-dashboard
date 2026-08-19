import { ChevronLeft, ChevronRight } from "lucide-react";
import Button from "@/components/Button";
import { formatNumber } from "@/lib/format";

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  limit: number;
  skip: number;
  shown: number;
  onGoTo: (page: number) => void;
  isFetching: boolean;
}

export const Pagination = ({
  page,
  pages,
  total,
  skip,
  shown,
  onGoTo,
  isFetching,
}: PaginationProps) => (
  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
    <span className="text-xs text-muted-foreground tabular-nums">
      {shown === 0
        ? "Nothing to show"
        : `${formatNumber(skip + 1)}–${formatNumber(skip + shown)} of ${formatNumber(total)}`}
      {isFetching ? " · refreshing" : ""}
    </span>
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onGoTo(page - 1)}
      >
        <ChevronLeft />
        Previous
      </Button>
      <span className="text-xs text-muted-foreground tabular-nums">
        Page {page} of {pages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= pages}
        onClick={() => onGoTo(page + 1)}
      >
        Next
        <ChevronRight />
      </Button>
    </div>
  </div>
);

import { Link } from "react-router-dom";
import { RefreshCw, ScrollText } from "lucide-react";
import { StatusBadge } from "@/components/Badge";
import Button from "@/components/Button";
import { Card, CardContent } from "@/components/Card";
import PageHeader from "@/components/PageHeader";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/Sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/Tabs";
import { truncateMiddle } from "@/lib/format";
import { cn } from "@/lib/utils";
import { RunsTable } from "@/pages/mcp/sessions/RunsTable";
import { SessionSummary } from "@/pages/mcp/sessions/SessionSummary";
import { SessionsTable } from "@/pages/mcp/sessions/SessionsTable";
import { SummaryTiles } from "@/pages/mcp/sessions/SummaryTiles";
import {
  PAGE_DESCRIPTION,
  PAGE_TITLE,
  SESSION_TABS,
} from "@/pages/mcp/sessions/constants";
import { useSessionsPage } from "@/pages/mcp/sessions/useSessionsPage";
import { MCP_ROUTES } from "@/pages/mcp/constants";

export const Sessions = () => {
  const { tab, tabCounts, sessionsByTab, emptyLabels, summary, ...page } =
    useSessionsPage();
  const { detail, list, runsTotal } = page;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        actions={
          <Button variant="outline" size="sm" onClick={page.onRefresh}>
            <RefreshCw
              className={cn("size-4", list.isFetching && "animate-spin")}
            />
            Refresh
          </Button>
        }
      />

      <SummaryTiles
        total={summary.total}
        active={summary.active}
        expired={summary.expired}
        runs={summary.runs}
        isLoading={list.isLoading}
        isError={list.isError}
        error={list.error}
        onRetry={list.onRetry}
        runsIsLoading={runsTotal.isLoading}
        runsIsError={runsTotal.isError}
        runsError={runsTotal.error}
        onRetryRuns={runsTotal.onRetry}
      />

      <Tabs value={tab} onValueChange={page.onTabChange}>
        <TabsList variant="line">
          {SESSION_TABS.map((entry) => (
            <TabsTrigger
              key={entry.value}
              value={entry.value}
            >
              {entry.label}
              <StatusBadge tone="neutral" size="sm">
                {tabCounts[entry.value]}
              </StatusBadge>
            </TabsTrigger>
          ))}
        </TabsList>

        {SESSION_TABS.map((entry) => (
          <TabsContent key={entry.value} value={entry.value}>
            <Card className="py-0">
              <CardContent className="px-0">
                <SessionsTable
                  sessions={sessionsByTab[entry.value]}
                  isLoading={list.isLoading}
                  isError={list.isError}
                  error={list.error}
                  emptyLabel={emptyLabels[entry.value]}
                  onRetry={list.onRetry}
                  onSelect={page.onSelectSession}
                />
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <Sheet open={detail.isOpen} onOpenChange={detail.onOpenChange}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle className="font-mono">
              {truncateMiddle(detail.sessionRef ?? "", 40)}
            </SheetTitle>
            <SheetDescription>
              The mirrored session and every flow run opened against it.
            </SheetDescription>
          </SheetHeader>

          <SheetBody className="flex flex-col gap-6 pt-4">
            <SessionSummary
              session={detail.session}
              isLoading={detail.isLoading}
              isError={detail.isError}
              error={detail.error}
              onRetry={detail.onRetry}
            />

            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold tracking-tight">Runs</h2>
              <RunsTable
                runs={detail.runs}
                isLoading={detail.runsIsLoading}
                isError={detail.runsIsError}
                error={detail.runsError}
                onRetry={detail.onRetryRuns}
              />
            </div>
          </SheetBody>

          <SheetFooter>
            <Button variant="secondary" size="sm" asChild>
              <Link
                to={`${MCP_ROUTES.journal}/${encodeURIComponent(detail.sessionRef ?? "")}`}
              >
                <ScrollText className="size-4" />
                Open wire log
              </Link>
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
};

// Default export to match this app's page convention (see components/Routes).
export default Sessions;

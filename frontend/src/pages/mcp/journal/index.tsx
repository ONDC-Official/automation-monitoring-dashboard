import { Card, CardContent, CardHeader } from "@/components/Card";
import PageHeader from "@/components/PageHeader";
import { JournalControls } from "@/pages/mcp/journal/JournalControls";
import { JournalTable } from "@/pages/mcp/journal/JournalTable";
import { NoSessionPanel } from "@/pages/mcp/journal/NoSessionPanel";
import { SessionPicker } from "@/pages/mcp/journal/SessionPicker";
import { SessionSummary } from "@/pages/mcp/journal/SessionSummary";
import { useJournalPage } from "@/pages/mcp/journal/useJournalPage";

/**
 * The wire log for one session: every entry the engine journalled, in seq
 * order. Presentational only — all state lives in `useJournalPage`.
 */
export const Journal = () => {
  const page = useJournalPage();

  return (
    <>
      <PageHeader
        title="Journal"
        description="The protocol debugging view: every ACK, NACK, chained send and payload override this mock recorded, in the order the engine observed them."
        actions={
          <SessionPicker
            sessions={page.sessionOptions}
            value={page.sessionRef}
            isLoading={page.sessionsQuery.isLoading}
            isError={page.sessionsQuery.isError}
            error={page.sessionsQuery.error}
            onRetry={page.retrySessions}
            onSelect={page.selectSession}
          />
        }
      />

      {page.sessionRef ? (
        <Card>
          <CardHeader>
            <SessionSummary
              sessionRef={page.sessionRef}
              session={page.activeSession}
            />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <JournalControls
              live={page.live}
              onToggleLive={page.toggleLive}
              isFetching={page.journalQuery.isFetching}
              onRefresh={page.refresh}
              limit={page.limit}
              onLimitChange={page.setLimit}
              afterSeqText={page.afterSeqText}
              onAfterSeqChange={page.setAfterSeqText}
              kind={page.kind}
              kinds={page.kinds}
              onKindChange={page.setKind}
              text={page.text}
              onTextChange={page.setText}
              onClear={page.clearFilters}
            />
            <JournalTable
              rows={page.rows}
              isLoading={page.journalQuery.isLoading}
              isError={page.journalQuery.isError}
              error={page.journalQuery.error}
              onRetry={page.refresh}
              onCopy={page.copyValue}
              returned={page.totalReturned}
              total={page.total}
              filtered={page.isFiltered}
            />
          </CardContent>
        </Card>
      ) : (
        <NoSessionPanel />
      )}
    </>
  );
};

// Default export to match this app's page convention (see components/Routes).
export default Journal;

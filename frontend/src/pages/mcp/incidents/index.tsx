import { RefreshCw } from "lucide-react";
import { StatusBadge } from "@/components/Badge";
import Button from "@/components/Button";
import { Card, CardContent } from "@/components/Card";
import PageHeader from "@/components/PageHeader";
import { FilterForm } from "@/pages/mcp/incidents/FilterForm";
import { IncidentDetail } from "@/pages/mcp/incidents/IncidentDetail";
import { IncidentsTable } from "@/pages/mcp/incidents/IncidentsTable";
import { Pagination } from "@/pages/mcp/incidents/Pagination";
import { useReportsPage } from "@/pages/mcp/incidents/useReportsPage";
import { formatNumber } from "@/lib/format";

export const Incidents = () => {
  const {
    incidents,
    rows,
    total,
    limit,
    page,
    pages,
    skip,
    goToPage,
    filterForm,
    applyFilters,
    resetFilters,
    activeFilterCount,
    selected,
    detail,
    report,
    openIncident,
    closeIncident,
    triageForm,
    submitStatus,
    submitComment,
    submitLink,
    submitDismiss,
    triagePending,
  } = useReportsPage();

  return (
    <>
      <PageHeader
        title="Reports"
        description="The incident corpus. Every stuck run reports itself; this is where those reports are read, triaged and closed."
        actions={
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 ? (
              <StatusBadge tone="info">{activeFilterCount} filters</StatusBadge>
            ) : null}
            <StatusBadge tone="neutral">{formatNumber(total)} matching</StatusBadge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void incidents.refetch()}
            >
              <RefreshCw />
              Refresh
            </Button>
          </div>
        }
      />

      <FilterForm
        form={filterForm}
        onSubmit={applyFilters}
        onReset={resetFilters}
        isFetching={incidents.isFetching}
      />

      <Card>
        <CardContent className="flex flex-col gap-3">
          <IncidentsTable
            rows={rows}
            isLoading={incidents.isLoading}
            isError={incidents.isError}
            error={incidents.error}
            onRetry={() => void incidents.refetch()}
            onSelect={openIncident}
            selected={selected}
          />
          <Pagination
            page={page}
            pages={pages}
            total={total}
            limit={limit}
            skip={skip}
            shown={rows.length}
            onGoTo={goToPage}
            isFetching={incidents.isFetching}
          />
        </CardContent>
      </Card>

      <IncidentDetail
        fingerprint={selected}
        detail={detail.data}
        report={report}
        isLoading={detail.isLoading}
        isError={detail.isError}
        error={detail.error}
        onRetry={() => void detail.refetch()}
        onClose={closeIncident}
        triageForm={triageForm}
        onStatus={submitStatus}
        onComment={submitComment}
        onLink={submitLink}
        onDismiss={submitDismiss}
        triagePending={triagePending}
      />
    </>
  );
};

// Default export to match this app's page convention (see components/Routes).
export default Incidents;

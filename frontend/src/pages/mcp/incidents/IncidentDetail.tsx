import type { FormEventHandler, ReactNode } from "react";
import type { UseFormReturn } from "react-hook-form";
import { StatusBadge } from "@/components/Badge";
import JsonViewer from "@/components/JsonViewer";
import { QueryState } from "@/components/QueryState";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/Sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/Table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/Tabs";
import { HintTooltip } from "@/components/Tooltip";
import {
  formatDateTime,
  formatNumber,
  formatRelative,
  truncateMiddle,
} from "@/lib/format";
import { DETAIL_TABS } from "@/pages/mcp/incidents/constants";
import { TriageActions } from "@/pages/mcp/incidents/TriageActions";
import type { TriageForm } from "@/pages/mcp/incidents/useReportsPage";
import { findingTone, stateTone, triageTone } from "@/pages/mcp/incidents/utils";
import { cn } from "@/lib/utils";
import type { IncidentDetailResponse, IssueReport } from "@/services/types";

interface IncidentDetailProps {
  fingerprint: string | null;
  detail: IncidentDetailResponse | undefined;
  report: Partial<IssueReport> | null;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  onClose: () => void;
  triageForm: UseFormReturn<TriageForm>;
  onStatus: FormEventHandler<HTMLFormElement>;
  onComment: FormEventHandler<HTMLFormElement>;
  onLink: FormEventHandler<HTMLFormElement>;
  onDismiss: FormEventHandler<HTMLFormElement>;
  triagePending: boolean;
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-[11px] text-muted-foreground">{label}</span>
    <span className="text-xs break-all">{children}</span>
  </div>
);

export const IncidentDetail = ({
  fingerprint,
  detail,
  report,
  isLoading,
  isError,
  error,
  onRetry,
  onClose,
  triageForm,
  onStatus,
  onComment,
  onLink,
  onDismiss,
  triagePending,
}: IncidentDetailProps) => {
  const incident = detail?.incident;
  const findings = report?.evidence?.findings ?? [];
  const narration = report?.narration ?? null;

  return (
    <Sheet
      open={Boolean(fingerprint)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle className="font-mono text-sm break-all">
            {incident?.code ?? fingerprint ?? "Incident"}
          </SheetTitle>
          <SheetDescription>
            {incident
              ? `${incident.domain} ${incident.version} · ${incident.flow_id}`
              : "Loading the incident…"}
          </SheetDescription>
          {incident ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusBadge tone={stateTone(incident.latest_state)}>
                {incident.latest_state}
              </StatusBadge>
              <StatusBadge tone={triageTone(incident.triage_status)}>
                {incident.triage_status}
              </StatusBadge>
              <StatusBadge tone="outline">{incident.trigger}</StatusBadge>
              <StatusBadge tone="neutral">
                {formatNumber(incident.occurrences_total)} occurrences
              </StatusBadge>
              <StatusBadge tone="neutral">
                {formatNumber(incident.distinct_runs)} runs
              </StatusBadge>
              {incident.triage_notes > 0 ? (
                <StatusBadge tone="neutral">
                  {formatNumber(incident.triage_notes)} triage notes
                </StatusBadge>
              ) : null}
            </div>
          ) : null}
        </SheetHeader>

        <SheetBody className="flex flex-col gap-4 pt-4">
          <QueryState
            isLoading={isLoading}
            isError={isError}
            error={error}
            onRetry={onRetry}
          >
            <section className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3 sm:grid-cols-4">
              <Field label="Fingerprint">
                <HintTooltip label={fingerprint ?? ""}>
                  <span className="font-mono">
                    {truncateMiddle(fingerprint ?? "", 20)}
                  </span>
                </HintTooltip>
              </Field>
              <Field label="First seen">
                {formatDateTime(incident?.first_seen_at)}
              </Field>
              <Field label="Last seen">
                {formatRelative(incident?.last_seen_at)}
              </Field>
              <Field label="Installs">
                {formatNumber(incident?.installs ?? null)}
              </Field>
              <Field label="Step / action">
                <span className="font-mono">
                  {incident?.step_key ?? incident?.action ?? "—"}
                </span>
              </Field>
              <Field label="Mock roles">
                {(detail?.mock_roles ?? []).join(", ") || "—"}
              </Field>
              <Field label="Suspected causes">
                {(detail?.suspected_causes ?? []).join(", ") || "—"}
              </Field>
              <Field label="States seen">
                {Object.entries(detail?.state_counts ?? {})
                  .map(([state, count]) => `${state} ${count}`)
                  .join(" · ") || "—"}
              </Field>
            </section>

            <Tabs defaultValue="issue">
              <TabsList variant="line">
                {DETAIL_TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                  >
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="issue" className="flex flex-col gap-3">
                {detail?.rendered_summary ? (
                  <>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {detail.rendered_summary.labels.map((label) => (
                        <StatusBadge key={label} tone="info">
                          {label}
                        </StatusBadge>
                      ))}
                    </div>
                    <h3 className="text-sm font-semibold">
                      {detail.rendered_summary.title}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      A paste-ready write-up. Nothing files this anywhere.
                    </p>
                    <pre className="max-h-[32rem] overflow-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-[11px] whitespace-pre-wrap scrollbar-thin">
                      {detail.rendered_summary.body}
                    </pre>
                  </>
                ) : (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    Nothing has been rendered for this incident yet.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="findings" className="flex flex-col gap-3">
                {findings.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Layer</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Path</TableHead>
                        <TableHead>Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {findings.map((finding, index) => (
                        <TableRow key={`${finding.code}-${index}`}>
                          <TableCell>
                            <StatusBadge tone={findingTone(finding.layer)}>
                              {finding.layer}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {finding.code}
                          </TableCell>
                          <TableCell className="font-mono text-xs break-all">
                            {finding.json_path}
                          </TableCell>
                          <TableCell className="text-xs">
                            {finding.message}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    This incident carries no validation findings.
                  </p>
                )}

                {report?.evidence?.unchecked?.length ? (
                  <div className="rounded-lg border border-status-warn/30 bg-status-warn-soft/50 p-3 text-xs">
                    <p className="font-medium text-status-warn">
                      Layers not checked
                    </p>
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {report.evidence.unchecked.map((item) => (
                        <li key={item.layer}>
                          <span className="font-mono">{item.layer}</span> —{" "}
                          {item.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {report?.evidence?.message ? (
                  <Field label="Evidence">{report.evidence.message}</Field>
                ) : null}
                {report?.evidence?.sequence ? (
                  <Field label="Sequence">
                    expected{" "}
                    <span className="font-mono">
                      {report.evidence.sequence.expected_action ?? "—"}
                    </span>
                    , received{" "}
                    <span className="font-mono">
                      {report.evidence.sequence.received_action ?? "—"}
                    </span>
                  </Field>
                ) : null}
                {report?.evidence?.runner_logs?.length ? (
                  <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-muted/30 p-3 font-mono text-[11px] whitespace-pre-wrap scrollbar-thin">
                    {report.evidence.runner_logs.join("\n")}
                  </pre>
                ) : null}
              </TabsContent>

              <TabsContent value="narration" className="flex flex-col gap-3">
                {narration ? (
                  <>
                    <Field label="Diagnosis">{narration.diagnosis}</Field>
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] text-muted-foreground">
                        Attempted
                      </span>
                      <ol className="list-decimal pl-5 text-xs">
                        {narration.attempted.map((step, index) => (
                          <li key={`${index}-${step.slice(0, 12)}`}>{step}</li>
                        ))}
                      </ol>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge tone="outline">outcome: {narration.outcome}</StatusBadge>
                      <StatusBadge tone="outline">
                        suspected: {narration.suspected_cause}
                      </StatusBadge>
                      <StatusBadge tone="neutral">
                        {formatDateTime(narration.at)}
                      </StatusBadge>
                    </div>
                    {narration.tooling_gap ? (
                      <div
                        className={cn(
                          "rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs",
                        )}
                      >
                        <p className="font-medium text-primary">Tooling gap</p>
                        <p className="mt-1">{narration.tooling_gap}</p>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    The model never narrated this incident. The report shipped
                    anyway — that is the point of capturing it in code.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="deliveries">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Generated</TableHead>
                      <TableHead>Install</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead className="text-right">Occ.</TableHead>
                      <TableHead>Narrated</TableHead>
                      <TableHead>Session</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detail?.recent_reports ?? []).map((delivery) => (
                      <TableRow key={delivery.report_doc_id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          <HintTooltip label={delivery.generated_at}>
                            <span>{formatRelative(delivery.generated_at)}</span>
                          </HintTooltip>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {truncateMiddle(delivery.install_id, 14)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={stateTone(delivery.state)}>
                            {delivery.state}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(delivery.occurrences)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone={delivery.narrated ? "ok" : "neutral"}>
                            {delivery.narrated ? "yes" : "no"}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {delivery.session_id ? (
                            <HintTooltip label={delivery.session_id}>
                              <span>
                                {truncateMiddle(delivery.session_id, 12)}
                              </span>
                            </HintTooltip>
                          ) : (
                            <span className="text-muted-foreground">
                              uncorrelated
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="raw">
                <JsonViewer
                  value={detail?.latest_report ?? null}
                  maxHeightClass="max-h-[32rem]"
                />
              </TabsContent>
            </Tabs>

            <TriageActions
              form={triageForm}
              onStatus={onStatus}
              onComment={onComment}
              onLink={onLink}
              onDismiss={onDismiss}
              isPending={triagePending}
              notes={detail?.triage_notes ?? []}
            />
          </QueryState>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
};

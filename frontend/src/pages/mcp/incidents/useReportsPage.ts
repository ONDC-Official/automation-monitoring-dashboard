import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  useCommentIncident,
  useDismissIncident,
  useIncidentDetail,
  useIncidents,
  useLinkIncidentFix,
  useSetIncidentStatus,
} from "@/hooks/useMcp";
import { DEFAULT_LIMIT } from "@/pages/mcp/incidents/constants";
import {
  asIssueReport,
  formFromSearchParams,
  pagesFor,
  searchParamsFromForm,
  toQuery,
  type ReportsFilterForm,
} from "@/pages/mcp/incidents/utils";
import type { TriageResult, TriageStatus } from "@/services/types";
import { MCP_ROUTES } from "@/pages/mcp/constants";

export interface TriageForm {
  status: TriageStatus;
  note: string;
  comment: string;
  reference: string;
  reason: string;
}

const announce = (result: TriageResult) => {
  toast.success(result.message, {
    description: `${result.notes} note${result.notes === 1 ? "" : "s"} on this incident`,
  });
};

const complain = (error: { message: string }) => toast.error(error.message);

export const useReportsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { fingerprint } = useParams<{ fingerprint: string }>();

  const [skip, setSkip] = useState(0);

  const applied = useMemo(
    () => formFromSearchParams(searchParams),
    [searchParams],
  );

  const filterForm = useForm<ReportsFilterForm>({ defaultValues: applied });

  /*
   * The URL is the source of truth for the filters — a facet link from Overview
   * arrives already filtered — so page 3 of the old filter must not survive a
   * new one. Adjusted during render rather than in an effect: an effect would
   * render the wrong page once and fetch it.
   */
  const signature = searchParams.toString();
  const [lastSignature, setLastSignature] = useState(signature);
  if (signature !== lastSignature) {
    setLastSignature(signature);
    setSkip(0);
  }

  /* `reset` synchronises an external store (RHF), which is what effects are for. */
  useEffect(() => {
    filterForm.reset(applied);
  }, [applied, filterForm]);

  const query = useMemo(() => toQuery(applied, skip), [applied, skip]);
  const incidents = useIncidents(query);

  const limit = Number(applied.limit) || DEFAULT_LIMIT;
  const total = incidents.data?.total ?? 0;
  const page = Math.floor(skip / limit) + 1;
  const pages = pagesFor(total, limit);

  const applyFilters = filterForm.handleSubmit((values) => {
    setSearchParams(searchParamsFromForm(values));
  });

  const resetFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  /* ---------------------------------------------------------------------- */
  /* Detail                                                                   */
  /* ---------------------------------------------------------------------- */

  const selected = fingerprint ?? null;
  const detail = useIncidentDetail(selected ?? undefined);
  const report = useMemo(
    () => asIssueReport(detail.data?.latest_report),
    [detail.data],
  );

  const openIncident = (next: string) =>
    navigate({
      pathname: `${MCP_ROUTES.incidents}/${encodeURIComponent(next)}`,
      search: searchParams.toString(),
    });

  const closeIncident = () =>
    navigate({ pathname: MCP_ROUTES.incidents, search: searchParams.toString() });

  /* ---------------------------------------------------------------------- */
  /* Triage — every action invalidates the incident, the list and the stats    */
  /* ---------------------------------------------------------------------- */

  const target = selected ?? "";
  const setStatus = useSetIncidentStatus(target);
  const comment = useCommentIncident(target);
  const linkFix = useLinkIncidentFix(target);
  const dismiss = useDismissIncident(target);

  const triageForm = useForm<TriageForm>({
    defaultValues: {
      status: "triaged",
      note: "",
      comment: "",
      reference: "",
      reason: "",
    },
  });

  useEffect(() => {
    const current = detail.data?.incident.triage_status;
    triageForm.reset({
      status: (current as TriageStatus | undefined) ?? "triaged",
      note: "",
      comment: "",
      reference: "",
      reason: "",
    });
  }, [detail.data?.incident.triage_status, triageForm]);

  const submitStatus = triageForm.handleSubmit((values) => {
    setStatus.mutate(
      {
        status: values.status,
        ...(values.note.trim() ? { note: values.note.trim() } : {}),
      },
      {
        onSuccess: (result) => {
          announce(result);
          triageForm.setValue("note", "");
        },
        onError: complain,
      },
    );
  });

  const submitComment = triageForm.handleSubmit((values) => {
    if (!values.comment.trim()) {
      triageForm.setError("comment", { message: "A comment cannot be empty" });
      return;
    }
    comment.mutate(
      { body: values.comment.trim() },
      {
        onSuccess: (result) => {
          announce(result);
          triageForm.setValue("comment", "");
        },
        onError: complain,
      },
    );
  });

  const submitLink = triageForm.handleSubmit((values) => {
    if (!values.reference.trim()) {
      triageForm.setError("reference", {
        message: "Name the fix: a PR URL, a branch or a sha",
      });
      return;
    }
    linkFix.mutate(
      {
        reference: values.reference.trim(),
        ...(values.note.trim() ? { note: values.note.trim() } : {}),
      },
      {
        onSuccess: (result) => {
          announce(result);
          triageForm.setValue("reference", "");
        },
        onError: complain,
      },
    );
  });

  const submitDismiss = triageForm.handleSubmit((values) => {
    if (!values.reason.trim()) {
      triageForm.setError("reason", {
        message: "Dismissing needs a reason — it is the record of the decision",
      });
      return;
    }
    dismiss.mutate(
      { reason: values.reason.trim() },
      {
        onSuccess: (result) => {
          announce(result);
          triageForm.setValue("reason", "");
        },
        onError: complain,
      },
    );
  });

  return {
    incidents,
    rows: incidents.data?.items ?? [],
    total,
    limit,
    page,
    pages,
    skip,
    goToPage: (next: number) =>
      setSkip(Math.max(0, (Math.min(next, pages) - 1) * limit)),

    filterForm,
    applyFilters,
    resetFilters,
    activeFilterCount: searchParams.size,

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
    triagePending:
      setStatus.isPending ||
      comment.isPending ||
      linkFix.isPending ||
      dismiss.isPending,
  };
};

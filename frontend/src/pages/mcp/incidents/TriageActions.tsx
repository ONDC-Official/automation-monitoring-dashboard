import type { FormEventHandler } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Ban, GitPullRequest, MessageSquarePlus, Tag } from "lucide-react";
import Button from "@/components/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/Card";
import FormInput from "@/components/FormInput";
import FormSelect from "@/components/FormSelect";
import { FormTextarea } from "@/components/FormTextarea";
import { TRIAGE_STATUS_OPTIONS } from "@/pages/mcp/incidents/constants";
import type { TriageForm } from "@/pages/mcp/incidents/useReportsPage";
import type { TriageNote } from "@/services/types";

interface TriageActionsProps {
  form: UseFormReturn<TriageForm>;
  onStatus: FormEventHandler<HTMLFormElement>;
  onComment: FormEventHandler<HTMLFormElement>;
  onLink: FormEventHandler<HTMLFormElement>;
  onDismiss: FormEventHandler<HTMLFormElement>;
  isPending: boolean;
  notes: TriageNote[];
}

const NOTE_LABELS: Record<TriageNote["kind"], string> = {
  status: "Status",
  comment: "Note",
  link: "Fix",
  dismiss: "Dismissed",
};

/**
 * Four mutations, one form, and the timeline they write to.
 *
 * Every one of these is a single write to the corpus, so there is no
 * partial-success state left to warn about — which is what the card's
 * description used to be for, back when the text went to a GitHub issue and
 * quietly went nowhere if sync was off.
 */
export const TriageActions = ({
  form,
  onStatus,
  onComment,
  onLink,
  onDismiss,
  isPending,
  notes,
}: TriageActionsProps) => {
  const { register, control, formState } = form;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Triage</CardTitle>
        <CardDescription>
          Recorded in the corpus. Nothing is filed anywhere else.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {notes.length > 0 ? (
          <ol className="flex flex-col gap-2 border-b border-border pb-4">
            {notes
              .slice()
              .reverse()
              .map((note, index) => (
                <li
                  key={`${note.at}-${index}`}
                  className="flex flex-col gap-0.5 text-xs"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {NOTE_LABELS[note.kind]}
                      {note.status ? ` → ${note.status}` : ""}
                    </span>
                    <span className="text-[10px]">{note.at}</span>
                  </div>
                  {note.reference ? (
                    <span className="font-mono text-[11px] break-all">
                      {note.reference}
                    </span>
                  ) : null}
                  {note.body ? (
                    <span className="whitespace-pre-wrap">{note.body}</span>
                  ) : null}
                </li>
              ))}
          </ol>
        ) : null}
        <form onSubmit={onStatus} className="flex flex-col gap-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[12rem_1fr]">
            <FormSelect
              control={control}
              name="status"
              label="Status"
              options={TRIAGE_STATUS_OPTIONS}
            />
            <FormInput
              label="Note (optional)"
              placeholder="Appended as a comment alongside the label change"
              registration={register("note")}
            />
          </div>
          <div>
            <Button type="submit" size="sm" disabled={isPending}>
              <Tag />
              Set status
            </Button>
          </div>
        </form>

        <form
          onSubmit={onComment}
          className="flex flex-col gap-2 border-t border-border pt-4"
        >
          <FormTextarea
            label="Comment"
            placeholder="What you found, for the next person who opens this"
            registration={register("comment")}
            error={formState.errors.comment?.message}
          />
          <div>
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={isPending}
            >
              <MessageSquarePlus />
              Comment
            </Button>
          </div>
        </form>

        <form
          onSubmit={onLink}
          className="flex flex-col gap-2 border-t border-border pt-4"
        >
          <FormInput
            label="Link a fix"
            placeholder="A PR URL, a branch name or a commit sha"
            registration={register("reference")}
            error={formState.errors.reference?.message}
          />
          <div>
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={isPending}
            >
              <GitPullRequest />
              Link fix
            </Button>
          </div>
        </form>

        <form
          onSubmit={onDismiss}
          className="flex flex-col gap-2 border-t border-border pt-4"
        >
          <FormInput
            label="Dismiss"
            placeholder="Why this is not worth tracking"
            registration={register("reason")}
            error={formState.errors.reason?.message}
            hint="Dismissing suppresses the incident; it stays in the corpus."
          />
          <div>
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              disabled={isPending}
            >
              <Ban />
              Dismiss
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

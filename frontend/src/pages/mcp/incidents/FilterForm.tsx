import type { FormEventHandler } from "react";
import type { UseFormReturn } from "react-hook-form";
import { RotateCcw, Search } from "lucide-react";
import Button from "@/components/Button";
import { Card, CardContent } from "@/components/Card";
import FormInput from "@/components/FormInput";
import FormSelect from "@/components/FormSelect";
import {
  BOOLEAN_OPTIONS,
  PAGE_SIZE_OPTIONS,
  SORT_OPTIONS,
  STATE_OPTIONS,
  STATUS_OPTIONS,
  TRIGGER_OPTIONS,
} from "@/pages/mcp/incidents/constants";
import type { ReportsFilterForm } from "@/pages/mcp/incidents/utils";

interface FilterFormProps {
  form: UseFormReturn<ReportsFilterForm>;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onReset: () => void;
  isFetching: boolean;
}

export const FilterForm = ({
  form,
  onSubmit,
  onReset,
  isFetching,
}: FilterFormProps) => {
  const { register, control } = form;

  return (
    <Card>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FormInput
              label="Search"
              placeholder="code, flow, step or message"
              registration={register("search")}
            />
            <FormInput
              label="Domain"
              placeholder="ONDC:TRV11"
              registration={register("domain")}
            />
            <FormInput
              label="Version"
              placeholder="2.0.0"
              registration={register("version")}
            />
            <FormInput
              label="Flow"
              placeholder="search2_METRO_201"
              registration={register("flow_id")}
            />
            <FormSelect
              control={control}
              name="trigger"
              label="Trigger"
              options={TRIGGER_OPTIONS}
            />
            <FormSelect
              control={control}
              name="state"
              label="State"
              options={STATE_OPTIONS}
            />
            <FormSelect
              control={control}
              name="status"
              label="Triage status"
              options={STATUS_OPTIONS}
            />
            <FormInput
              label="Since"
              type="datetime-local"
              hint="Filters on last seen"
              registration={register("since")}
            />
            <FormSelect
              control={control}
              name="narrated"
              label="Narrated"
              options={BOOLEAN_OPTIONS}
            />
            <FormSelect
              control={control}
              name="suppressed"
              label="Suppressed"
              options={BOOLEAN_OPTIONS}
            />
            <FormSelect
              control={control}
              name="sort"
              label="Sort"
              options={SORT_OPTIONS}
            />
            <FormSelect
              control={control}
              name="limit"
              label="Page size"
              options={PAGE_SIZE_OPTIONS}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={isFetching}>
              <Search />
              Apply
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onReset}>
              <RotateCcw />
              Reset
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

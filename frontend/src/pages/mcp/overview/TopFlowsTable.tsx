import { Link } from "react-router-dom";
import { StatusBadge } from "@/components/Badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/Card";
import { QueryState } from "@/components/QueryState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/Table";
import { formatNumber } from "@/lib/format";
import type { TopFlow } from "@/services/types";
import { MCP_ROUTES } from "@/pages/mcp/constants";

interface TopFlowsTableProps {
  flows: TopFlow[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

export const TopFlowsTable = ({
  flows,
  isLoading,
  isError,
  error,
}: TopFlowsTableProps) => (
  <Card>
    <CardHeader>
      <CardTitle>Top failing flows</CardTitle>
      <CardDescription>
        Ranked by occurrences, not by distinct incidents — one stubborn defect
        outranks several rare ones.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        isEmpty={flows.length === 0}
        emptyLabel="No flow has failed yet"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Flow</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead className="text-right">Occurrences</TableHead>
              <TableHead className="text-right">Incidents</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flows.map((flow) => (
              <TableRow key={`${flow.domain}::${flow.flow_id}`}>
                <TableCell className="font-mono text-xs">
                  <Link
                    to={`${MCP_ROUTES.incidents}?flow_id=${encodeURIComponent(flow.flow_id)}`}
                    className="hover:text-primary hover:underline"
                  >
                    {flow.flow_id}
                  </Link>
                </TableCell>
                <TableCell>
                  <StatusBadge tone="outline">{flow.domain}</StatusBadge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(flow.occurrences)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(flow.incidents)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </QueryState>
    </CardContent>
  </Card>
);

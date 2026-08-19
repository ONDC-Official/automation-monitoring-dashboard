import { ListTree } from "lucide-react";
import { Card, CardContent } from "@/components/Card";

/**
 * The journal is scoped to exactly one session, so with none picked there is
 * nothing to show — say that, rather than rendering an empty table that looks
 * like a session with no traffic.
 */
export const NoSessionPanel = () => (
  <Card>
    <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
      <ListTree className="size-6 text-muted-foreground" />
      <p className="text-sm font-medium">Pick a session to read its wire log</p>
      <p className="max-w-md text-xs text-muted-foreground">
        Every ACK, NACK, chained send and override this mock recorded, in the
        order the engine observed them. Choose a session above, or open one from
        the sessions page.
      </p>
    </CardContent>
  </Card>
);

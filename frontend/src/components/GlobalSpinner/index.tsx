import { useEffect, useState } from "react";
import { useIsFetching } from "@tanstack/react-query";

const GlobalSpinner = () => {
  const fetchingCount = useIsFetching();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (fetchingCount > 0) {
      const t = setTimeout(() => setVisible(true), 200);
      return () => clearTimeout(t);
    }
    setTimeout(() => setVisible(false), 200);
  }, [fetchingCount]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <div className="size-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
};

export default GlobalSpinner;

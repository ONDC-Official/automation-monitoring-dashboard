import { toast } from "sonner";

export function ttlLabel(ttl: number): string {
  if (ttl === -1) return "no expiry";
  if (ttl === -2) return "missing";
  if (ttl < 60) return `${ttl}s`;
  if (ttl < 3600) return `${Math.round(ttl / 60)}m`;
  return `${Math.round(ttl / 360) / 10}h`;
}

export function ttlClass(ttl: number): string {
  if (ttl === -2) return "text-muted-foreground line-through";
  if (ttl === -1) return "text-muted-foreground";
  if (ttl < 60) return "text-red-600 dark:text-red-400";
  if (ttl < 300) return "text-amber-600 dark:text-amber-400";
  return "text-foreground";
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  } catch {
    toast.error("Copy failed");
  }
}

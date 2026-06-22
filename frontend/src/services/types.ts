// API response types — mirrored from backend source definitions.
// BusinessType       → backend/src/redis/key-codec.ts
// ScanResult         → backend/src/redis/service.ts
// InspectResult      → backend/src/redis/service.ts
// DashboardRef       → backend/src/proxies/grafana.ts
// Remaining shapes   → backend route handler return values

export type BusinessType =
  | "MOCK_DATA"
  | "FLOW_STATUS"
  | "EXTRA_FLOW_STATUS"
  | "PLAYGROUND"
  | "TRANSACTION"
  | "SUBSCRIBER"
  | "SESSION"
  | "RUNNER_CONFIG"
  | "UNKNOWN";

export interface HealthResponse {
  status: "ok" | "degraded";
  deps: {
    redisDb0: boolean;
    redisDb1: boolean;
    prometheus: boolean;
    loki: boolean;
    grafana: boolean;
    monitoredService: boolean;
  };
}

export interface DbsResponse {
  businessTypes: BusinessType[];
  dbs: Array<{ db: number; dbsize: number; label: string }>;
}

// Matches backend/src/redis/service.ts → ScanResult
export interface ScanResult {
  db: number;
  cursor: string; // '0' when iteration is complete
  keys: Array<{
    key: string;
    businessType: BusinessType;
    ttl: number; // -1 = no expiry, -2 = missing
    type: string; // redis type (string/hash/...)
  }>;
}

// Matches backend/src/redis/service.ts → InspectResult
export interface InspectResult {
  key: string;
  db: number;
  businessType: BusinessType;
  parts: Record<string, string>;
  type: string;
  ttl: number;
  sizeBytes: number;
  raw: unknown;
  decoded: unknown | null;
  validation: { ok: boolean; errors: string[] };
}

// Matches backend/src/proxies/grafana.ts → DashboardRef
export interface DashboardRef {
  uid: string;
  title: string;
  url: string;
  folderTitle?: string;
  tags: string[];
}

// Prometheus HTTP API passthrough
export interface PromResponse {
  status: string;
  data: {
    resultType: string;
    result: Array<{
      metric: Record<string, string>;
      value?: [number, string];
      values?: Array<[number, string]>;
    }>;
  };
}

// Loki HTTP API passthrough
export interface LokiResponse {
  status: string;
  data: {
    resultType: string;
    result: Array<{
      stream: Record<string, string>;
      values: Array<[string, string]>;
    }>;
  };
}

// Backend error shape (backend/src/middlewares/error.ts)
export interface ApiErrorBody {
  error: "upstream_error" | "internal_error";
  message: string;
  upstream?: string;
  detail?: unknown;
}

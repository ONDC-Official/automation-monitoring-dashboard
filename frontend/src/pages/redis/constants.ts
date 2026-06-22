import type { BusinessType } from "@/services/types";

export const ALL = "ALL";

export const BUSINESS_TYPES: (BusinessType | typeof ALL)[] = [
  ALL,
  "MOCK_DATA",
  "FLOW_STATUS",
  "EXTRA_FLOW_STATUS",
  "PLAYGROUND",
  "TRANSACTION",
  "SUBSCRIBER",
  "SESSION",
  "RUNNER_CONFIG",
  "UNKNOWN",
];

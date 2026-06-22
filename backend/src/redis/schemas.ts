import { z } from 'zod';

/**
 * Business schemas for cached Redis blobs.
 *
 * SOURCE OF TRUTH — keep in sync with the monitored service:
 *   automation-mock-playground-service/src/types/cache-types.ts
 *   automation-mock-playground-service/src/types/mock-service-types.ts
 *   automation-mock-playground-service/src/types/mock-runner-types.ts
 *
 * These are intentionally COPIED (the two repos are independent, no shared
 * package). Shapes whose exact definition lives in the source repo and is not
 * needed for the read-only view (e.g. FlowSchema) are kept permissive here and
 * marked TODO — tighten when the auto-correct feature lands.
 */

// ---- DB0: transaction history -------------------------------------------
export const ApiDataSchema = z.object({
    entryType: z.literal('API'),
    action: z.string(),
    payloadId: z.string(),
    messageId: z.string(),
    response: z.unknown(),
    timestamp: z.string(),
});

export const FormApiTypeSchema = z.object({
    entryType: z.literal('FORM'),
    formType: z.enum(['HTML_FORM', 'RES_FORM', 'DYNAMIC_FORM']),
    formId: z.string(),
    submissionId: z.string().optional(),
    timestamp: z.string(),
    error: z.string().optional(),
});

export const HistoryTypeSchema = z.discriminatedUnion('entryType', [
    ApiDataSchema,
    FormApiTypeSchema,
]);

export const TransactionCacheSchema = z.object({
    sessionId: z.string().optional(),
    flowId: z.string(),
    latestAction: z.string(),
    latestTimestamp: z.string(),
    type: z.enum(['default', 'manual', '']).optional(),
    subscriberType: z.enum(['BAP', 'BPP']),
    messageIds: z.array(z.string()),
    apiList: z.array(HistoryTypeSchema),
});

// ---- DB0: NP session ----------------------------------------------------
// flowConfigs is `z.record(z.string(), FlowSchema)` in the source; FlowSchema
// is not mirrored here, so kept permissive. TODO: mirror FlowSchema.
export const SessionCacheSchema = z
    .object({
        transactionIds: z.array(z.string()),
        flowMap: z.record(z.string(), z.string().optional()),
        npType: z.enum(['BAP', 'BPP']),
        domain: z.string(),
        version: z.string(),
        subscriberId: z.string().optional(),
        subscriberUrl: z.string(),
        usecaseId: z.string(),
        env: z.enum(['STAGING', 'PRE-PRODUCTION', 'LOGGED-IN']),
        flowConfigs: z.record(z.string(), z.unknown()),
        formSubmissions: z
            .record(
                z.string(),
                z.object({
                    submitted: z.boolean(),
                    submission_id: z.string().optional(),
                    timestamp: z.string().optional(),
                    form_id: z.string().optional(),
                    formUrl: z.string().optional(),
                })
            )
            .optional(),
    })
    .loose();

// ---- DB0: subscriber active-session expectations ------------------------
export const ExpectationSchema = z.object({
    sessionId: z.string(),
    flowId: z.string(),
    expectedAction: z.string().optional(),
    expireAt: z.string(),
});

export const SubscriberCacheSchema = z.object({
    activeSessions: z.array(ExpectationSchema),
});

// ---- DB0: mock txn business data (MOCK_DATA::) --------------------------
// Loose accumulator in the source (MORE_SEQUENCE, user_inputs, jsonpath saves).
export const MockSessionCacheSchema = z
    .object({
        transaction_id: z.string().optional(),
        subscriberUrl: z.string().optional(),
        sessionId: z.string().optional(),
    })
    .loose();

// ---- DB0: flow status (FLOW_STATUS_ / EXTRA_FLOW_STATUS_) ----------------
export const MockFlowStatusCacheSchema = z.object({
    status: z.enum(['WORKING', 'AVAILABLE', 'SUSPENDED']),
});

// ---- DB0: playground runtime config (PLAYGROUND_) -----------------------
// TODO: mirror config-cache schema exactly. Permissive for now.
export const PlaygroundConfigSchema = z.object({}).loose();

// ---- DB1: mock-runner config --------------------------------------------
// TODO: mirror MockRunnerConfigSchema exactly. Permissive for now.
export const MockRunnerConfigSchema = z.object({}).loose();

export type TransactionCache = z.infer<typeof TransactionCacheSchema>;
export type SessionCache = z.infer<typeof SessionCacheSchema>;
export type SubscriberCache = z.infer<typeof SubscriberCacheSchema>;
export type MockSessionCache = z.infer<typeof MockSessionCacheSchema>;
export type MockFlowStatusCache = z.infer<typeof MockFlowStatusCacheSchema>;

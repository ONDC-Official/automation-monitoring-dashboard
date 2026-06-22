import { z } from 'zod';
import {
    MockFlowStatusCacheSchema,
    MockRunnerConfigSchema,
    MockSessionCacheSchema,
    PlaygroundConfigSchema,
    SessionCacheSchema,
    SubscriberCacheSchema,
    TransactionCacheSchema,
} from './schemas';

/**
 * Decodes a raw Redis key into its business meaning. Key conventions mirror
 * automation-mock-playground-service/src/service/cache/{workbench,config}-cache.ts.
 *
 * NOTE: DB0 = business/workbench state, DB1 = mock-runner config cache.
 */

export type BusinessType =
    | 'MOCK_DATA'
    | 'FLOW_STATUS'
    | 'EXTRA_FLOW_STATUS'
    | 'PLAYGROUND'
    | 'TRANSACTION'
    | 'SUBSCRIBER'
    | 'SESSION'
    | 'RUNNER_CONFIG'
    | 'UNKNOWN';

export interface DecodedKey {
    key: string;
    db: number;
    businessType: BusinessType;
    /** Human-readable, named breakdown of the key segments. */
    parts: Record<string, string>;
    /** Zod schema used to validate/decode the value, or null for UNKNOWN. */
    schema: z.ZodType | null;
    /** Whether values for this type are expected to carry a TTL. */
    expectsTtl: boolean;
}

const splitPair = (s: string): { transactionId: string; subscriberUrl: string } => {
    const idx = s.indexOf('::');
    return idx === -1
        ? { transactionId: s, subscriberUrl: '' }
        : { transactionId: s.slice(0, idx), subscriberUrl: s.slice(idx + 2) };
};

export const decodeKey = (key: string, db: number, db1: number): DecodedKey => {
    const base = { key, db } as const;

    // DB1 is exclusively the mock-runner config cache.
    if (db === db1) {
        const [domain = '', version = '', flowId = '', usecaseId = ''] =
            key.split('::');
        return {
            ...base,
            businessType: 'RUNNER_CONFIG',
            parts: { domain, version, flowId, usecaseId },
            schema: MockRunnerConfigSchema,
            expectsTtl: false,
        };
    }

    if (key.startsWith('MOCK_DATA::')) {
        const { transactionId, subscriberUrl } = splitPair(
            key.slice('MOCK_DATA::'.length)
        );
        return {
            ...base,
            businessType: 'MOCK_DATA',
            parts: { transactionId, subscriberUrl },
            schema: MockSessionCacheSchema,
            expectsTtl: false,
        };
    }

    if (key.startsWith('EXTRA_FLOW_STATUS_')) {
        const rest = key.slice('EXTRA_FLOW_STATUS_'.length).split('::');
        return {
            ...base,
            businessType: 'EXTRA_FLOW_STATUS',
            parts: {
                transactionId: rest[0] ?? '',
                subscriberUrl: rest[1] ?? '',
                extraStepKey: rest[2] ?? '',
            },
            schema: MockFlowStatusCacheSchema,
            expectsTtl: true,
        };
    }

    if (key.startsWith('FLOW_STATUS_')) {
        const { transactionId, subscriberUrl } = splitPair(
            key.slice('FLOW_STATUS_'.length)
        );
        return {
            ...base,
            businessType: 'FLOW_STATUS',
            parts: { transactionId, subscriberUrl },
            schema: MockFlowStatusCacheSchema,
            expectsTtl: true,
        };
    }

    if (key.startsWith('PLAYGROUND_')) {
        return {
            ...base,
            businessType: 'PLAYGROUND',
            parts: { sessionId: key.slice('PLAYGROUND_'.length) },
            schema: PlaygroundConfigSchema,
            expectsTtl: false,
        };
    }

    // Bare `{transactionId}::{subscriberUrl}` (exactly two `::`-segments).
    const segments = key.split('::');
    if (segments.length === 2) {
        return {
            ...base,
            businessType: 'TRANSACTION',
            parts: { transactionId: segments[0], subscriberUrl: segments[1] },
            schema: TransactionCacheSchema,
            expectsTtl: false,
        };
    }

    // Bare key that looks like a subscriber URL.
    if (/^https?:\/\//i.test(key)) {
        return {
            ...base,
            businessType: 'SUBSCRIBER',
            parts: { subscriberUrl: key },
            schema: SubscriberCacheSchema,
            expectsTtl: false,
        };
    }

    // Other bare key — treat as an NP sessionId.
    if (segments.length === 1) {
        return {
            ...base,
            businessType: 'SESSION',
            parts: { sessionId: key },
            schema: SessionCacheSchema,
            expectsTtl: false,
        };
    }

    return {
        ...base,
        businessType: 'UNKNOWN',
        parts: {},
        schema: null,
        expectsTtl: false,
    };
};

export const BUSINESS_TYPES: BusinessType[] = [
    'MOCK_DATA',
    'FLOW_STATUS',
    'EXTRA_FLOW_STATUS',
    'PLAYGROUND',
    'TRANSACTION',
    'SUBSCRIBER',
    'SESSION',
    'RUNNER_CONFIG',
    'UNKNOWN',
];

import { InspectResult } from './service';

/**
 * STUB — Redis "auto-correct" / business repair.
 *
 * The dashboard is read-only for now. This module is the designated home for
 * the upcoming auto-correct feature: given a schema-invalid or TTL-missing
 * blob, propose (and later apply, behind explicit confirmation) a repair.
 *
 * Intended shape once implemented:
 *   - dry-run proposals derived from `InspectResult.validation` + key codec
 *   - per-businessType repair strategies (re-add 5h TTL on FLOW_STATUS keys,
 *     coerce/strip invalid fields, drop expired expectations, etc.)
 *   - guarded write path (requires ADMIN_TOKEN + explicit apply flag)
 *
 * TODO(redis-autocorrect): implement once the rules are specified by the user.
 */

export interface RepairProposal {
    key: string;
    db: number;
    kind: string;
    description: string;
    /** Preview of the corrected value; not applied. */
    preview: unknown;
}

export const proposeRepairs = (_inspect: InspectResult): RepairProposal[] => {
    // Intentionally empty: no auto-correct rules defined yet.
    return [];
};

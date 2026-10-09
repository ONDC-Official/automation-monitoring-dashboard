import { mcpEnabled } from '@/config/env.js';
import logger from '@/observability/logger.js';
import { resolveMcpConfig } from '@/mcp/config.js';
import { createContainer, type Container } from '@/mcp/container.js';

/**
 * The MCP section, assembled — or not.
 *
 * Everything the section needs hangs off one object so the rest of the backend
 * has a single thing to test for. `initMcp()` returns `undefined` when
 * `MONGO_URL` is unset, and every mount site reads that as "answer 503" rather
 * than having to know why.
 *
 * The alternative — booting the container against an in-memory repository so
 * the routes always work — was rejected deliberately. This service's ingest
 * tells the engine "delivered, delete your copy" on any 2xx, so a corpus that
 * silently forgets is worse than one that is honestly absent.
 *
 * "MCP" here names the corpus, not the Model Context Protocol. This section
 * once served a Streamable-HTTP MCP server as well; that is gone, and the name
 * stayed. See the naming note in the root CLAUDE.md.
 */
export interface McpRuntime {
    readonly container: Container;
    dispose(): Promise<void>;
}

export async function initMcp(): Promise<McpRuntime | undefined> {
    if (!mcpEnabled()) {
        logger.info(
            'MCP section disabled: MONGO_URL is unset. /api/mcp/* will answer 503.'
        );
        return undefined;
    }

    const mcpConfig = resolveMcpConfig();
    const container = await createContainer(mcpConfig, { logger });

    return {
        container,
        async dispose(): Promise<void> {
            await container.dispose();
        },
    };
}

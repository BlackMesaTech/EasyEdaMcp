import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { WsBridge } from './ws-bridge.js';
import * as logger from './logger.js';
import { registerConnectionTools } from './tools/connection.js';
import { registerProjectTools } from './tools/project.js';
import { registerSchematicTools } from './tools/schematic.js';
import { registerPcbTools } from './tools/pcb.js';
import { registerLibraryTools } from './tools/library.js';
import { registerExportTools } from './tools/export.js';
import { registerEditorTools } from './tools/editor.js';
import { registerJlcpcbTools } from './tools/jlcpcb.js';

function resolvePort(): number {
  const raw = process.env.EASYEDA_WS_PORT;
  if (raw === undefined) return 3000;
  const port = Number.parseInt(raw, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    logger.warn(`Invalid EASYEDA_WS_PORT "${raw}" — falling back to 3000`);
    return 3000;
  }
  return port;
}

async function main(): Promise<void> {
  const wsPort = resolvePort();

  // Start the WebSocket bridge (extension connects to this).
  const bridge = new WsBridge(wsPort);

  // Fail fast on bind errors (e.g. port already in use) before connecting MCP stdio.
  await bridge.waitUntilListening();

  // Create the MCP server.
  const server = new McpServer({
    name: 'easyeda-pro',
    version: '0.2.0',
  });

  // Register all tool categories.
  registerConnectionTools(server, bridge);
  registerProjectTools(server, bridge);
  registerSchematicTools(server, bridge);
  registerPcbTools(server, bridge);
  registerLibraryTools(server, bridge);
  registerExportTools(server, bridge);
  registerEditorTools(server, bridge);
  registerJlcpcbTools(server); // No bridge needed — direct HTTP.

  // Connect to the MCP client (e.g. Claude Code) via stdio.
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.log('EasyEDA Pro MCP server running');
  logger.log(`WebSocket bridge on ws://127.0.0.1:${wsPort}`);
  logger.log('Waiting for EasyEDA Pro extension to connect...');

  // Graceful shutdown.
  const shutdown = (signal: string) => {
    logger.log(`Received ${signal} — shutting down...`);
    bridge.close();
    void server.close();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Fatal error:', err instanceof Error ? err.message : err);
  process.exit(1);
});

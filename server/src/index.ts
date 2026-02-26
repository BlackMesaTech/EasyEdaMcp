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

const WS_PORT = parseInt(process.env.EASYEDA_WS_PORT ?? '3000', 10);

async function main(): Promise<void> {
  // Start the WebSocket bridge (extension connects to this)
  const bridge = new WsBridge(WS_PORT);

  // Create the MCP server
  const server = new McpServer({
    name: 'easyeda-pro',
    version: '0.1.0',
  });

  // Register all tool categories
  registerConnectionTools(server, bridge);
  registerProjectTools(server, bridge);
  registerSchematicTools(server, bridge);
  registerPcbTools(server, bridge);
  registerLibraryTools(server, bridge);
  registerExportTools(server, bridge);
  registerEditorTools(server, bridge);
  registerJlcpcbTools(server);  // No bridge needed — direct HTTP

  // Connect to Claude Code via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.log('EasyEDA Pro MCP server running');
  logger.log(`WebSocket bridge on ws://127.0.0.1:${WS_PORT}`);
  logger.log('Waiting for EasyEDA Pro extension to connect...');

  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.log('Shutting down...');
    bridge.close();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    bridge.close();
    process.exit(0);
  });
}

main().catch((err) => {
  logger.error('Fatal error:', err);
  process.exit(1);
});

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WsBridge } from '../ws-bridge.js';

export function registerConnectionTools(server: McpServer, bridge: WsBridge): void {
  server.registerTool(
    'easyeda_connection_status',
    {
      description:
        'Check if the EasyEDA Pro extension is connected to the MCP bridge. ' +
        'Returns connection status and extension info. Call this first to verify ' +
        'the extension is available before using other EasyEDA tools.',
      inputSchema: {},
    },
    async () => {
      const status = bridge.getStatus();
      if (status.connected) {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              connected: true,
              extensionInfo: status.extensionInfo,
              message: 'EasyEDA Pro extension is connected and ready.',
            }, null, 2),
          }],
        };
      }
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            connected: false,
            message:
              'EasyEDA Pro extension is NOT connected. ' +
              'To connect: (1) Open EasyEDA Pro, ' +
              '(2) Click MCP Bridge > Connect in the top menu bar.',
          }, null, 2),
        }],
      };
    },
  );
}

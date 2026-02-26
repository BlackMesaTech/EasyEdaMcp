import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WsBridge } from '../ws-bridge.js';
import { bridgeTool } from './helpers.js';

export function registerEditorTools(server: McpServer, bridge: WsBridge): void {
  server.registerTool(
    'easyeda_zoom_to_all',
    {
      description: 'Zoom the editor canvas to fit all primitives in view.',
      inputSchema: {},
    },
    () => bridgeTool(bridge, 'dmt.editorControl.zoomToAllPrimitives'),
  );

  server.registerTool(
    'easyeda_zoom_to_selected',
    {
      description: 'Zoom the editor canvas to fit the currently selected primitives.',
      inputSchema: {},
    },
    () => bridgeTool(bridge, 'dmt.editorControl.zoomToSelectedPrimitives'),
  );

  server.registerTool(
    'easyeda_zoom_to_region',
    {
      description: 'Zoom the editor canvas to a specific rectangular region.',
      inputSchema: {
        x1: z.number().describe('Left X coordinate'),
        y1: z.number().describe('Top Y coordinate'),
        x2: z.number().describe('Right X coordinate'),
        y2: z.number().describe('Bottom Y coordinate'),
      },
    },
    (params) => bridgeTool(bridge, 'dmt.editorControl.zoomToRegion', params),
  );

  server.registerTool(
    'easyeda_add_markers',
    {
      description:
        'Add visual indicator markers on the canvas to highlight specific locations. ' +
        'Useful for pointing out issues or areas of interest.',
      inputSchema: {
        markers: z.array(z.object({
          x: z.number().describe('X coordinate'),
          y: z.number().describe('Y coordinate'),
          label: z.string().optional().describe('Optional label text'),
        })).min(1).describe('Array of marker positions'),
      },
    },
    ({ markers }) => bridgeTool(bridge, 'dmt.editorControl.generateIndicatorMarkers', { markers }),
  );

  server.registerTool(
    'easyeda_remove_markers',
    {
      description: 'Remove all indicator markers from the canvas.',
      inputSchema: {},
    },
    () => bridgeTool(bridge, 'dmt.editorControl.removeIndicatorMarkers'),
  );
}

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WsBridge } from '../ws-bridge.js';
import { bridgeExportTool } from './helpers.js';

export function registerExportTools(server: McpServer, bridge: WsBridge): void {
  server.registerTool(
    'easyeda_export_gerber',
    {
      description: 'Generate Gerber manufacturing files from the current PCB.',
      inputSchema: {},
    },
    () => bridgeExportTool(bridge, 'pcb.manufactureData.getGerberFile'),
  );

  server.registerTool(
    'easyeda_export_bom',
    {
      description: 'Generate a Bill of Materials (BOM) from the current PCB.',
      inputSchema: {},
    },
    () => bridgeExportTool(bridge, 'pcb.manufactureData.getBomFile'),
  );

  server.registerTool(
    'easyeda_export_pick_and_place',
    {
      description: 'Generate pick-and-place (centroid) file for SMT assembly.',
      inputSchema: {},
    },
    () => bridgeExportTool(bridge, 'pcb.manufactureData.getPickAndPlaceFile'),
  );

  server.registerTool(
    'easyeda_export_3d_model',
    {
      description: 'Export 3D model of the PCB (STEP or OBJ format).',
      inputSchema: {},
    },
    () => bridgeExportTool(bridge, 'pcb.manufactureData.get3DFile'),
  );

  server.registerTool(
    'easyeda_export_pdf',
    {
      description: 'Export the current schematic or PCB as a PDF file.',
      inputSchema: {
        documentType: z.enum(['schematic', 'pcb']).describe('Type of document to export'),
      },
    },
    ({ documentType }) => {
      const command = documentType === 'schematic'
        ? 'sch.manufactureData.getPdfFile'
        : 'pcb.manufactureData.getPdfFile';
      return bridgeExportTool(bridge, command);
    },
  );

  server.registerTool(
    'easyeda_export_dxf',
    {
      description: 'Export the PCB as a DXF file.',
      inputSchema: {},
    },
    () => bridgeExportTool(bridge, 'pcb.manufactureData.getDxfFile'),
  );

  server.registerTool(
    'easyeda_export_dsn',
    {
      description: 'Export the PCB as a DSN file for external auto-routers.',
      inputSchema: {},
    },
    () => bridgeExportTool(bridge, 'pcb.manufactureData.getDsnFile'),
  );

  server.registerTool(
    'easyeda_get_canvas_image',
    {
      description: 'Capture the current editor canvas as an image (screenshot of the schematic or PCB view).',
      inputSchema: {},
    },
    async () => {
      try {
        const result = await bridge.sendCommand('dmt.editorControl.getCurrentRenderedAreaImage') as
          { mimeType?: string; base64?: string; error?: string; type?: string } | null;
        if (!result || !result.base64) {
          const debug = result ? JSON.stringify(result, null, 2) : 'null';
          return {
            content: [{ type: 'text' as const, text: `No image returned. Debug: ${debug}` }],
          };
        }
        return {
          content: [{
            type: 'image' as const,
            data: result.base64,
            mimeType: result.mimeType || 'image/png',
          }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );
}

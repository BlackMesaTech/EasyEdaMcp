import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WsBridge } from '../ws-bridge.js';
import { bridgeTool } from './helpers.js';

export function registerSchematicTools(server: McpServer, bridge: WsBridge): void {
  server.registerTool(
    'easyeda_sch_get_all_components',
    {
      description:
        'List all components on the current schematic page (or all pages). ' +
        'Returns designators, values, footprints, LCSC part numbers, and positions.',
      inputSchema: {
        allPages: z.boolean().optional().default(false).describe('If true, list components from all schematic pages'),
      },
    },
    ({ allPages }) => bridgeTool(bridge, 'sch.primitive.getAllComponents', { allPages }),
  );

  server.registerTool(
    'easyeda_sch_get_component',
    {
      description: 'Get detailed properties of a specific schematic component by its primitive ID.',
      inputSchema: {
        primitiveId: z.string().describe('Primitive ID of the component'),
      },
    },
    ({ primitiveId }) => bridgeTool(bridge, 'sch.primitive.getComponent', { primitiveId }),
  );

  server.registerTool(
    'easyeda_sch_get_selected',
    {
      description: 'Get the currently selected primitives on the schematic.',
      inputSchema: {},
    },
    () => bridgeTool(bridge, 'sch.selectControl.getSelected'),
  );

  server.registerTool(
    'easyeda_sch_get_netlist',
    {
      description: 'Generate a netlist from the current schematic. Useful for checking connectivity.',
      inputSchema: {
        format: z.enum(['jlceda', 'easyeda', 'altium', 'allegro', 'pads', 'protel'])
          .optional().default('jlceda')
          .describe('Netlist format'),
      },
    },
    ({ format }) => bridgeTool(bridge, 'sch.netlist.generate', { format }),
  );

  server.registerTool(
    'easyeda_sch_run_drc',
    {
      description:
        'Run Design Rule Check (DRC) on the current schematic. ' +
        'Returns pass/fail. Note: detailed error list is only available in the EasyEDA Pro UI — ' +
        'the schematic DRC API does not provide verbose error data.',
      inputSchema: {},
    },
    async () => {
      try {
        const result = await bridge.sendCommand('sch.drc.runDrc');
        const passed = result === true;
        return {
          content: [{
            type: 'text' as const,
            text: passed
              ? 'Schematic DRC passed — no errors or warnings.'
              : 'Schematic DRC FAILED — errors or warnings detected. Check the DRC panel in EasyEDA Pro for details.',
          }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'easyeda_sch_get_bom',
    {
      description: 'Generate a Bill of Materials (BOM) from the schematic.',
      inputSchema: {},
    },
    () => bridgeTool(bridge, 'sch.manufactureData.getBom'),
  );

  server.registerTool(
    'easyeda_sch_place_component',
    {
      description:
        'Place a component on the schematic from a library device. ' +
        'Use easyeda_lib_search_device or easyeda_lib_get_by_lcsc to find the device UUID first.',
      inputSchema: {
        deviceUuid: z.string().describe('UUID of the device from the library'),
        x: z.number().describe('X coordinate in schematic units'),
        y: z.number().describe('Y coordinate in schematic units'),
        rotation: z.number().optional().default(0).describe('Rotation angle in degrees (0, 90, 180, 270)'),
        mirror: z.boolean().optional().default(false).describe('Whether to mirror the component'),
      },
    },
    (params) => bridgeTool(bridge, 'sch.primitive.placeComponent', params),
  );

  server.registerTool(
    'easyeda_sch_place_wire',
    {
      description: 'Draw a wire on the schematic between a series of points.',
      inputSchema: {
        points: z.array(z.object({
          x: z.number().describe('X coordinate'),
          y: z.number().describe('Y coordinate'),
        })).min(2).describe('Array of points defining the wire path (minimum 2 points)'),
      },
    },
    ({ points }) => bridgeTool(bridge, 'sch.primitive.placeWire', { points }),
  );

  server.registerTool(
    'easyeda_sch_place_text',
    {
      description: 'Place a text annotation on the schematic.',
      inputSchema: {
        text: z.string().describe('Text content'),
        x: z.number().describe('X coordinate'),
        y: z.number().describe('Y coordinate'),
        fontSize: z.number().optional().describe('Font size'),
      },
    },
    (params) => bridgeTool(bridge, 'sch.primitive.placeText', params),
  );

  server.registerTool(
    'easyeda_sch_modify_component',
    {
      description: 'Modify properties of an existing schematic component (position, designator, value, etc.).',
      inputSchema: {
        primitiveId: z.string().describe('Primitive ID of the component to modify'),
        properties: z.record(z.unknown()).describe('Properties to update (e.g., { x: 100, y: 200, designator: "R1" })'),
      },
    },
    ({ primitiveId, properties }) =>
      bridgeTool(bridge, 'sch.primitive.modifyComponent', { primitiveId, properties }),
  );

  server.registerTool(
    'easyeda_sch_delete_primitives',
    {
      description: 'Delete schematic primitives (components, wires, text, etc.) by their IDs.',
      inputSchema: {
        primitiveIds: z.array(z.string()).min(1).describe('Array of primitive IDs to delete'),
      },
    },
    ({ primitiveIds }) => bridgeTool(bridge, 'sch.primitive.delete', { primitiveIds }),
  );

  server.registerTool(
    'easyeda_sch_select_primitives',
    {
      description: 'Select schematic primitives by their IDs. Useful for highlighting elements.',
      inputSchema: {
        primitiveIds: z.array(z.string()).min(1).describe('Array of primitive IDs to select'),
      },
    },
    ({ primitiveIds }) => bridgeTool(bridge, 'sch.selectControl.select', { primitiveIds }),
  );
}

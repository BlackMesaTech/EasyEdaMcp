import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WsBridge } from '../ws-bridge.js';
import { bridgeTool, bridgeExportTool } from './helpers.js';

/**
 * Coordinate note for schematic tools: EasyEDA Pro schematic coordinates are in
 * schematic grid units. To calibrate, read an existing component's position with
 * easyeda_sch_get_all_components before placing new primitives.
 */
const SCH_COORD = 'in schematic grid units (read an existing component position to calibrate)';

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
      annotations: { readOnlyHint: true },
    },
    ({ allPages }) => bridgeTool(bridge, 'sch.primitive.getAllComponents', { allPages }),
  );

  server.registerTool(
    'easyeda_sch_get_component',
    {
      description:
        'Get detailed properties of a specific schematic component by its primitive ID. '
        + '(Resolved via get-all-components, since EasyEDA Pro 0.2.29 ships getPrimitiveByPrimitiveId as an empty stub.)',
      inputSchema: {
        primitiveId: z.string().describe('Primitive ID of the component'),
      },
      annotations: { readOnlyHint: true },
    },
    ({ primitiveId }) => bridgeTool(bridge, 'sch.primitive.getComponent', { primitiveId }),
  );

  server.registerTool(
    'easyeda_sch_get_selected',
    {
      description: 'Get the currently selected primitives on the schematic.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => bridgeTool(bridge, 'sch.selectControl.getSelected'),
  );

  server.registerTool(
    'easyeda_sch_find_at_point',
    {
      description:
        'Find the schematic primitive at a specific coordinate. NOT supported in EasyEDA Pro '
        + '0.2.29 (the underlying API is an empty stub) — this tool returns an error directing '
        + 'you to easyeda_sch_find_in_region instead.',
      inputSchema: {
        x: z.number().describe(`X coordinate ${SCH_COORD}`),
        y: z.number().describe(`Y coordinate ${SCH_COORD}`),
      },
      annotations: { readOnlyHint: true },
    },
    ({ x, y }) => bridgeTool(bridge, 'sch.document.getPrimitiveAtPoint', { x, y }),
  );

  server.registerTool(
    'easyeda_sch_find_in_region',
    {
      description:
        'Find schematic components within a rectangular region. NOTE: EasyEDA Pro 0.2.29 ships '
        + 'getPrimitivesInRegion as a stub, so this falls back to filtering components by origin '
        + '— it returns components only (not wires/text), keyed on their placement coordinate.',
      inputSchema: {
        left: z.number().describe(`Left X coordinate ${SCH_COORD}`),
        right: z.number().describe(`Right X coordinate ${SCH_COORD}`),
        top: z.number().describe(`Top Y coordinate ${SCH_COORD}`),
        bottom: z.number().describe(`Bottom Y coordinate ${SCH_COORD}`),
      },
      annotations: { readOnlyHint: true },
    },
    (params) => bridgeTool(bridge, 'sch.document.getPrimitivesInRegion', params),
  );

  server.registerTool(
    'easyeda_sch_get_netlist',
    {
      description: 'Generate a netlist from the current schematic. Useful for checking connectivity.',
      inputSchema: {
        format: z.enum(['jlceda', 'easyeda', 'altium', 'allegro', 'pads', 'protel'])
          .optional().default('jlceda')
          .describe('Netlist format (altium and protel both map to Protel2)'),
      },
      annotations: { readOnlyHint: true },
    },
    ({ format }) => bridgeTool(bridge, 'sch.netlist.generate', { format }),
  );

  server.registerTool(
    'easyeda_sch_run_drc',
    {
      description:
        'Run Design Rule Check (DRC) on the current schematic. ' +
        'Returns the list of violations found, or confirms the schematic passed.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        const result = await bridge.sendCommand('sch.drc.runDrc');
        const violations = Array.isArray(result) ? result : [];
        if (violations.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'Schematic DRC passed — no errors or warnings.' }],
          };
        }
        return {
          content: [{
            type: 'text' as const,
            text: `Schematic DRC found ${violations.length} issue(s):\n${JSON.stringify(violations, null, 2)}`,
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
      description: 'Generate a Bill of Materials (BOM) from the schematic. Returns the BOM as a base64-encoded xlsx file.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => bridgeExportTool(bridge, 'sch.manufactureData.getBom'),
  );

  server.registerTool(
    'easyeda_sch_place_component',
    {
      description:
        'Place a component on the schematic from a library device. ' +
        'Use easyeda_lib_search_device or easyeda_lib_get_by_lcsc to find both the ' +
        'device UUID and the library UUID first — both are required.',
      inputSchema: {
        deviceUuid: z.string().describe('UUID of the device from the library'),
        libraryUuid: z.string().describe('UUID of the library the device belongs to (from the same search result)'),
        x: z.number().describe(`X coordinate ${SCH_COORD}`),
        y: z.number().describe(`Y coordinate ${SCH_COORD}`),
        rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)])
          .optional().default(0).describe('Rotation angle in degrees'),
        mirror: z.boolean().optional().default(false).describe('Whether to mirror the component'),
      },
      annotations: { destructiveHint: true, idempotentHint: false },
    },
    (params) => bridgeTool(bridge, 'sch.primitive.placeComponent', params),
  );

  server.registerTool(
    'easyeda_sch_place_wire',
    {
      description: 'Draw a wire on the schematic between a series of points.',
      inputSchema: {
        points: z.array(z.object({
          x: z.number().describe(`X coordinate ${SCH_COORD}`),
          y: z.number().describe(`Y coordinate ${SCH_COORD}`),
        })).min(2).describe('Array of points defining the wire path (minimum 2 points)'),
        net: z.string().optional().describe('Optional net name to assign to the wire'),
      },
      annotations: { destructiveHint: true, idempotentHint: false },
    },
    ({ points, net }) => bridgeTool(bridge, 'sch.primitive.placeWire', { points, net }),
  );

  server.registerTool(
    'easyeda_sch_place_text',
    {
      description: 'Place a text annotation on the schematic.',
      inputSchema: {
        text: z.string().describe('Text content'),
        x: z.number().describe(`X coordinate ${SCH_COORD}`),
        y: z.number().describe(`Y coordinate ${SCH_COORD}`),
        fontSize: z.number().optional().describe('Font size in schematic units'),
      },
      annotations: { destructiveHint: true, idempotentHint: false },
    },
    (params) => bridgeTool(bridge, 'sch.primitive.placeText', params),
  );

  server.registerTool(
    'easyeda_sch_modify_component',
    {
      description:
        'Modify properties of an existing schematic component. ' +
        'Supported keys: x, y (position), rotation (0/90/180/270), mirror (boolean), ' +
        'designator, name, addIntoBom, addIntoPcb, manufacturer, manufacturerId, supplier, supplierId.',
      inputSchema: {
        primitiveId: z.string().describe('Primitive ID of the component to modify'),
        properties: z.record(z.unknown()).describe(
          'Properties to update, e.g. { x: 100, y: 200, rotation: 90, designator: "R1" }',
        ),
      },
      annotations: { destructiveHint: true, idempotentHint: true },
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
      annotations: { destructiveHint: true, idempotentHint: true },
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

  server.registerTool(
    'easyeda_sch_clear_selection',
    {
      description: 'Clear the current selection on the schematic.',
      inputSchema: {},
    },
    () => bridgeTool(bridge, 'sch.selectControl.clearSelected'),
  );
}

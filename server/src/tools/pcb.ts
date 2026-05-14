import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WsBridge } from '../ws-bridge.js';
import { bridgeTool } from './helpers.js';

/**
 * Coordinate note for PCB tools: EasyEDA Pro PCB coordinates and dimensions are in
 * mil (1 mil = 0.0254 mm). The Y axis points down and the origin can be negative.
 * To calibrate placement, read an existing component's position with
 * easyeda_pcb_get_all_components first.
 */
const PCB_COORD = 'in mil (1 mil = 0.0254 mm)';

export function registerPcbTools(server: McpServer, bridge: WsBridge): void {
  server.registerTool(
    'easyeda_pcb_get_all_components',
    {
      description: 'List all components on the current PCB with positions, layers, designators, and footprints.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => bridgeTool(bridge, 'pcb.primitive.getAllComponents'),
  );

  server.registerTool(
    'easyeda_pcb_get_component',
    {
      description: 'Get detailed properties of a specific PCB component by its primitive ID.',
      inputSchema: {
        primitiveId: z.string().describe('Primitive ID of the PCB component'),
      },
      annotations: { readOnlyHint: true },
    },
    ({ primitiveId }) => bridgeTool(bridge, 'pcb.primitive.getComponent', { primitiveId }),
  );

  server.registerTool(
    'easyeda_pcb_get_selected',
    {
      description: 'Get the currently selected primitives on the PCB.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => bridgeTool(bridge, 'pcb.selectControl.getSelected'),
  );

  server.registerTool(
    'easyeda_pcb_find_at_point',
    {
      description:
        'Find the PCB primitive at a specific coordinate. NOT supported in EasyEDA Pro 0.2.29 '
        + '(the underlying API has no backend handler and hangs) — this tool returns an error '
        + 'directing you to easyeda_pcb_find_in_region instead.',
      inputSchema: {
        x: z.number().describe(`X coordinate ${PCB_COORD}`),
        y: z.number().describe(`Y coordinate ${PCB_COORD}`),
      },
      annotations: { readOnlyHint: true },
    },
    ({ x, y }) => bridgeTool(bridge, 'pcb.document.getPrimitiveAtPoint', { x, y }),
  );

  server.registerTool(
    'easyeda_pcb_find_in_region',
    {
      description:
        'Find PCB components within a rectangular region. NOTE: EasyEDA Pro 0.2.29 has no backend '
        + 'for getPrimitivesInRegion, so this falls back to filtering components by origin — it '
        + 'returns components only (not traces/vias/text), keyed on their placement coordinate.',
      inputSchema: {
        left: z.number().describe(`Left X coordinate ${PCB_COORD}`),
        right: z.number().describe(`Right X coordinate ${PCB_COORD}`),
        top: z.number().describe(`Top Y coordinate ${PCB_COORD}`),
        bottom: z.number().describe(`Bottom Y coordinate ${PCB_COORD}`),
      },
      annotations: { readOnlyHint: true },
    },
    (params) => bridgeTool(bridge, 'pcb.document.getPrimitivesInRegion', params),
  );

  server.registerTool(
    'easyeda_pcb_get_layers',
    {
      description: 'List all PCB layers with their names, types, visibility, and lock status.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => bridgeTool(bridge, 'pcb.layer.getAllLayers'),
  );

  server.registerTool(
    'easyeda_pcb_set_layer_visibility',
    {
      description:
        'Show or hide specific PCB layers. Use layer IDs from easyeda_pcb_get_layers.',
      inputSchema: {
        layers: z.array(z.string()).min(1).describe('Layer IDs (from easyeda_pcb_get_layers)'),
        visible: z.boolean().describe('Whether to make the layers visible (true) or hidden (false)'),
      },
      annotations: { idempotentHint: true },
    },
    ({ layers, visible }) => bridgeTool(bridge, 'pcb.layer.setVisibility', { layers, visible }),
  );

  server.registerTool(
    'easyeda_pcb_set_copper_layers',
    {
      description: 'Set the number of copper layers on the PCB (2, 4, 6, etc.).',
      inputSchema: {
        count: z.number().int().min(1).max(32).describe('Number of copper layers'),
      },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    ({ count }) => bridgeTool(bridge, 'pcb.layer.setTheNumberOfCopperLayers', { count }),
  );

  server.registerTool(
    'easyeda_pcb_get_nets',
    {
      description: 'List all net names on the PCB.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => bridgeTool(bridge, 'pcb.net.getAllNets'),
  );

  server.registerTool(
    'easyeda_pcb_get_net_info',
    {
      description: 'Get detailed info for a single net including its routed length and connected primitives.',
      inputSchema: {
        net: z.string().describe('Net name'),
      },
      annotations: { readOnlyHint: true },
    },
    ({ net }) => bridgeTool(bridge, 'pcb.net.getNetInfo', { net }),
  );

  server.registerTool(
    'easyeda_pcb_highlight_net',
    {
      description: 'Highlight a net on the PCB canvas. Omit the net name to clear all net highlights.',
      inputSchema: {
        net: z.string().optional().describe('Net name to highlight; omit to clear all highlights'),
      },
    },
    ({ net }) => bridgeTool(bridge, 'pcb.net.highlight', { net }),
  );

  server.registerTool(
    'easyeda_pcb_select_net',
    {
      description: 'Select all primitives belonging to a net on the PCB.',
      inputSchema: {
        net: z.string().describe('Net name to select'),
      },
    },
    ({ net }) => bridgeTool(bridge, 'pcb.net.select', { net }),
  );

  server.registerTool(
    'easyeda_pcb_run_drc',
    {
      description: 'Run Design Rule Check (DRC) on the current PCB. Returns a formatted summary of all violations.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        const raw = await bridge.sendCommand('pcb.drc.runDrc', { verbose: true });
        if (!Array.isArray(raw)) {
          return {
            content: [{
              type: 'text' as const,
              text: `PCB DRC returned an unexpected result shape:\n${JSON.stringify(raw, null, 2)}`,
            }],
            isError: true,
          };
        }
        if (raw.length === 0) {
          return { content: [{ type: 'text' as const, text: 'PCB DRC passed — no issues found.' }] };
        }
        return { content: [{ type: 'text' as const, text: formatPcbDrc(raw) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
      }
    },
  );

  server.registerTool(
    'easyeda_pcb_get_design_rules',
    {
      description: 'Get the current PCB design rule configuration (clearances, widths, via sizes, etc.).',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    () => bridgeTool(bridge, 'pcb.drc.getRules'),
  );

  server.registerTool(
    'easyeda_pcb_set_design_rules',
    {
      description:
        'Overwrite the current PCB design rule configuration. Pass a COMPLETE rule configuration ' +
        'object in the same shape returned by easyeda_pcb_get_design_rules (read it first, modify, ' +
        'then set — a partial object may cause the EasyEDA API to hang and the tool to time out).',
      inputSchema: {
        ruleConfiguration: z.record(z.unknown()).describe(
          'Full rule configuration object (from easyeda_pcb_get_design_rules)',
        ),
      },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    ({ ruleConfiguration }) => bridgeTool(bridge, 'pcb.drc.setRules', { ruleConfiguration }),
  );

  server.registerTool(
    'easyeda_pcb_import_changes',
    {
      description: 'Sync the PCB from the schematic (import changes). Run this after modifying the schematic.',
      inputSchema: {},
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    () => bridgeTool(bridge, 'pcb.document.importChanges'),
  );

  server.registerTool(
    'easyeda_pcb_auto_route',
    {
      description:
        'Run the autorouter on the PCB. Optionally restrict to specific component/net UUIDs; ' +
        'omit to auto-route the whole board. NOTE: the EasyEDA Pro 0.2.29 autoRouting API was ' +
        'observed to hang — this tool may fail fast with a timeout error.',
      inputSchema: {
        uuids: z.array(z.string()).optional().describe('Optional UUIDs to restrict routing to'),
      },
      annotations: { destructiveHint: true, idempotentHint: false },
    },
    ({ uuids }) => bridgeTool(bridge, 'pcb.document.autoRoute', { uuids }),
  );

  server.registerTool(
    'easyeda_pcb_auto_place',
    {
      description:
        'Run automatic component placement (auto-layout) on the PCB. ' +
        'Optionally restrict to specific component UUIDs; omit to auto-place all. NOTE: the ' +
        'EasyEDA Pro 0.2.29 autoLayout API was observed to hang — this tool may fail fast with a timeout.',
      inputSchema: {
        uuids: z.array(z.string()).optional().describe('Optional component UUIDs to restrict placement to'),
      },
      annotations: { destructiveHint: true, idempotentHint: false },
    },
    ({ uuids }) => bridgeTool(bridge, 'pcb.document.autoLayout', { uuids }),
  );

  server.registerTool(
    'easyeda_pcb_clear_routing',
    {
      description:
        'Clear routing on the PCB — all traces, a single net, or just unrouted connections. '
        + 'NOTE: the EasyEDA Pro 0.2.29 clearRouting API was observed to hang — this tool may fail '
        + 'fast with a timeout error.',
      inputSchema: {
        type: z.enum(['all', 'net', 'connection']).optional().default('all')
          .describe('What to clear: "all" traces, a "net", or "connection" ratlines'),
      },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    ({ type }) => bridgeTool(bridge, 'pcb.document.clearRouting', { type }),
  );

  server.registerTool(
    'easyeda_pcb_place_component',
    {
      description:
        'Place a component/footprint on the PCB from a library device. ' +
        'Use easyeda_lib_search_device or easyeda_lib_get_by_lcsc to get the device and library UUIDs first.',
      inputSchema: {
        deviceUuid: z.string().describe('UUID of the device from the library'),
        libraryUuid: z.string().describe('UUID of the library the device belongs to'),
        x: z.number().describe(`X coordinate ${PCB_COORD}`),
        y: z.number().describe(`Y coordinate ${PCB_COORD}`),
        layer: z.number().optional().default(1).describe('Layer ID for the component (1 = top copper)'),
        rotation: z.number().optional().default(0).describe('Rotation angle in degrees'),
      },
      annotations: { destructiveHint: true, idempotentHint: false },
    },
    (params) => bridgeTool(bridge, 'pcb.primitive.placeComponent', params),
  );

  server.registerTool(
    'easyeda_pcb_modify_component',
    {
      description:
        'Modify a PCB component. Supported keys: x, y (position in mil), rotation (degrees), ' +
        'layer (layer ID — flips the component side), primitiveLock (boolean), designator, addIntoBom.',
      inputSchema: {
        primitiveId: z.string().describe('Primitive ID of the PCB component'),
        properties: z.record(z.unknown()).describe(
          'Properties to update, e.g. { x: 10.5, y: 20, rotation: 90, layer: 1 }',
        ),
      },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    ({ primitiveId, properties }) =>
      bridgeTool(bridge, 'pcb.primitive.modifyComponent', { primitiveId, properties }),
  );

  server.registerTool(
    'easyeda_pcb_place_via',
    {
      description: 'Place a via at the specified coordinates.',
      inputSchema: {
        x: z.number().describe(`X coordinate ${PCB_COORD}`),
        y: z.number().describe(`Y coordinate ${PCB_COORD}`),
        net: z.string().optional().describe('Net name to assign to the via'),
        diameter: z.number().optional().describe('Via pad diameter in mil (default 24 ≈ 0.6 mm)'),
        drill: z.number().optional().describe('Drill hole diameter in mil (default 12 ≈ 0.3 mm)'),
      },
      annotations: { destructiveHint: true, idempotentHint: false },
    },
    (params) => bridgeTool(bridge, 'pcb.primitive.placeVia', params),
  );

  server.registerTool(
    'easyeda_pcb_place_trace',
    {
      description: 'Draw a trace (series of connected segments) between points on a specified layer.',
      inputSchema: {
        points: z.array(z.object({
          x: z.number().describe(`X coordinate ${PCB_COORD}`),
          y: z.number().describe(`Y coordinate ${PCB_COORD}`),
        })).min(2).describe('Array of points defining the trace path'),
        layer: z.union([z.string(), z.number()]).describe('Layer ID (from easyeda_pcb_get_layers)'),
        width: z.number().describe('Trace width in mil'),
        net: z.string().optional().describe('Net name to assign'),
      },
      annotations: { destructiveHint: true, idempotentHint: false },
    },
    (params) => bridgeTool(bridge, 'pcb.primitive.placeTrace', params),
  );

  server.registerTool(
    'easyeda_pcb_place_text',
    {
      description:
        'Place text on a PCB layer (e.g. silkscreen). NOTE: this uses an alpha-stage EasyEDA API '
        + '(pcb_PrimitiveString) that was observed to hang in EasyEDA Pro 0.2.29 — it may fail fast '
        + 'with a timeout. The font must be pre-imported into EasyEDA Pro.',
      inputSchema: {
        text: z.string().describe('Text content'),
        x: z.number().describe(`X coordinate ${PCB_COORD}`),
        y: z.number().describe(`Y coordinate ${PCB_COORD}`),
        layer: z.union([z.string(), z.number()]).describe('Layer ID (from easyeda_pcb_get_layers)'),
        fontSize: z.number().optional().describe('Font size in mil (default 40)'),
        lineWidth: z.number().optional().describe('Stroke line width in mil (default 6)'),
        rotation: z.number().optional().default(0).describe('Rotation angle in degrees'),
      },
      annotations: { destructiveHint: true, idempotentHint: false },
    },
    (params) => bridgeTool(bridge, 'pcb.primitive.placeText', params),
  );

  server.registerTool(
    'easyeda_pcb_delete_primitives',
    {
      description: 'Delete PCB primitives (components, traces, vias, etc.) by their IDs.',
      inputSchema: {
        primitiveIds: z.array(z.string()).min(1).describe('Array of primitive IDs to delete'),
      },
      annotations: { destructiveHint: true, idempotentHint: true },
    },
    ({ primitiveIds }) => bridgeTool(bridge, 'pcb.primitive.delete', { primitiveIds }),
  );

  server.registerTool(
    'easyeda_pcb_select_primitives',
    {
      description: 'Select PCB primitives by their IDs.',
      inputSchema: {
        primitiveIds: z.array(z.string()).min(1).describe('Array of primitive IDs to select'),
      },
    },
    ({ primitiveIds }) => bridgeTool(bridge, 'pcb.selectControl.select', { primitiveIds }),
  );

  server.registerTool(
    'easyeda_pcb_clear_selection',
    {
      description: 'Clear the current selection on the PCB.',
      inputSchema: {},
    },
    () => bridgeTool(bridge, 'pcb.selectControl.clearSelected'),
  );

  server.registerTool(
    'easyeda_pcb_cross_probe',
    {
      description:
        'Cross-probe select components, pins, or nets on the PCB — the schematic↔PCB linking workflow. ' +
        'Highlights and/or selects the matching primitives.',
      inputSchema: {
        components: z.array(z.string()).optional().describe('Component designators or UUIDs'),
        pins: z.array(z.string()).optional().describe('Pin identifiers'),
        nets: z.array(z.string()).optional().describe('Net names'),
        highlight: z.boolean().optional().default(true).describe('Whether to highlight matches'),
        select: z.boolean().optional().default(true).describe('Whether to select matches'),
      },
    },
    (params) => bridgeTool(bridge, 'pcb.selectControl.crossProbe', params),
  );

  server.registerTool(
    'easyeda_pcb_navigate_to',
    {
      description: 'Navigate the PCB canvas to specific coordinates or zoom to fit.',
      inputSchema: {
        action: z.enum(['coordinates', 'fit_all', 'fit_selected']).describe('Navigation action'),
        x: z.number().optional().describe(`X coordinate ${PCB_COORD} (for "coordinates" action)`),
        y: z.number().optional().describe(`Y coordinate ${PCB_COORD} (for "coordinates" action)`),
        zoom: z.number().optional().describe('Zoom level (for "coordinates" action)'),
      },
    },
    (params) => bridgeTool(bridge, 'editor.navigate', params),
  );

  server.registerTool(
    'easyeda_pcb_zoom_to_board',
    {
      description: 'Zoom the PCB canvas to fit the board outline.',
      inputSchema: {},
    },
    () => bridgeTool(bridge, 'pcb.document.zoomToBoardOutline'),
  );
}

// ── DRC formatting ──────────────────────────────────────────

interface DrcObj {
  typeName?: string;
  suffix?: string;
}

interface DrcError {
  errorType?: string;
  errorObjType?: string;
  ruleName?: string;
  obj1?: DrcObj;
  obj2?: DrcObj;
}

interface DrcNetGroup {
  name?: string;
  list?: DrcError[];
}

interface DrcCategory {
  name?: string;
  list?: DrcNetGroup[];
}

function describeObj(obj?: DrcObj): string {
  if (!obj) return '?';
  return obj.suffix ?? obj.typeName ?? '?';
}

function formatPcbDrc(categories: unknown[]): string {
  const cats = categories as DrcCategory[];
  let totalErrors = 0;
  const lines: string[] = [];

  for (const cat of cats) {
    const categoryName = cat.name ?? 'Unknown';
    const netGroups = cat.list ?? [];
    let categoryTotal = 0;
    const netLines: string[] = [];

    for (const group of netGroups) {
      const netName = group.name ?? '(unnamed)';
      const errors = group.list ?? [];
      categoryTotal += errors.length;

      // Describe each violation as "objA <-> objB" when two objects are involved.
      const items: string[] = [];
      for (const e of errors) {
        items.push(e.obj2 ? `${describeObj(e.obj1)} <-> ${describeObj(e.obj2)}` : describeObj(e.obj1));
      }

      const MAX_SHOW = 6;
      const itemList = items.length <= MAX_SHOW
        ? items.join(', ')
        : `${items.slice(0, MAX_SHOW).join(', ')}, ... (+${items.length - MAX_SHOW} more)`;

      netLines.push(`  ${netName}: ${errors.length} — ${itemList}`);
    }

    totalErrors += categoryTotal;
    lines.push(`${categoryName} (${categoryTotal}):`);
    lines.push(...netLines);
  }

  const header = `PCB DRC: ${totalErrors} issue${totalErrors !== 1 ? 's' : ''} found`;
  return `${header}\n${lines.join('\n')}`;
}

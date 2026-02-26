import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WsBridge } from '../ws-bridge.js';
import { bridgeTool } from './helpers.js';

export function registerPcbTools(server: McpServer, bridge: WsBridge): void {
  server.registerTool(
    'easyeda_pcb_get_all_components',
    {
      description: 'List all components on the current PCB with positions, layers, designators, and footprints.',
      inputSchema: {},
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
    },
    ({ primitiveId }) => bridgeTool(bridge, 'pcb.primitive.getComponent', { primitiveId }),
  );

  server.registerTool(
    'easyeda_pcb_get_selected',
    {
      description: 'Get the currently selected primitives on the PCB.',
      inputSchema: {},
    },
    () => bridgeTool(bridge, 'pcb.selectControl.getSelected'),
  );

  server.registerTool(
    'easyeda_pcb_get_layers',
    {
      description: 'List all PCB layers with their names, types, visibility, and lock status.',
      inputSchema: {},
    },
    () => bridgeTool(bridge, 'pcb.layer.getAllLayers'),
  );

  server.registerTool(
    'easyeda_pcb_set_layer_visibility',
    {
      description: 'Show or hide specific PCB layers.',
      inputSchema: {
        layers: z.array(z.string()).min(1).describe('Layer names or IDs'),
        visible: z.boolean().describe('Whether to make the layers visible (true) or hidden (false)'),
      },
    },
    ({ layers, visible }) => bridgeTool(bridge, 'pcb.layer.setVisibility', { layers, visible }),
  );

  server.registerTool(
    'easyeda_pcb_set_copper_layers',
    {
      description: 'Set the number of copper layers on the PCB (2, 4, 6, etc.).',
      inputSchema: {
        count: z.number().min(1).max(32).describe('Number of copper layers'),
      },
    },
    ({ count }) => bridgeTool(bridge, 'pcb.layer.setTheNumberOfCopperLayers', { count }),
  );

  server.registerTool(
    'easyeda_pcb_get_nets',
    {
      description: 'List all nets on the PCB with their names and connected pads.',
      inputSchema: {},
    },
    () => bridgeTool(bridge, 'pcb.net.getAllNets'),
  );

  server.registerTool(
    'easyeda_pcb_run_drc',
    {
      description: 'Run Design Rule Check (DRC) on the current PCB. Returns a formatted summary of all violations.',
      inputSchema: {},
    },
    async () => {
      try {
        const raw = await bridge.sendCommand('pcb.drc.runDrc', { verbose: true }) as unknown[];
        if (!Array.isArray(raw) || raw.length === 0) {
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
    'easyeda_pcb_import_changes',
    {
      description: 'Sync the PCB from the schematic (import changes). Run this after modifying the schematic.',
      inputSchema: {},
    },
    () => bridgeTool(bridge, 'pcb.document.importChanges'),
  );

  server.registerTool(
    'easyeda_pcb_modify_component',
    {
      description: 'Modify a PCB component (position, rotation, layer/side, etc.).',
      inputSchema: {
        primitiveId: z.string().describe('Primitive ID of the PCB component'),
        properties: z.record(z.unknown()).describe(
          'Properties to update (e.g., { x: 100, y: 200, rotation: 90, layer: "TopLayer" })'
        ),
      },
    },
    ({ primitiveId, properties }) =>
      bridgeTool(bridge, 'pcb.primitive.modifyComponent', { primitiveId, properties }),
  );

  server.registerTool(
    'easyeda_pcb_place_via',
    {
      description: 'Place a via at the specified coordinates.',
      inputSchema: {
        x: z.number().describe('X coordinate'),
        y: z.number().describe('Y coordinate'),
        net: z.string().optional().describe('Net name to assign to the via'),
        diameter: z.number().optional().describe('Via diameter'),
        drill: z.number().optional().describe('Drill hole diameter'),
      },
    },
    (params) => bridgeTool(bridge, 'pcb.primitive.placeVia', params),
  );

  server.registerTool(
    'easyeda_pcb_place_trace',
    {
      description: 'Draw a trace between points on a specified layer.',
      inputSchema: {
        points: z.array(z.object({
          x: z.number().describe('X coordinate'),
          y: z.number().describe('Y coordinate'),
        })).min(2).describe('Array of points defining the trace path'),
        layer: z.string().describe('Layer name (e.g., "TopLayer", "BottomLayer")'),
        width: z.number().describe('Trace width'),
        net: z.string().optional().describe('Net name to assign'),
      },
    },
    (params) => bridgeTool(bridge, 'pcb.primitive.placeTrace', params),
  );

  server.registerTool(
    'easyeda_pcb_place_text',
    {
      description: 'Place text on a PCB layer.',
      inputSchema: {
        text: z.string().describe('Text content'),
        x: z.number().describe('X coordinate'),
        y: z.number().describe('Y coordinate'),
        layer: z.string().describe('Layer name (e.g., "TopSilkLayer")'),
        fontSize: z.number().optional().describe('Font size'),
      },
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
    'easyeda_pcb_navigate_to',
    {
      description: 'Navigate the PCB canvas to specific coordinates or zoom to fit all.',
      inputSchema: {
        action: z.enum(['coordinates', 'fit_all', 'fit_selected']).describe('Navigation action'),
        x: z.number().optional().describe('X coordinate (for "coordinates" action)'),
        y: z.number().optional().describe('Y coordinate (for "coordinates" action)'),
        zoom: z.number().optional().describe('Zoom level (for "coordinates" action)'),
      },
    },
    (params) => bridgeTool(bridge, 'editor.navigate', params),
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

      // Collect affected pad/object descriptions
      const pads: string[] = [];
      for (const e of errors) {
        const suffix = e.obj1?.suffix ?? e.obj1?.typeName ?? '?';
        pads.push(suffix);
      }

      // Show up to 6 pads, then "..."
      const MAX_SHOW = 6;
      const padList = pads.length <= MAX_SHOW
        ? pads.join(', ')
        : pads.slice(0, MAX_SHOW).join(', ') + `, ... (+${pads.length - MAX_SHOW} more)`;

      netLines.push(`  ${netName}: ${errors.length} — ${padList}`);
    }

    totalErrors += categoryTotal;
    lines.push(`${categoryName} (${categoryTotal}):`);
    lines.push(...netLines);
    lines.push('');
  }

  const header = totalErrors === 0
    ? 'PCB DRC passed — no issues found.'
    : `PCB DRC: ${totalErrors} issue${totalErrors !== 1 ? 's' : ''} found\n`;

  return header + lines.join('\n');
}

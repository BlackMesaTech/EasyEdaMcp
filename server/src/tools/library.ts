import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WsBridge } from '../ws-bridge.js';
import { bridgeTool } from './helpers.js';

export function registerLibraryTools(server: McpServer, bridge: WsBridge): void {
  server.registerTool(
    'easyeda_lib_get_libraries',
    {
      description: 'List all available component libraries (system, personal, project, favorites).',
      inputSchema: {},
    },
    () => bridgeTool(bridge, 'lib.librariesList.getAllLibrariesList'),
  );

  server.registerTool(
    'easyeda_lib_search_device',
    {
      description:
        'Search for components/devices in EasyEDA libraries. ' +
        'Returns matching devices with their UUIDs, names, footprints, and symbols.',
      inputSchema: {
        keyword: z.string().describe('Search keyword (e.g., "STM32F103", "10k resistor")'),
        libraryUuid: z.string().optional().describe('Specific library UUID to search in (omit for all libraries)'),
      },
    },
    ({ keyword, libraryUuid }) =>
      bridgeTool(bridge, 'lib.device.search', { keyword, libraryUuid }),
  );

  server.registerTool(
    'easyeda_lib_get_device',
    {
      description: 'Get full details of a specific component/device by its UUID.',
      inputSchema: {
        deviceUuid: z.string().describe('UUID of the device'),
      },
    },
    ({ deviceUuid }) => bridgeTool(bridge, 'lib.device.get', { deviceUuid }),
  );

  server.registerTool(
    'easyeda_lib_get_by_lcsc',
    {
      description:
        'Look up components by their LCSC part numbers (e.g., "C25804"). ' +
        'Returns device details including UUIDs needed for placing components.',
      inputSchema: {
        lcscIds: z.array(z.string()).min(1).describe('Array of LCSC part numbers (e.g., ["C25804", "C14663"])'),
      },
    },
    ({ lcscIds }) => bridgeTool(bridge, 'lib.device.getByLcscIds', { lcscIds }),
  );

  server.registerTool(
    'easyeda_lib_search_footprint',
    {
      description: 'Search for footprints in EasyEDA libraries.',
      inputSchema: {
        keyword: z.string().describe('Search keyword (e.g., "SOIC-8", "0402")'),
        libraryUuid: z.string().optional().describe('Specific library UUID to search in'),
      },
    },
    ({ keyword, libraryUuid }) =>
      bridgeTool(bridge, 'lib.footprint.search', { keyword, libraryUuid }),
  );

  server.registerTool(
    'easyeda_lib_search_symbol',
    {
      description: 'Search for schematic symbols in EasyEDA libraries.',
      inputSchema: {
        keyword: z.string().describe('Search keyword'),
        libraryUuid: z.string().optional().describe('Specific library UUID to search in'),
      },
    },
    ({ keyword, libraryUuid }) =>
      bridgeTool(bridge, 'lib.symbol.search', { keyword, libraryUuid }),
  );
}

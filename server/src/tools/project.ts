import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { WsBridge } from '../ws-bridge.js';
import { bridgeTool } from './helpers.js';

export function registerProjectTools(server: McpServer, bridge: WsBridge): void {
  server.registerTool(
    'easyeda_get_project_info',
    {
      description: 'Get information about the currently open project including its name, schematics, PCBs, and boards.',
      inputSchema: {},
    },
    () => bridgeTool(bridge, 'dmt.project.getCurrentProjectInfo'),
  );

  server.registerTool(
    'easyeda_get_current_document',
    {
      description: 'Get the type and UUID of the currently focused document (schematic page, PCB, etc.).',
      inputSchema: {},
    },
    () => bridgeTool(bridge, 'dmt.selectControl.getCurrentDocumentInfo'),
  );

  server.registerTool(
    'easyeda_open_document',
    {
      description: 'Open a schematic page or PCB document by its UUID.',
      inputSchema: {
        documentUuid: z.string().describe('UUID of the document to open'),
      },
    },
    ({ documentUuid }) => bridgeTool(bridge, 'dmt.editorControl.openDocument', { documentUuid }),
  );

  server.registerTool(
    'easyeda_save_document',
    {
      description: 'Save the currently active schematic or PCB document.',
      inputSchema: {
        documentType: z.enum(['schematic', 'pcb']).describe('Type of the current document'),
      },
    },
    ({ documentType }) => {
      const command = documentType === 'schematic' ? 'sch.document.save' : 'pcb.document.save';
      return bridgeTool(bridge, command);
    },
  );

  server.registerTool(
    'easyeda_list_schematics',
    {
      description: 'List all schematics and their pages in the current project.',
      inputSchema: {},
    },
    () => bridgeTool(bridge, 'dmt.schematic.getAllSchematicsInfo'),
  );

  server.registerTool(
    'easyeda_list_schematic_pages',
    {
      description: 'List all schematic pages across all schematics in the current project.',
      inputSchema: {},
    },
    () => bridgeTool(bridge, 'dmt.schematic.getAllSchematicPagesInfo'),
  );

  server.registerTool(
    'easyeda_list_pcbs',
    {
      description: 'List all PCBs in the current project.',
      inputSchema: {},
    },
    () => bridgeTool(bridge, 'dmt.pcb.getAllPcbsInfo'),
  );

  server.registerTool(
    'easyeda_list_boards',
    {
      description: 'List all boards in the current project.',
      inputSchema: {},
    },
    () => bridgeTool(bridge, 'dmt.board.getAllBoardsInfo'),
  );
}

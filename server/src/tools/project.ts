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
    'easyeda_close_document',
    {
      description: 'Close an open document tab by its tab ID.',
      inputSchema: {
        tabId: z.string().describe('Tab ID of the document to close'),
      },
    },
    ({ tabId }) => bridgeTool(bridge, 'dmt.editorControl.closeDocument', { tabId }),
  );

  server.registerTool(
    'easyeda_save_document',
    {
      description:
        'Save the currently active schematic or PCB document. ' +
        'Call easyeda_get_current_document first if unsure which type is focused.',
      inputSchema: {
        documentType: z.enum(['schematic', 'pcb']).describe('Type of the currently focused document'),
      },
      annotations: { idempotentHint: true },
    },
    ({ documentType }) => {
      const command = documentType === 'schematic' ? 'sch.document.save' : 'pcb.document.save';
      return bridgeTool(bridge, command);
    },
  );

  server.registerTool(
    'easyeda_create_project',
    {
      description: 'Create a new EasyEDA Pro project. Returns the new project UUID.',
      inputSchema: {
        name: z.string().describe('Friendly name for the project'),
        description: z.string().optional().describe('Optional project description'),
      },
      annotations: { idempotentHint: false },
    },
    ({ name, description }) => bridgeTool(bridge, 'dmt.project.createProject', { name, description }),
  );

  server.registerTool(
    'easyeda_open_project',
    {
      description: 'Open an existing project by its UUID.',
      inputSchema: {
        projectUuid: z.string().describe('UUID of the project to open'),
      },
    },
    ({ projectUuid }) => bridgeTool(bridge, 'dmt.project.openProject', { projectUuid }),
  );

  server.registerTool(
    'easyeda_create_schematic',
    {
      description: 'Create a new schematic in the current project. Returns the new schematic UUID.',
      inputSchema: {
        boardName: z.string().optional().describe('Optional board name to associate the schematic with'),
      },
      annotations: { idempotentHint: false },
    },
    ({ boardName }) => bridgeTool(bridge, 'dmt.schematic.createSchematic', { boardName }),
  );

  server.registerTool(
    'easyeda_create_schematic_page',
    {
      description: 'Add a new page to an existing schematic. Returns the new page UUID.',
      inputSchema: {
        schematicUuid: z.string().describe('UUID of the schematic to add a page to'),
      },
      annotations: { idempotentHint: false },
    },
    ({ schematicUuid }) => bridgeTool(bridge, 'dmt.schematic.createSchematicPage', { schematicUuid }),
  );

  server.registerTool(
    'easyeda_create_pcb',
    {
      description: 'Create a new PCB in the current project. Returns the new PCB UUID.',
      inputSchema: {
        boardName: z.string().optional().describe('Optional board name to associate the PCB with'),
      },
      annotations: { idempotentHint: false },
    },
    ({ boardName }) => bridgeTool(bridge, 'dmt.pcb.createPcb', { boardName }),
  );

  server.registerTool(
    'easyeda_create_board',
    {
      description:
        'Create a new board, optionally linking an existing schematic and PCB. Returns the new board UUID.',
      inputSchema: {
        schematicUuid: z.string().optional().describe('UUID of a schematic to link to the board'),
        pcbUuid: z.string().optional().describe('UUID of a PCB to link to the board'),
      },
      annotations: { idempotentHint: false },
    },
    ({ schematicUuid, pcbUuid }) => bridgeTool(bridge, 'dmt.board.createBoard', { schematicUuid, pcbUuid }),
  );

  server.registerTool(
    'easyeda_get_board_info',
    {
      description: 'Get information about a board by its name.',
      inputSchema: {
        boardName: z.string().describe('Name of the board'),
      },
      annotations: { readOnlyHint: true },
    },
    ({ boardName }) => bridgeTool(bridge, 'dmt.board.getBoardInfo', { boardName }),
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

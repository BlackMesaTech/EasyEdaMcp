import type { CommandHandler } from '../handler-registry';

const handlers: Record<string, CommandHandler> = {

  // ── Project ──────────────────────────────────────────────

  'dmt.project.getCurrentProjectInfo': async () => {
    return await eda.dmt_Project.getCurrentProjectInfo();
  },

  'dmt.project.getAllProjectsUuid': async (params) => {
    return await eda.dmt_Project.getAllProjectsUuid(
      params.teamUuid as string | undefined,
      params.folderUuid as string | undefined,
    );
  },

  'dmt.project.getProjectInfo': async (params) => {
    return await eda.dmt_Project.getProjectInfo(params.projectUuid as string);
  },

  // ── Document selection ───────────────────────────────────

  'dmt.selectControl.getCurrentDocumentInfo': async () => {
    return await eda.dmt_SelectControl.getCurrentDocumentInfo();
  },

  // ── Editor control ───────────────────────────────────────

  'dmt.editorControl.openDocument': async (params) => {
    return await eda.dmt_EditorControl.openDocument(params.documentUuid as string);
  },

  'dmt.editorControl.getCurrentRenderedAreaImage': async () => {
    const result = await eda.dmt_EditorControl.getCurrentRenderedAreaImage();
    if (!result) return { error: 'API returned null/undefined', type: typeof result };

    // Check if it's a Blob
    if (result instanceof Blob) {
      if (result.size === 0) return { error: 'API returned empty Blob', size: 0 };
      const arrayBuffer = await result.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      return { mimeType: result.type || 'image/png', base64 };
    }

    // If it's already a string (data URI or base64), try to use it directly
    if (typeof result === 'string') {
      if (result.startsWith('data:')) {
        const match = result.match(/^data:([^;]+);base64,(.+)$/);
        if (match) return { mimeType: match[1], base64: match[2] };
      }
      return { mimeType: 'image/png', base64: result };
    }

    // Unknown type — return debug info
    return {
      error: 'Unexpected return type',
      type: typeof result,
      constructor: (result as any)?.constructor?.name,
      keys: typeof result === 'object' ? Object.keys(result as object) : undefined,
    };
  },

  'dmt.editorControl.zoomToAllPrimitives': async () => {
    // These zoom calls may never resolve their promise (EasyEDA API quirk).
    // Use Promise.race with a short timeout — the zoom action fires regardless.
    const timeout = new Promise((resolve) => setTimeout(() => resolve('zoom_fired'), 2000));
    const result = await Promise.race([
      eda.dmt_EditorControl.zoomToAllPrimitives(),
      timeout,
    ]);
    return result === 'zoom_fired' ? true : result;
  },

  'dmt.editorControl.zoomToSelectedPrimitives': async () => {
    const timeout = new Promise((resolve) => setTimeout(() => resolve('zoom_fired'), 2000));
    const result = await Promise.race([
      eda.dmt_EditorControl.zoomToSelectedPrimitives(),
      timeout,
    ]);
    return result === 'zoom_fired' ? true : result;
  },

  'dmt.editorControl.zoomToRegion': async (params) => {
    // API signature: zoomToRegion(left, right, top, bottom)
    const x1 = params.x1 as number;
    const y1 = params.y1 as number;
    const x2 = params.x2 as number;
    const y2 = params.y2 as number;
    const timeout = new Promise((resolve) => setTimeout(() => resolve('zoom_fired'), 2000));
    const result = await Promise.race([
      eda.dmt_EditorControl.zoomToRegion(
        Math.min(x1, x2), Math.max(x1, x2),
        Math.min(y1, y2), Math.max(y1, y2),
      ),
      timeout,
    ]);
    return result === 'zoom_fired' ? true : result;
  },

  'dmt.editorControl.generateIndicatorMarkers': async (params) => {
    return await eda.dmt_EditorControl.generateIndicatorMarkers(params.markers as any);
  },

  'dmt.editorControl.removeIndicatorMarkers': async () => {
    return await eda.dmt_EditorControl.removeIndicatorMarkers();
  },

  // ── Schematics ───────────────────────────────────────────

  'dmt.schematic.getAllSchematicsInfo': async () => {
    return await eda.dmt_Schematic.getAllSchematicsInfo();
  },

  'dmt.schematic.getAllSchematicPagesInfo': async () => {
    return await eda.dmt_Schematic.getAllSchematicPagesInfo();
  },

  'dmt.schematic.getSchematicInfo': async (params) => {
    return await eda.dmt_Schematic.getSchematicInfo(params.schematicUuid as string);
  },

  'dmt.schematic.getCurrentSchematicInfo': async () => {
    return await eda.dmt_Schematic.getCurrentSchematicInfo();
  },

  'dmt.schematic.getCurrentSchematicPageInfo': async () => {
    return await eda.dmt_Schematic.getCurrentSchematicPageInfo();
  },

  // ── PCBs ─────────────────────────────────────────────────

  'dmt.pcb.getAllPcbsInfo': async () => {
    return await eda.dmt_Pcb.getAllPcbsInfo();
  },

  'dmt.pcb.getPcbInfo': async (params) => {
    return await eda.dmt_Pcb.getPcbInfo(params.pcbUuid as string);
  },

  'dmt.pcb.getCurrentPcbInfo': async () => {
    return await eda.dmt_Pcb.getCurrentPcbInfo();
  },

  // ── Boards ───────────────────────────────────────────────

  'dmt.board.getAllBoardsInfo': async () => {
    return await eda.dmt_Board.getAllBoardsInfo();
  },

  'dmt.board.getBoardInfo': async (params) => {
    return await eda.dmt_Board.getBoardInfo(params.boardUuid as string);
  },

  'dmt.board.getCurrentBoardInfo': async () => {
    return await eda.dmt_Board.getCurrentBoardInfo();
  },
};

export default handlers;

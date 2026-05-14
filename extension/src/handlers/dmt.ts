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

  'dmt.project.createProject': async (params) => {
    const friendlyName = params.name as string;
    const description = params.description as string | undefined;
    return await eda.dmt_Project.createProject(friendlyName, undefined, undefined, undefined, description);
  },

  'dmt.project.openProject': async (params) => {
    return await eda.dmt_Project.openProject(params.projectUuid as string);
  },

  // ── Document selection ───────────────────────────────────

  'dmt.selectControl.getCurrentDocumentInfo': async () => {
    return await eda.dmt_SelectControl.getCurrentDocumentInfo();
  },

  // ── Editor control ───────────────────────────────────────

  'dmt.editorControl.openDocument': async (params) => {
    return await eda.dmt_EditorControl.openDocument(params.documentUuid as string);
  },

  'dmt.editorControl.closeDocument': async (params) => {
    return await eda.dmt_EditorControl.closeDocument(params.tabId as string);
  },

  'dmt.editorControl.getCurrentRenderedAreaImage': async () => {
    // pro-api 0.2.29: returns Promise<Blob | undefined>.
    const result = await eda.dmt_EditorControl.getCurrentRenderedAreaImage();
    if (!result) return { error: 'API returned no image (null/undefined)' };
    if (result.size === 0) return { error: 'API returned an empty image Blob', size: 0 };

    const arrayBuffer = await result.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return { mimeType: result.type || 'image/png', base64 };
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

  'dmt.schematic.createSchematic': async (params) => {
    return await eda.dmt_Schematic.createSchematic(params.boardName as string | undefined);
  },

  'dmt.schematic.createSchematicPage': async (params) => {
    return await eda.dmt_Schematic.createSchematicPage(params.schematicUuid as string);
  },

  // ── PCBs ─────────────────────────────────────────────────

  'dmt.pcb.getAllPcbsInfo': async () => {
    return await eda.dmt_Pcb.getAllPcbsInfo();
  },

  'dmt.pcb.createPcb': async (params) => {
    return await eda.dmt_Pcb.createPcb(params.boardName as string | undefined);
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
    // DMT_Board is keyed by board NAME, not uuid, in pro-api 0.2.29.
    return await eda.dmt_Board.getBoardInfo(params.boardName as string);
  },

  'dmt.board.getCurrentBoardInfo': async () => {
    return await eda.dmt_Board.getCurrentBoardInfo();
  },

  'dmt.board.createBoard': async (params) => {
    const schematicUuid = params.schematicUuid as string | undefined;
    const pcbUuid = params.pcbUuid as string | undefined;
    return await eda.dmt_Board.createBoard(schematicUuid, pcbUuid);
  },
};

export default handlers;

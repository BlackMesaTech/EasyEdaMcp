import type { CommandHandler } from '../handler-registry';
import { fileToBase64 } from './utils';

const handlers: Record<string, CommandHandler> = {

  // ── Document ─────────────────────────────────────────────

  'pcb.document.save': async () => {
    return await eda.pcb_Document.save();
  },

  'pcb.document.importChanges': async () => {
    return await eda.pcb_Document.importChanges();
  },

  // ── Read operations ──────────────────────────────────────

  'pcb.primitive.getAllComponents': async () => {
    return await eda.pcb_PrimitiveComponent.getAll();
  },

  'pcb.primitive.getComponent': async (params) => {
    const primitiveId = params.primitiveId as string;
    return await eda.pcb_PrimitiveComponent.get(primitiveId);
  },

  'pcb.selectControl.getSelected': async () => {
    return await eda.pcb_SelectControl.getAllSelectedPrimitives_PrimitiveId();
  },

  // ── Layers ───────────────────────────────────────────────

  'pcb.layer.getAllLayers': async () => {
    return await eda.pcb_Layer.getAllLayers();
  },

  'pcb.layer.setVisibility': async (params) => {
    const layers = params.layers as string[];
    const visible = params.visible as boolean;
    if (visible) {
      return await eda.pcb_Layer.setLayerVisible(layers);
    } else {
      return await eda.pcb_Layer.setLayerInvisible(layers);
    }
  },

  'pcb.layer.setTheNumberOfCopperLayers': async (params) => {
    const count = params.count as number;
    return await eda.pcb_Layer.setTheNumberOfCopperLayers(count);
  },

  // ── Nets ─────────────────────────────────────────────────

  'pcb.net.getAllNets': async () => {
    return await eda.pcb_Net.getAllNetsName();
  },

  // ── DRC ──────────────────────────────────────────────────

  'pcb.drc.runDrc': async (params) => {
    const verbose = (params.verbose as boolean) ?? true;
    if (verbose) {
      return await eda.pcb_Drc.check(true, false, true);
    }
    return await eda.pcb_Drc.check(true, false, false);
  },

  // ── Place operations ─────────────────────────────────────

  'pcb.primitive.placeVia': async (params) => {
    const net = (params.net as string) ?? '';
    const x = params.x as number;
    const y = params.y as number;
    const holeDiameter = (params.drill as number) ?? 0.3;
    const diameter = (params.diameter as number) ?? 0.6;
    return await eda.pcb_PrimitiveVia.create(net, x, y, holeDiameter, diameter);
  },

  'pcb.primitive.placeTrace': async (params) => {
    const points = params.points as Array<{ x: number; y: number }>;
    const layer = params.layer as string;
    const width = (params.width as number) ?? 0.25;
    const net = (params.net as string) ?? '';
    // PCB_PrimitiveLine.create makes one segment at a time (startX, startY, endX, endY)
    const results = [];
    for (let i = 0; i < points.length - 1; i++) {
      const seg = await eda.pcb_PrimitiveLine.create(
        net, layer, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, width
      );
      results.push(seg);
    }
    return results;
  },

  'pcb.primitive.placeText': async (params) => {
    // PCB_PrimitiveString is excluded from public API — not available
    throw new Error('PCB text placement is not available in the current EasyEDA API version');
  },

  // ── Modify operations ────────────────────────────────────

  'pcb.primitive.modifyComponent': async (params) => {
    const primitiveId = params.primitiveId as string;
    const properties = params.properties as Record<string, unknown>;
    return await eda.pcb_PrimitiveComponent.modify(primitiveId, properties);
  },

  // ── Delete operations ────────────────────────────────────

  'pcb.primitive.delete': async (params) => {
    const primitiveIds = params.primitiveIds as string[];
    return await eda.pcb_PrimitiveComponent.delete(primitiveIds);
  },

  // ── Selection ────────────────────────────────────────────

  'pcb.selectControl.select': async (params) => {
    const primitiveIds = params.primitiveIds as string[];
    return await eda.pcb_SelectControl.doSelectPrimitives(primitiveIds);
  },

  // ── Manufacturing exports ────────────────────────────────

  'pcb.manufactureData.getGerberFile': async () => {
    const file = await eda.pcb_ManufactureData.getGerberFile();
    return fileToBase64(file);
  },

  'pcb.manufactureData.getBomFile': async () => {
    const file = await eda.pcb_ManufactureData.getBomFile();
    return fileToBase64(file);
  },

  'pcb.manufactureData.getPickAndPlaceFile': async () => {
    const file = await eda.pcb_ManufactureData.getPickAndPlaceFile();
    return fileToBase64(file);
  },

  'pcb.manufactureData.get3DFile': async () => {
    const file = await eda.pcb_ManufactureData.get3DFile();
    return fileToBase64(file);
  },

  'pcb.manufactureData.getPdfFile': async () => {
    const file = await eda.pcb_ManufactureData.getPdfFile();
    return fileToBase64(file);
  },

  'pcb.manufactureData.getDxfFile': async () => {
    const file = await eda.pcb_ManufactureData.getDxfFile();
    return fileToBase64(file);
  },

  'pcb.manufactureData.getDsnFile': async () => {
    const file = await eda.pcb_ManufactureData.getDsnFile();
    return fileToBase64(file);
  },

  'pcb.manufactureData.getNetlistFile': async () => {
    const file = await eda.pcb_ManufactureData.getNetlistFile();
    return fileToBase64(file);
  },

  // ── Navigation ───────────────────────────────────────────

  'editor.navigate': async (params) => {
    const action = params.action as string;
    const timeout = new Promise((resolve) => setTimeout(() => resolve('zoom_fired'), 2000));
    switch (action) {
      case 'fit_all':
        return await Promise.race([eda.dmt_EditorControl.zoomToAllPrimitives(), timeout]);
      case 'fit_selected':
        return await Promise.race([eda.dmt_EditorControl.zoomToSelectedPrimitives(), timeout]);
      case 'coordinates':
        return await Promise.race([
          eda.dmt_EditorControl.zoomTo(
            params.x as number,
            params.y as number,
            params.zoom as number | undefined,
          ),
          timeout,
        ]);
      default:
        throw new Error(`Unknown navigation action: ${action}`);
    }
  },
};

export default handlers;

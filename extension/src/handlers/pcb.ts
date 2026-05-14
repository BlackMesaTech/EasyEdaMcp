import type { CommandHandler } from '../handler-registry';
import { fileToBase64, withTimeout } from './utils';

/** Short fail-fast budget for EasyEDA 0.2.29 document APIs known to hang. */
const HANG_GUARD_MS = 12_000;

const handlers: Record<string, CommandHandler> = {

  // ── Document ─────────────────────────────────────────────

  'pcb.document.save': async (params) => {
    // PCB_Document.save requires the PCB uuid (unlike SCH_Document.save()).
    let uuid = params.pcbUuid as string | undefined;
    if (!uuid) {
      const info = await eda.dmt_Pcb.getCurrentPcbInfo();
      uuid = info?.uuid;
    }
    if (!uuid) {
      throw new Error('No PCB is currently open — cannot save. Open a PCB document first.');
    }
    return await eda.pcb_Document.save(uuid);
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

  'pcb.document.getPrimitiveAtPoint': async () => {
    // pcb_Document.getPrimitiveAtPoint issues an rpcCall with no backend handler in
    // pro-api 0.2.29 — it hangs. No reliable fallback without primitive bounding boxes.
    throw new Error(
      'pcb_Document.getPrimitiveAtPoint is not implemented in EasyEDA Pro 0.2.29. '
      + 'Use easyeda_pcb_find_in_region or easyeda_pcb_get_all_components instead.',
    );
  },

  'pcb.document.getPrimitivesInRegion': async (params) => {
    // pcb_Document.getPrimitivesInRegion hangs (no backend handler) in pro-api 0.2.29.
    // Fall back to filtering components from the working getAll() by their origin.
    const left = params.left as number;
    const right = params.right as number;
    const top = params.top as number;
    const bottom = params.bottom as number;
    const loX = Math.min(left, right); const hiX = Math.max(left, right);
    const loY = Math.min(top, bottom); const hiY = Math.max(top, bottom);
    const all = await eda.pcb_PrimitiveComponent.getAll();
    return (all ?? []).filter((c: any) =>
      typeof c?.x === 'number' && typeof c?.y === 'number'
      && c.x >= loX && c.x <= hiX && c.y >= loY && c.y <= hiY);
  },

  // ── Layers ───────────────────────────────────────────────

  'pcb.layer.getAllLayers': async () => {
    return await eda.pcb_Layer.getAllLayers();
  },

  'pcb.layer.setVisibility': async (params) => {
    // Layer ids must be valid TPCB_LayersInTheSelectable values — source them
    // from pcb.layer.getAllLayers. We cast through the expected parameter type.
    const layers = params.layers as unknown as Parameters<typeof eda.pcb_Layer.setLayerVisible>[0];
    const visible = params.visible as boolean;
    if (visible) {
      return await eda.pcb_Layer.setLayerVisible(layers);
    }
    return await eda.pcb_Layer.setLayerInvisible(layers);
  },

  'pcb.layer.setTheNumberOfCopperLayers': async (params) => {
    // API accepts only even counts 2..32; pass through and let EasyEDA validate.
    const count = params.count as any;
    return await eda.pcb_Layer.setTheNumberOfCopperLayers(count);
  },

  // ── Nets ─────────────────────────────────────────────────

  'pcb.net.getAllNets': async () => {
    return await eda.pcb_Net.getAllNetsName();
  },

  'pcb.net.getNetInfo': async (params) => {
    const net = params.net as string;
    const info = await eda.pcb_Net.getNet(net);
    const length = await eda.pcb_Net.getNetLength(net);
    return { net, info, length };
  },

  'pcb.net.highlight': async (params) => {
    const net = params.net as string | undefined;
    if (!net) {
      return await eda.pcb_Net.unhighlightAllNets();
    }
    return await eda.pcb_Net.highlightNet(net);
  },

  'pcb.net.select': async (params) => {
    const net = params.net as string;
    return await eda.pcb_Net.selectNet(net);
  },

  // ── DRC ──────────────────────────────────────────────────

  'pcb.drc.runDrc': async (params) => {
    const verbose = (params.verbose as boolean) ?? true;
    if (verbose) {
      return await eda.pcb_Drc.check(true, false, true);
    }
    return await eda.pcb_Drc.check(true, false, false);
  },

  'pcb.drc.getRules': async () => {
    return await eda.pcb_Drc.getCurrentRuleConfiguration();
  },

  'pcb.drc.setRules': async (params) => {
    const ruleConfiguration = params.ruleConfiguration as any;
    return await withTimeout(
      Promise.resolve(eda.pcb_Drc.overwriteCurrentRuleConfiguration(ruleConfiguration)),
      HANG_GUARD_MS,
      'pcb_set_design_rules',
    );
  },

  // ── Routing automation ───────────────────────────────────

  'pcb.document.autoRoute': async (params) => {
    const uuids = params.uuids as string[] | undefined;
    return await withTimeout(
      Promise.resolve(eda.sch_Document.autoRouting(uuids ? { uuids } : undefined)),
      HANG_GUARD_MS,
      'pcb_auto_route',
    );
  },

  'pcb.document.autoLayout': async (params) => {
    const uuids = params.uuids as string[] | undefined;
    return await withTimeout(
      Promise.resolve(eda.sch_Document.autoLayout(uuids ? { uuids } : undefined)),
      HANG_GUARD_MS,
      'pcb_auto_place',
    );
  },

  'pcb.document.clearRouting': async (params) => {
    const type = (params.type as 'all' | 'net' | 'connection' | undefined) ?? 'all';
    return await withTimeout(
      Promise.resolve(eda.pcb_Document.clearRouting(type)),
      HANG_GUARD_MS,
      'pcb_clear_routing',
    );
  },

  'pcb.document.zoomToBoardOutline': async () => {
    return await eda.pcb_Document.zoomToBoardOutline();
  },

  // ── Place operations ─────────────────────────────────────

  'pcb.primitive.placeComponent': async (params) => {
    const libraryUuid = params.libraryUuid as string | undefined;
    const uuid = params.deviceUuid as string;
    if (!libraryUuid) {
      throw new Error(
        'libraryUuid is required to place a component. Get both deviceUuid and '
        + 'libraryUuid from easyeda_lib_search_device or easyeda_lib_get_by_lcsc results.',
      );
    }
    const layer = (params.layer ?? 1) as any; // TPCB_LayersOfComponent (1 = top by default)
    const x = params.x as number;
    const y = params.y as number;
    const rotation = params.rotation as number | undefined;
    return await eda.pcb_PrimitiveComponent.create({ libraryUuid, uuid }, layer, x, y, rotation);
  },

  'pcb.primitive.placeVia': async (params) => {
    // PCB coordinates and dimensions are in mil (not mm).
    const net = (params.net as string) ?? '';
    const x = params.x as number;
    const y = params.y as number;
    const holeDiameter = (params.drill as number) ?? 12; // ~0.3mm
    const diameter = (params.diameter as number) ?? 24; // ~0.6mm
    return await eda.pcb_PrimitiveVia.create(net, x, y, holeDiameter, diameter);
  },

  'pcb.primitive.placeTrace': async (params) => {
    // PCB coordinates and dimensions are in mil (not mm).
    const points = params.points as Array<{ x: number; y: number }>;
    const layer = params.layer as any;
    const width = (params.width as number) ?? 10; // mil
    const net = (params.net as string) ?? '';
    // PCB_PrimitiveLine.create makes one segment at a time (startX, startY, endX, endY)
    const results = [];
    for (let i = 0; i < points.length - 1; i++) {
      const seg = await eda.pcb_PrimitiveLine.create(
        net, layer, points[i].x, points[i].y, points[i + 1].x, points[i + 1].y, width,
      );
      results.push(seg);
    }
    return results;
  },

  'pcb.primitive.placeText': async (params) => {
    // PCB_PrimitiveString.create is @alpha in pro-api 0.2.29 and observed to hang —
    // guarded so it fails fast instead of blocking. Dimensions are in mil.
    const layer = params.layer as any; // TPCB_LayersOfImage
    const x = params.x as number;
    const y = params.y as number;
    const text = params.text as string;
    const fontFamily = (params.fontFamily as string) ?? 'NotoSans';
    const fontSize = (params.fontSize as number) ?? 40; // mil
    const lineWidth = (params.lineWidth as number) ?? 6; // mil
    const rotation = (params.rotation as number) ?? 0;
    // alignMode 5 = CENTER (EPCB_PrimitiveStringAlignMode.CENTER)
    return await withTimeout(
      Promise.resolve(eda.pcb_PrimitiveString.create(
        layer, x, y, text, fontFamily, fontSize, lineWidth,
        5 as any, rotation, false, 0, false, false,
      )),
      HANG_GUARD_MS,
      'pcb_place_text',
    );
  },

  // ── Modify operations ────────────────────────────────────

  'pcb.primitive.modifyComponent': async (params) => {
    const primitiveId = params.primitiveId as string;
    const properties = params.properties as Record<string, unknown>;
    return await eda.pcb_PrimitiveComponent.modify(primitiveId, properties as any);
  },

  // ── Delete operations ────────────────────────────────────

  'pcb.primitive.delete': async (params) => {
    // Use the generic PCB_Primitive.delete so vias/traces/text/etc. are deleted too —
    // PCB_PrimitiveComponent.delete only handles components. (The runtime exposes
    // .delete; the bundled @jlceda/pro-api-types typings omit it, hence the cast.)
    const primitiveIds = params.primitiveIds as string[];
    return await (eda.pcb_Primitive as any).delete(primitiveIds);
  },

  // ── Selection ────────────────────────────────────────────

  'pcb.selectControl.select': async (params) => {
    const primitiveIds = params.primitiveIds as string[];
    return await eda.pcb_SelectControl.doSelectPrimitives(primitiveIds);
  },

  'pcb.selectControl.clearSelected': async () => {
    return await eda.pcb_SelectControl.clearSelected();
  },

  'pcb.selectControl.crossProbe': async (params) => {
    const components = params.components as string[] | undefined;
    const pins = params.pins as string[] | undefined;
    const nets = params.nets as string[] | undefined;
    const highlight = (params.highlight as boolean | undefined) ?? true;
    const select = (params.select as boolean | undefined) ?? true;
    return await eda.pcb_SelectControl.doCrossProbeSelect(components, pins, nets, highlight, select);
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
    const timeout = new Promise(resolve => setTimeout(() => resolve('zoom_fired'), 2000));
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

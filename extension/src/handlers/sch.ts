import type { CommandHandler } from '../handler-registry';
import { fileToBase64 } from './utils';

const handlers: Record<string, CommandHandler> = {

  // ── Document ─────────────────────────────────────────────

  'sch.document.save': async () => {
    return await eda.sch_Document.save();
  },

  // ── Read operations ──────────────────────────────────────

  'sch.primitive.getAllComponents': async (params) => {
    const allPages = params.allPages as boolean | undefined;
    const components = await eda.sch_PrimitiveComponent.getAll(undefined, allPages ?? false);
    return components;
  },

  'sch.primitive.getComponent': async (params) => {
    // sch_Primitive.getPrimitiveByPrimitiveId is an unimplemented stub in pro-api
    // 0.2.29 (empty `{}` body in api.js). Resolve the component from the working
    // sch_PrimitiveComponent.getAll() instead.
    const primitiveId = params.primitiveId as string;
    const all = await eda.sch_PrimitiveComponent.getAll(undefined, true);
    const match = (all ?? []).find((c: any) => c?.primitiveId === primitiveId);
    if (!match) {
      throw new Error(`No schematic component found with primitiveId "${primitiveId}".`);
    }
    return match;
  },

  'sch.selectControl.getSelected': async () => {
    return await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId();
  },

  'sch.document.getPrimitiveAtPoint': async () => {
    // sch_Document.getPrimitiveAtPoint is an unimplemented stub in pro-api 0.2.29
    // (empty `{}` body in api.js). No reliable fallback without primitive bounding
    // boxes — direct callers to the working region/list tools.
    throw new Error(
      'sch_Document.getPrimitiveAtPoint is not implemented in EasyEDA Pro 0.2.29. '
      + 'Use easyeda_sch_find_in_region or easyeda_sch_get_all_components instead.',
    );
  },

  'sch.document.getPrimitivesInRegion': async (params) => {
    // sch_Document.getPrimitivesInRegion is a stub (returns []) in pro-api 0.2.29.
    // Fall back to filtering components from the working getAll() by their origin.
    const left = params.left as number;
    const right = params.right as number;
    const top = params.top as number;
    const bottom = params.bottom as number;
    const loX = Math.min(left, right); const hiX = Math.max(left, right);
    const loY = Math.min(top, bottom); const hiY = Math.max(top, bottom);
    const all = await eda.sch_PrimitiveComponent.getAll(undefined, false);
    return (all ?? []).filter((c: any) =>
      typeof c?.x === 'number' && typeof c?.y === 'number'
      && c.x >= loX && c.x <= hiX && c.y >= loY && c.y <= hiY);
  },

  // ── Netlist ──────────────────────────────────────────────

  'sch.netlist.generate': async (params) => {
    const format = (params.format as string) ?? 'jlceda';
    // Map friendly format names to ESYS_NetlistType string values (pro-api 0.2.29).
    const formatMap: Record<string, string> = {
      jlceda: 'JLCEDA',
      easyeda: 'EasyEDA',
      altium: 'Protel2',
      protel: 'Protel2',
      allegro: 'Allegro',
      pads: 'PADS',
    };
    return await eda.sch_Netlist.getNetlist((formatMap[format] ?? format) as any);
  },

  // ── DRC ──────────────────────────────────────────────────

  'sch.drc.runDrc': async () => {
    // Third arg `true` returns a verbose Array of violations instead of a bare boolean.
    return await eda.sch_Drc.check(true, false, true);
  },

  // ── BOM ──────────────────────────────────────────────────

  'sch.manufactureData.getBom': async () => {
    // getBomFile returns a File object — must be base64-encoded to survive JSON transit.
    return fileToBase64(await eda.sch_ManufactureData.getBomFile());
  },

  // ── Place operations ─────────────────────────────────────

  'sch.primitive.placeComponent': async (params) => {
    const libraryUuid = params.libraryUuid as string | undefined;
    const uuid = params.deviceUuid as string;
    if (!libraryUuid) {
      throw new Error(
        'libraryUuid is required to place a component. Get both deviceUuid and '
        + 'libraryUuid from easyeda_lib_search_device or easyeda_lib_get_by_lcsc results.',
      );
    }
    const x = params.x as number;
    const y = params.y as number;
    const rotation = params.rotation as number | undefined;
    const mirror = params.mirror as boolean | undefined;
    return await eda.sch_PrimitiveComponent.create(
      { libraryUuid, uuid }, x, y, undefined, rotation, mirror,
    );
  },

  'sch.primitive.placeWire': async (params) => {
    const points = params.points as Array<{ x: number; y: number }>;
    const line = points.map(p => [p.x, p.y]).flat();
    const net = params.net as string | undefined;
    return await eda.sch_PrimitiveWire.create(line, net);
  },

  'sch.primitive.placeText': async (params) => {
    const x = params.x as number;
    const y = params.y as number;
    const content = params.text as string;
    const fontSize = params.fontSize as number | undefined;
    return await eda.sch_PrimitiveText.create(x, y, content, undefined, undefined, undefined, fontSize);
  },

  // ── Modify operations ────────────────────────────────────

  'sch.primitive.modifyComponent': async (params) => {
    const primitiveId = params.primitiveId as string;
    const properties = params.properties as Record<string, unknown>;
    return await eda.sch_PrimitiveComponent.modify(primitiveId, properties as any);
  },

  // ── Delete operations ────────────────────────────────────

  'sch.primitive.delete': async (params) => {
    // Use the generic SCH_Primitive.delete so wires/text/etc. are deleted too —
    // SCH_PrimitiveComponent.delete only handles components. (The runtime exposes
    // .delete; the bundled @jlceda/pro-api-types typings omit it, hence the cast.)
    const primitiveIds = params.primitiveIds as string[];
    return await (eda.sch_Primitive as any).delete(primitiveIds);
  },

  // ── Selection ────────────────────────────────────────────

  'sch.selectControl.select': async (params) => {
    const primitiveIds = params.primitiveIds as string[];
    return await eda.sch_SelectControl.doSelectPrimitives(primitiveIds);
  },

  'sch.selectControl.clearSelected': async () => {
    return await eda.sch_SelectControl.clearSelected();
  },
};

export default handlers;

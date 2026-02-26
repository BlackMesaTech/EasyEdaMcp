import type { CommandHandler } from '../handler-registry';

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
    const primitiveId = params.primitiveId as string;
    return await eda.sch_Primitive.getPrimitiveByPrimitiveId(primitiveId);
  },

  'sch.selectControl.getSelected': async () => {
    return await eda.sch_SelectControl.getAllSelectedPrimitives_PrimitiveId();
  },

  // ── Netlist ──────────────────────────────────────────────

  'sch.netlist.generate': async (params) => {
    const format = params.format as string ?? 'jlceda';
    // Map friendly format names to netlist method
    const formatMap: Record<string, string> = {
      jlceda: 'JLCEDA',
      easyeda: 'EasyEDA',
      altium: 'Altium',
      allegro: 'Allegro',
      pads: 'PADS',
      protel: 'Protel',
    };
    return await eda.sch_Netlist.getNetlist(formatMap[format] ?? format);
  },

  // ── DRC ──────────────────────────────────────────────────

  'sch.drc.runDrc': async () => {
    return await eda.sch_Drc.check(true, false);
  },

  // ── BOM ──────────────────────────────────────────────────

  'sch.manufactureData.getBom': async () => {
    return await eda.sch_ManufactureData.getBomFile();
  },

  // ── Place operations ─────────────────────────────────────

  'sch.primitive.placeComponent': async (params) => {
    const component = {
      libraryUuid: params.libraryUuid as string,
      uuid: params.deviceUuid as string,
    };
    return await eda.sch_PrimitiveComponent.createByMousePlacement(component);
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
    return await eda.sch_PrimitiveComponent.modify(primitiveId, properties);
  },

  // ── Delete operations ────────────────────────────────────

  'sch.primitive.delete': async (params) => {
    const primitiveIds = params.primitiveIds as string[];
    return await eda.sch_PrimitiveComponent.delete(primitiveIds);
  },

  // ── Selection ────────────────────────────────────────────

  'sch.selectControl.select': async (params) => {
    const primitiveIds = params.primitiveIds as string[];
    return await eda.sch_SelectControl.doSelectPrimitives(primitiveIds);
  },
};

export default handlers;

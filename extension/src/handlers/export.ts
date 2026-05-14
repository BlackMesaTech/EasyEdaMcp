import type { CommandHandler } from '../handler-registry';
import { fileToBase64 } from './utils';

/** Schematic-side export handlers (PCB exports live in pcb.ts via pcb_ManufactureData). */

const handlers: Record<string, CommandHandler> = {

  'sch.manufactureData.getBomFile': async () => {
    const file = await eda.sch_ManufactureData.getBomFile();
    return fileToBase64(file);
  },

  'sch.manufactureData.getNetlistFile': async () => {
    const file = await eda.sch_ManufactureData.getNetlistFile();
    return fileToBase64(file);
  },

  // Schematic PDF/PNG/SVG export goes through getExportDocumentFile in pro-api 0.2.29
  // (SCH_ManufactureData has no getPdfFile/getDxfFile — those are PCB-only).
  'sch.manufactureData.getPdfFile': async () => {
    // 'PDF' is ESCH_ExportDocumentFileType.PDF
    const file = await eda.sch_ManufactureData.getExportDocumentFile(undefined, 'PDF' as any);
    return fileToBase64(file);
  },
};

export default handlers;

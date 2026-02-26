import type { CommandHandler } from '../handler-registry';
import { fileToBase64 } from './utils';

/** Export handlers are mostly defined in the pcb.ts handler module
 *  since they come from pcb_ManufactureData. This file exists for
 *  schematic-side exports. */

const handlers: Record<string, CommandHandler> = {

  'sch.manufactureData.getBomFile': async () => {
    const file = await eda.sch_ManufactureData.getBomFile();
    return fileToBase64(file);
  },

  'sch.manufactureData.getPdfFile': async () => {
    const file = await eda.sch_ManufactureData.getPdfFile();
    return fileToBase64(file);
  },

  'sch.manufactureData.getDxfFile': async () => {
    const file = await eda.sch_ManufactureData.getDxfFile();
    return fileToBase64(file);
  },
};

export default handlers;

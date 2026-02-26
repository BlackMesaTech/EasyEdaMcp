import type { CommandHandler } from '../handler-registry';

const handlers: Record<string, CommandHandler> = {

  'lib.librariesList.getAllLibrariesList': async () => {
    return await eda.lib_LibrariesList.getAllLibrariesList();
  },

  'lib.device.search': async (params) => {
    const keyword = params.keyword as string;
    const libraryUuid = params.libraryUuid as string | undefined;
    return await eda.lib_Device.search(keyword, libraryUuid);
  },

  'lib.device.get': async (params) => {
    const deviceUuid = params.deviceUuid as string;
    return await eda.lib_Device.get(deviceUuid);
  },

  'lib.device.getByLcscIds': async (params) => {
    const lcscIds = params.lcscIds as string[];
    return await eda.lib_Device.getByLcscIds(lcscIds);
  },

  'lib.footprint.search': async (params) => {
    const keyword = params.keyword as string;
    const libraryUuid = params.libraryUuid as string | undefined;
    return await eda.lib_Footprint.search(keyword, libraryUuid);
  },

  'lib.symbol.search': async (params) => {
    const keyword = params.keyword as string;
    const libraryUuid = params.libraryUuid as string | undefined;
    return await eda.lib_Symbol.search(keyword, libraryUuid);
  },
};

export default handlers;

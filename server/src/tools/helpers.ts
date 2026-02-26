import type { WsBridge } from '../ws-bridge.js';

/** Standard wrapper: send a bridge command and format the result as MCP tool output. */
export async function bridgeTool(
  bridge: WsBridge,
  command: string,
  params: Record<string, unknown> = {},
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const result = await bridge.sendCommand(command, params);
    const text = result === undefined ? 'null' : JSON.stringify(result, null, 2);
    return {
      content: [{ type: 'text' as const, text }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text' as const, text: `Error: ${message}` }],
      isError: true,
    };
  }
}

interface FileExportResult {
  fileName?: string;
  mimeType: string;
  base64: string;
  size: number;
}

/** Wrapper for export commands that return File objects (converted to base64 by the extension). */
export async function bridgeExportTool(
  bridge: WsBridge,
  command: string,
  params: Record<string, unknown> = {},
): Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }> {
  try {
    const result = await bridge.sendCommand(command, params) as FileExportResult | null;
    if (!result || !result.base64) {
      return {
        content: [{ type: 'text' as const, text: result ? JSON.stringify(result, null, 2) : 'Export returned no data.' }],
      };
    }
    const sizeKB = (result.size / 1024).toFixed(1);
    const summary = [
      `Export successful:`,
      `  File: ${result.fileName ?? '(unnamed)'}`,
      `  Type: ${result.mimeType}`,
      `  Size: ${sizeKB} KB`,
      `  Data: base64-encoded (${result.base64.length} chars)`,
    ].join('\n');
    return {
      content: [{ type: 'text' as const, text: summary }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text' as const, text: `Error: ${message}` }],
      isError: true,
    };
  }
}

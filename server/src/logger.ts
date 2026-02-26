/**
 * Safe logging for MCP stdio servers.
 * NEVER use console.log — it corrupts the JSON-RPC transport on stdout.
 * All output goes to stderr.
 */

export function log(...args: unknown[]): void {
  console.error('[easyeda-mcp]', ...args);
}

export function warn(...args: unknown[]): void {
  console.error('[easyeda-mcp] WARN:', ...args);
}

export function error(...args: unknown[]): void {
  console.error('[easyeda-mcp] ERROR:', ...args);
}

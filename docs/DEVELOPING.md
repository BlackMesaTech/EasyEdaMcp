# Developing EasyEDA MCP

## Architecture

```
MCP client (Claude Code)
   │  stdio (JSON-RPC, newline-delimited)
   ▼
MCP Server  (server/)              Node.js, ESM
   │  WebSocket  ws://127.0.0.1:<port>   (server listens, extension connects)
   ▼
EasyEDA Extension  (extension/)    runs inside EasyEDA Pro
   │  eda.* calls
   ▼
EasyEDA Pro API  (pro-api 0.2.x)   thin RPC client → EDA backend
```

- The **MCP server** owns the WebSocket *server*. The **extension** is the WebSocket *client*
  and connects out to it (`ws://127.0.0.1:3000` by default). Only one extension connection is
  held at a time.
- Each MCP tool either (a) forwards a command string + params over the bridge to an extension
  handler, or (b) for the JLCPCB tools, makes a direct HTTPS call with no extension involved.
- The bridge protocol is request/response correlated by a `randomUUID` id, defined in
  `types.ts` (duplicated in both halves — keep them in sync).

## Repository layout

```
server/src/
  index.ts            entry point — port resolution, tool registration, graceful shutdown
  ws-bridge.ts        WebSocket server, request/response correlation, heartbeat, timeouts
  logger.ts           stderr-only logging (stdout is the MCP transport — never console.log)
  tools/*.ts          one file per tool category; each registers MCP tools
  tools/helpers.ts    bridgeTool() / bridgeExportTool() wrappers
  tools/jlcpcb.ts     direct-HTTP JLCPCB search (no bridge)
  test/smoke-test.mjs standalone MCP-protocol smoke test

extension/src/
  index.ts            activate() + connect/disconnect/status menu handlers
  bridge-client.ts    WebSocket client, handshake, request dispatch
  handler-registry.ts command → handler map
  handlers/*.ts       one file per EDA API domain; each exports a { command: handler } map
  handlers/utils.ts   fileToBase64(), withTimeout()
build/packaged.ts     zips the compiled extension into a .eext
```

## Building

```bash
# MCP server
cd server && npm install && npm run build      # tsc → server/dist/

# Extension
cd extension && npm install && npm run build   # esbuild → dist/, then packaged.ts → build/dist/*.eext
```

The extension build runs **esbuild** (no type-check) then `packaged.ts`. Run
`npx tsc --noEmit` separately to type-check the extension against the API types.

## The version-pin requirement (important)

The extension calls `eda.*` against whatever pro-api version the **installed** EasyEDA Pro
ships. `extension/package.json` must pin `@jlceda/pro-api-types` to that same version, or the
compile-time types won't match the runtime and calls will silently break (esbuild doesn't
type-check, so a mismatch is invisible until runtime).

Find the installed version:

```
C:\Program Files\easyeda-pro\resources\app\assets\pro-api\<version>\
  api-types.d.ts   ← the type definitions (the reference)
  api.js           ← the implementation (the source of truth — see below)
  extension.json   ← states the version
```

This project is pinned to **0.2.29** for EasyEDA Pro 2.2.47.7. `extension/tsconfig.json`
needs `skipLibCheck: true` because the 0.2.x types package pulls in React typings.

## Verifying which APIs actually work

`api.js` is a thin RPC client. EasyEDA frequently ships an API's *declaration* (and even a
client stub) ahead of its *implementation*. Two failure modes to check for:

1. **Empty client stub** — the method body is literally `{}` or `{return[]}` in `api.js`.
   It will never do anything. Example: `getPrimitiveAtPoint(t,i){}`.
2. **Missing backend** — the method does `extensionApiMessageBus2.rpcCall(...)` but EasyEDA
   has no handler registered for that channel, so the promise never resolves (the call hangs).

Quick check for a method:

```bash
cd "C:/Program Files/easyeda-pro/resources/app/assets/pro-api/<version>"
# implementation body:
grep -oE "<methodName>\([a-z,]*\)\{[^}]{0,120}" api.js
# stability tag (@public / @beta / @alpha):  look ~12 lines above the declaration
grep -n -B12 "    <methodName>(" api-types.d.ts | grep -E "@(public|beta|alpha)"
```

The `@public`/`@beta`/`@alpha` tag is a hint, **not** authoritative — `@public` methods have
been observed shipping as empty stubs. The `api.js` body is the truth. The current results
are recorded in [CAPABILITY-MATRIX.md](./CAPABILITY-MATRIX.md).

## Adding a new tool

A tool spans both halves and they must agree on the **command string**.

1. **Extension handler** — add `'domain.action': async (params) => { … }` to the relevant
   `extension/src/handlers/*.ts` map. Call the `eda.*` API. Verify the method against the
   installed `api.js` first (see above).
2. **Server tool** — `server.registerTool('easyeda_…', { description, inputSchema, annotations }, …)`
   in the matching `server/src/tools/*.ts`, forwarding via `bridgeTool(bridge, 'domain.action', params)`
   (or `bridgeExportTool` for File-returning commands).
3. If the underlying EasyEDA API is known to hang, wrap the extension call in
   `withTimeout(promise, HANG_GUARD_MS, 'tool_name')` so it fails fast instead of blocking
   the bridge for the full 30–120s command timeout.
4. Rebuild both halves. Re-import the `.eext` and `/mcp` reconnect to pick up changes.

## Conventions & gotchas

- **stdout is sacred** on the server side — it's the MCP JSON-RPC transport. Use
  `logger.*` (stderr) only. `console.log` corrupts the protocol.
- **Coordinate units:** schematic = 0.01-inch; PCB = mil (1 mil = 0.0254 mm). The Y axis on
  the PCB points down and the origin may be negative. Read an existing primitive's position
  to calibrate before placing anything.
- **`@public` ≠ implemented.** Always confirm against `api.js`.
- **EasyEDA runs each header-menu handler in a fresh module instance** — module-level mutable
  state set by `connect()` is invisible to a later `status()` call. `bridge-client.ts` mirrors
  connection state into `eda.sys_Storage` to work around this.
- **Zoom APIs never resolve their promises** — handlers use a `Promise.race` against a short
  timeout; the zoom action still fires.
- **Generic vs. typed delete:** use `eda.sch_Primitive.delete` / `eda.pcb_Primitive.delete`
  (generic) — the `*_PrimitiveComponent.delete` variants only remove components.
- **Long-running commands** (exports, DRC, the routing tools) are listed in
  `LONG_TIMEOUT_COMMANDS` in `ws-bridge.ts` and get a 120s bridge timeout.

## Testing

```bash
cd server && npm test          # standalone smoke test — no EasyEDA Pro needed
```

`server/test/smoke-test.mjs` spawns the built server, drives the MCP handshake over stdio,
and verifies: all 84 tools register with valid schemas, `connection_status` works, bridge
tools error cleanly when no extension is connected, JLCPCB search returns live data, and
zod input validation rejects bad input.

Full live testing of the 80 bridge tools requires EasyEDA Pro open with the `.eext` imported
and **MCP Bridge → Connect** clicked. Use a throwaway project — the mutating tools place,
modify, and delete primitives.

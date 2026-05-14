# 0.2.0

## Fixed — robustness

1. `EADDRINUSE` and other bind failures are now fatal at startup with a clear message,
   instead of being silently swallowed (which left every bridge tool failing as
   "extension not connected").
2. Reconnect race fixed — a replacement extension connection no longer gets its
   `client` reference nulled by the old socket's late `close` event.
3. Added a WebSocket heartbeat (ping/pong) to detect half-open connections.
4. `EASYEDA_WS_PORT` is validated; invalid values fall back to 3000 with a warning.
5. `maxPayload` set to 64 MB; inbound messages are shape-validated before dispatch.
6. Pending requests are rejected on shutdown; `send()` failures reject immediately.

## Fixed — tool correctness

7. JLCPCB tools: request timeout, browser `User-Agent`, non-JSON / error-code handling,
   and `limit` constrained to an integer 1–100 in the schema.
8. `jlcpcb_search_resistors` / `jlcpcb_search_capacitors` no longer seed the query with
   the literal category word (it floats placeholder "Assembly" parts to the top).
9. `easyeda_sch_run_drc` reads the verbose violation array; `easyeda_pcb_run_drc`
   validates the result shape before formatting.
10. `easyeda_sch_get_bom` routed through `bridgeExportTool` (returns the base64 file).
11. PCB tool descriptions and the coordinate helper corrected to **mil** (were "mm").
12. Tool descriptions flag EasyEDA-blocked tools and the `@alpha`/`@beta` limitations.

## Added

13. Tool annotations (`readOnlyHint` / `destructiveHint` / `idempotentHint`).
14. New tools: document/project creation, PCB component placement, net info /
    highlight / select, design-rule get/set, auto-route / auto-place / clear-routing,
    cross-probe, spatial find, zoom-to-board, close-document.
15. `engines: node >=20` in `package.json`; `npm test` smoke-test harness.

# 0.1.0

Initial MCP server — stdio transport, WebSocket bridge, and the first tool set.

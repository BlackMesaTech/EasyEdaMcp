# EasyEDA MCP

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that lets AI assistants like Claude control [EasyEDA Pro](https://pro.easyeda.com/) for PCB and schematic design. Includes an EasyEDA Pro extension that bridges the MCP server to the EDA API, plus direct JLCPCB parts search.

## Architecture

```
MCP Client <-- stdio --> MCP Server <-- WebSocket --> EasyEDA Extension <--> EasyEDA Pro API
                             |
                             +--> JLCPCB Parts API (direct HTTP, no extension needed)
```

- **MCP Client** — any MCP-compatible client (Claude Code, etc.) that launches the server over stdio
- **MCP Server** (`server/`) — Node.js server that speaks MCP over stdio and bridges commands to the EasyEDA extension via WebSocket
- **EasyEDA Extension** (`extension/`) — Runs inside EasyEDA Pro, receives commands over WebSocket and calls the EDA API

## Compatibility

Built and verified against **EasyEDA Pro 2.2.x** with **pro-api 0.2.29**. The extension
pins `@jlceda/pro-api-types@0.2.29` so the compile-time types match the runtime API.
If your EasyEDA Pro ships a different pro-api version, update that pin to match
(`extension/resources/app/assets/pro-api/<version>/` in your EasyEDA install).

## Features

**74 working tools** across 9 categories (tested live against EasyEDA Pro 2.2.47.7):

| Category | Working | Description |
|----------|---------|-------------|
| Connection | 1 | Check extension connection status |
| Project | 13 | Project/document info, open projects, create schematics/PCBs/boards, open/close documents |
| Schematic | 14 | Read/place/modify/delete components, place wires and text, find components in a region, get netlist and BOM, run DRC |
| PCB | 24 | Read/place/modify/delete components, place vias and traces, manage layers/nets, read design rules, find components in a region, run DRC, cross-probe |
| Library | 6 | Search devices/symbols/footprints, look up by LCSC part number |
| Editor | 5 | Zoom/navigate, add/remove markers, capture canvas screenshot |
| Export | 8 | Gerber, BOM, pick-and-place, 3D model, PDF, DXF, DSN, canvas image |
| JLCPCB Search | 3 | Search parts catalog, search resistors, search capacitors |

A further **10 tools are defined but currently non-functional** — 9 are blocked by
incomplete EasyEDA Pro 0.2.29 APIs and 1 is untested. They are *not* counted as features
above; see [Not Supported](#not-supported-blocked-by-easyeda-pro-0229) and
[Untested](#untested) below, and [docs/CAPABILITY-MATRIX.md](docs/CAPABILITY-MATRIX.md)
for the full breakdown.

### JLCPCB Parts Search

The JLCPCB search tools work **without** the EasyEDA extension connected — they query the JLCPCB component catalog directly. Useful for finding parts, checking stock, and comparing prices.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [EasyEDA Pro](https://pro.easyeda.com/) >= v2.2
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) or another MCP-compatible client

## Setup

### 1. Build the MCP Server

```bash
cd server
npm install
npm run build
```

### 2. Build the EasyEDA Extension

```bash
cd extension
npm install
npm run build
```

This produces a `.eext` file in `extension/build/dist/`.

### 3. Install the Extension in EasyEDA Pro

1. Open EasyEDA Pro
2. Go to **Settings → Extensions → Extensions Manager** to open the Extensions Manager dialog
3. Click **Import** and select the `.eext` file from `extension/build/dist/`
4. After it imports, tick the **External Interactions** checkbox for the extension — this
   permits the WebSocket bridge to the MCP server

> Re-importing a newer `.eext` build replaces the old one. After re-importing, restart
> EasyEDA Pro (or toggle the extension off/on) so the new code is loaded.

### 4. Register the Server With Your MCP Client

The MCP client launches the server for you — you do not run it manually. Add an stdio
server entry to your client's MCP configuration. The standard form is:

```json
{
  "mcpServers": {
    "easyeda": {
      "command": "node",
      "args": ["/absolute/path/to/EasyEDAMcp/server/dist/index.js"]
    }
  }
}
```

- The config file location is client-specific (for example, Claude Code reads a
  project-scoped `.mcp.json` — this repo already includes one pointing at
  `./server/dist/index.js`, so running Claude Code from the repo root needs no setup).
- `EASYEDA_WS_PORT` is optional (defaults to `3000`) — add it under `env` only if 3000
  is already in use.

> **Reload required:** MCP clients read their config at startup. After adding or changing
> the server entry, **restart or reload the client** so the `easyeda_*` tools appear (in
> Claude Code: run `/mcp` and approve the server, or restart the app).

### 5. Connect

1. Open your project in EasyEDA Pro
2. Click **MCP Bridge > Connect** in the top menu bar — a "Connected" toast confirms it
3. Verify from your MCP client with `easyeda_connection_status`, then start using the tools

> The JLCPCB search tools (`jlcpcb_*`) work as soon as the server is registered — they
> don't need the extension connected.

## Tool Reference

The tools below are **working** — verified live against EasyEDA Pro 2.2.47.7. ⚠️ marks a
tool that works but with a caveat or a fallback path (the caveat is noted inline). For the
tools that are *not* working, see [Untested](#untested) and
[Not Supported](#not-supported-blocked-by-easyeda-pro-0229).

### Connection
- `easyeda_connection_status` — Check if the EasyEDA extension is connected

### Project & Documents
- `easyeda_get_project_info` — Get current project info (name, schematics, PCBs, boards)
- `easyeda_get_current_document` — Get the currently focused document type and UUID
- `easyeda_open_document` — Open a document by UUID
- `easyeda_close_document` — Close a document tab by tab ID
- `easyeda_open_project` — Open an existing project by UUID
- `easyeda_create_schematic` — Create a new schematic
- `easyeda_create_pcb` — Create a new PCB
- `easyeda_create_board` — Create a new board, optionally linking a schematic and PCB
- `easyeda_get_board_info` — Get info about a board by name
- `easyeda_list_schematics` — List all schematics
- `easyeda_list_schematic_pages` — List all schematic pages
- `easyeda_list_pcbs` — List all PCBs
- `easyeda_list_boards` — List all boards

### Schematic
- `easyeda_sch_get_all_components` — Get all components on the current schematic page
- ⚠️ `easyeda_sch_get_component` — Get details of a specific component (resolved via get-all-components, since EasyEDA's native lookup is a stub)
- `easyeda_sch_get_selected` — Get currently selected primitives
- ⚠️ `easyeda_sch_find_in_region` — Find components in a rectangular region (falls back to filtering components by origin; does not return wires/text)
- `easyeda_sch_get_netlist` — Extract the netlist
- `easyeda_sch_get_bom` — Generate bill of materials
- `easyeda_sch_run_drc` — Run design rule check (returns the list of violations)
- `easyeda_sch_place_component` — Place a component from the library
- `easyeda_sch_place_wire` — Place a wire between two points
- `easyeda_sch_place_text` — Place text annotation
- `easyeda_sch_modify_component` — Modify component properties
- `easyeda_sch_delete_primitives` — Delete primitives by ID
- ⚠️ `easyeda_sch_select_primitives` — Select primitives by ID (returns true; not always reflected by get_selected)
- `easyeda_sch_clear_selection` — Clear the current selection

### PCB
- `easyeda_pcb_get_all_components` — Get all components on the current PCB
- `easyeda_pcb_get_component` — Get details of a specific component
- `easyeda_pcb_get_selected` — Get currently selected primitives
- ⚠️ `easyeda_pcb_find_in_region` — Find components in a rectangular region (falls back to filtering components by origin; does not return traces/vias/text)
- `easyeda_pcb_get_layers` — Get all PCB layers
- `easyeda_pcb_set_layer_visibility` — Show/hide layers
- `easyeda_pcb_set_copper_layers` — Set number of copper layers
- `easyeda_pcb_get_nets` — Get all net names
- `easyeda_pcb_get_net_info` — Get net detail (routed length, connected primitives)
- `easyeda_pcb_highlight_net` — Highlight a net (or clear all highlights)
- `easyeda_pcb_select_net` — Select all primitives on a net
- `easyeda_pcb_run_drc` — Run design rule check
- `easyeda_pcb_get_design_rules` — Read the current design rule configuration
- ⚠️ `easyeda_pcb_import_changes` — Import schematic changes into PCB (returns true even when EasyEDA shows an error dialog, e.g. schematic/PCB not under the same board)
- `easyeda_pcb_place_component` — Place a component/footprint from the library
- `easyeda_pcb_place_via` — Place a via
- `easyeda_pcb_place_trace` — Place a trace (series of line segments)
- `easyeda_pcb_modify_component` — Modify component properties (position, rotation, etc.)
- `easyeda_pcb_delete_primitives` — Delete primitives by ID
- `easyeda_pcb_select_primitives` — Select primitives by ID
- `easyeda_pcb_clear_selection` — Clear the current selection
- `easyeda_pcb_cross_probe` — Cross-probe select components/pins/nets (schematic↔PCB linking)
- `easyeda_pcb_navigate_to` — Navigate to specific coordinates or fit view
- `easyeda_pcb_zoom_to_board` — Zoom to fit the board outline

### Library
- ⚠️ `easyeda_lib_get_libraries` — List component libraries (returns `[]` — likely "no personal libraries"; the search tools below still work)
- `easyeda_lib_search_device` — Search for devices by keyword
- `easyeda_lib_get_device` — Get full device details
- `easyeda_lib_get_by_lcsc` — Look up a component by LCSC part number
- `easyeda_lib_search_footprint` — Search for footprints
- `easyeda_lib_search_symbol` — Search for schematic symbols

### Editor & Navigation
- `easyeda_zoom_to_all` — Zoom to fit all primitives
- `easyeda_zoom_to_selected` — Zoom to fit selected primitives
- `easyeda_zoom_to_region` — Zoom to a specific coordinate region
- `easyeda_add_markers` — Add indicator markers to the canvas
- `easyeda_remove_markers` — Remove all indicator markers

### Export & Manufacturing
- `easyeda_export_gerber` — Generate Gerber files
- `easyeda_export_bom` — Generate BOM
- `easyeda_export_pick_and_place` — Generate pick-and-place file
- `easyeda_export_3d_model` — Export 3D model (STEP/OBJ)
- `easyeda_export_pdf` — Export as PDF
- `easyeda_export_dxf` — Export as DXF
- `easyeda_export_dsn` — Export as DSN (for auto-routers)
- ⚠️ `easyeda_get_canvas_image` — Capture canvas screenshot (works on PCB; returns null on schematics)

### JLCPCB Parts Search
- `jlcpcb_search_parts` — Search the JLCPCB component catalog by keyword
- `jlcpcb_search_resistors` — Search for resistors with filters (resistance, package, tolerance)
- `jlcpcb_search_capacitors` — Search for capacitors with filters (capacitance, package, voltage)

## Untested

Defined and believed correct (the code path is verified), but **not exercised in testing**:

- `easyeda_save_document` — Save the current schematic or PCB. Not run during automated
  testing because it would persist changes to the open project. The underlying EasyEDA API
  (`sch_Document.save` / `pcb_Document.save`) is confirmed present.

## Not Supported (blocked by EasyEDA Pro 0.2.29)

These tools are registered but the EasyEDA Pro API they depend on is **not implemented in
pro-api 0.2.29** — it ships either as an empty stub function or as an RPC call with no
backend handler (the call never returns). Every one is tagged `@alpha` or `@beta` in
EasyEDA's own type definitions. The tools fail fast with a clear error and should begin
working — with no change to this project — once EasyEDA implements the backends.

| Tool | EasyEDA API (stability) | Why it's blocked |
|------|--------------------------|------------------|
| `easyeda_create_project` | `dmt_Project.createProject` (`@beta`) | Returns nothing; no project is created |
| `easyeda_create_schematic_page` | `dmt_Schematic.createSchematicPage` (`@beta`) | Throws an internal `TypeError` |
| `easyeda_sch_find_at_point` | `sch_Document.getPrimitiveAtPoint` (`@alpha`) | Ships as an empty stub — use `easyeda_sch_find_in_region` instead |
| `easyeda_pcb_find_at_point` | `pcb_Document.getPrimitiveAtPoint` (`@beta`) | RPC call with no backend handler — hangs; use `easyeda_pcb_find_in_region` instead |
| `easyeda_pcb_set_design_rules` | `pcb_Drc.overwriteCurrentRuleConfiguration` (`@beta`) | RPC call with no backend handler — hangs (even with a complete config) |
| `easyeda_pcb_auto_route` | `sch_Document.autoRouting` (`@beta`) | RPC call with no backend handler — hangs |
| `easyeda_pcb_auto_place` | `sch_Document.autoLayout` (`@beta`) | RPC call with no backend handler — hangs |
| `easyeda_pcb_clear_routing` | `pcb_Document.clearRouting` (`@alpha`) | RPC call with no backend handler — hangs |
| `easyeda_pcb_place_text` | `pcb_PrimitiveString.create` (`@alpha`) | Hangs; also requires the font to be pre-imported into EasyEDA Pro |

> **Note on `@alpha`/`@beta`:** these are EasyEDA's own stability tags from
> `api-types.d.ts`. They are a hint, not a guarantee — some `@public` methods also ship as
> stubs. See [docs/CAPABILITY-MATRIX.md](docs/CAPABILITY-MATRIX.md) for how each tool's
> status was verified against the shipped `api.js`.

## Project Structure

```
EasyEDAMcp/
  extension/                 # EasyEDA Pro extension
    src/
      index.ts               # Extension entry point, menu registration
      bridge-client.ts       # WebSocket client connecting to MCP server
      handler-registry.ts    # Command routing
      handlers/
        dmt.ts               # Project, document, editor, zoom handlers
        sch.ts               # Schematic handlers
        pcb.ts               # PCB handlers
        lib.ts               # Library search handlers
        editor.ts            # Navigation and marker handlers
        export.ts            # Schematic export handlers
        utils.ts             # File-to-base64 conversion
      types.ts               # Shared types
    extension.json           # Extension manifest
  server/                    # MCP server (Node.js)
    src/
      index.ts               # Server entry point
      ws-bridge.ts           # WebSocket bridge to extension
      logger.ts              # Stderr-only logging (safe for stdio MCP)
      tools/
        connection.ts        # Connection status tool
        project.ts           # Project and document tools
        schematic.ts         # Schematic tools
        pcb.ts               # PCB tools
        library.ts           # Library search tools
        editor.ts            # Navigation and marker tools
        export.ts            # Export and canvas image tools
        jlcpcb.ts            # JLCPCB parts search (direct HTTP)
        helpers.ts           # Bridge tool wrappers
      types.ts               # Shared types
    test/
      smoke-test.mjs         # Standalone MCP-protocol smoke test (npm test)
  docs/
    CAPABILITY-MATRIX.md     # Per-tool status vs. EasyEDA Pro 0.2.29
    DEVELOPING.md            # Architecture, build, API verification, adding tools
```

## Notes & Conventions

- Every tool was tested live against EasyEDA Pro 2.2.47.7 and cross-checked against the
  shipped `api.js`. **74 of 84 tools work today** (67 fully, 7 with the caveats noted
  inline above); 9 are blocked by incomplete EasyEDA Pro APIs and 1 is untested.
- Export tools return metadata (filename, MIME type, size, base64 length), not raw file bytes.
- Schematic export covers PDF/PNG/SVG; DXF export is PCB-only.
- `easyeda_*_get_all_components` output can exceed an MCP client's token limit on large designs.
- Coordinate units: schematic = 0.01-inch; PCB = mil (1 mil = 0.0254 mm). The PCB Y axis
  points down and the origin can be negative — read an existing primitive's position to calibrate.
- See **[docs/CAPABILITY-MATRIX.md](docs/CAPABILITY-MATRIX.md)** for the full per-tool
  status, the backing EasyEDA API for each, and re-test guidance for future EasyEDA versions.

## Documentation

- **[docs/CAPABILITY-MATRIX.md](docs/CAPABILITY-MATRIX.md)** — per-tool status, backing API, and what's blocked by EasyEDA Pro 0.2.29
- **[docs/DEVELOPING.md](docs/DEVELOPING.md)** — architecture, build, the version-pin requirement, how to verify which APIs work, how to add a tool
- **[server/CHANGELOG.md](server/CHANGELOG.md)** · **[extension/CHANGELOG.md](extension/CHANGELOG.md)** — change history
- Official EasyEDA references: [Extension API Guide](https://prodocs.easyeda.com/en/api/guide/) · [pro-api-sdk](https://github.com/easyeda/pro-api-sdk)

## License

[MIT](LICENSE)

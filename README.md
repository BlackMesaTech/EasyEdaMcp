# EasyEDA MCP

An [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server that lets AI assistants like Claude control [EasyEDA Pro](https://pro.easyeda.com/) for PCB and schematic design. Includes an EasyEDA Pro extension that bridges the MCP server to the EDA API, plus direct JLCPCB parts search.

## Architecture

```
Claude Code <-- stdio --> MCP Server <-- WebSocket --> EasyEDA Extension <--> EasyEDA Pro API
                              |
                              +--> JLCPCB Parts API (direct HTTP, no extension needed)
```

- **MCP Server** (`server/`) — Node.js server that speaks MCP over stdio and bridges commands to the EasyEDA extension via WebSocket
- **EasyEDA Extension** (`extension/`) — Runs inside EasyEDA Pro, receives commands over WebSocket and calls the EDA API

## Features

**59 tools** across 9 categories:

| Category | Tools | Description |
|----------|-------|-------------|
| Connection | 1 | Check extension connection status |
| Project | 8 | Get project info, list schematics/PCBs/boards, open/save documents |
| Schematic | 12 | Read/place/modify/delete components, place wires and text, get netlist and BOM, run DRC |
| PCB | 17 | Read/place/modify/delete components, place vias and traces, manage layers and nets, run DRC |
| Library | 6 | Search devices/symbols/footprints, look up by LCSC part number |
| Editor | 5 | Zoom/navigate, add/remove markers, capture canvas screenshot |
| Export | 8 | Gerber, BOM, pick-and-place, 3D model, PDF, DXF, DSN, canvas image |
| JLCPCB Search | 3 | Search parts catalog, search resistors, search capacitors |

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
2. Go to **Settings > Extensions > Import**
3. Select the `.eext` file from `extension/build/dist/`
4. Enable **external interaction permission** when prompted

### 4. Configure Your MCP Client

Add the server to your MCP configuration. For Claude Code, add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "easyeda": {
      "command": "node",
      "args": ["/path/to/EasyEdaMcp/server/dist/index.js"],
      "env": {
        "EASYEDA_WS_PORT": "3000"
      }
    }
  }
}
```

### 5. Connect

1. Open your project in EasyEDA Pro
2. Click **MCP Bridge > Connect** in the top menu bar
3. Start using the tools from your MCP client

## Tool Reference

### Connection
- `easyeda_connection_status` — Check if the EasyEDA extension is connected

### Project & Documents
- `easyeda_get_project_info` — Get current project info (name, schematics, PCBs, boards)
- `easyeda_get_current_document` — Get the currently focused document type and UUID
- `easyeda_open_document` — Open a document by UUID
- `easyeda_save_document` — Save the current schematic or PCB
- `easyeda_list_schematics` — List all schematics
- `easyeda_list_schematic_pages` — List all schematic pages
- `easyeda_list_pcbs` — List all PCBs
- `easyeda_list_boards` — List all boards

### Schematic
- `easyeda_sch_get_all_components` — Get all components on the current schematic page
- `easyeda_sch_get_component` — Get details of a specific component
- `easyeda_sch_get_selected` — Get currently selected primitives
- `easyeda_sch_get_netlist` — Extract the netlist
- `easyeda_sch_get_bom` — Generate bill of materials
- `easyeda_sch_run_drc` — Run design rule check
- `easyeda_sch_place_component` — Place a component from the library
- `easyeda_sch_place_wire` — Place a wire between two points
- `easyeda_sch_place_text` — Place text annotation
- `easyeda_sch_modify_component` — Modify component properties
- `easyeda_sch_delete_primitives` — Delete primitives by ID
- `easyeda_sch_select_primitives` — Select primitives by ID

### PCB
- `easyeda_pcb_get_all_components` — Get all components on the current PCB
- `easyeda_pcb_get_component` — Get details of a specific component
- `easyeda_pcb_get_selected` — Get currently selected primitives
- `easyeda_pcb_get_layers` — Get all PCB layers
- `easyeda_pcb_set_layer_visibility` — Show/hide layers
- `easyeda_pcb_set_copper_layers` — Set number of copper layers
- `easyeda_pcb_get_nets` — Get all net names
- `easyeda_pcb_run_drc` — Run design rule check
- `easyeda_pcb_import_changes` — Import schematic changes into PCB
- `easyeda_pcb_place_via` — Place a via
- `easyeda_pcb_place_trace` — Place a trace (series of line segments)
- `easyeda_pcb_place_text` — Place text on PCB
- `easyeda_pcb_modify_component` — Modify component properties (position, rotation, etc.)
- `easyeda_pcb_delete_primitives` — Delete primitives by ID
- `easyeda_pcb_select_primitives` — Select primitives by ID
- `easyeda_pcb_navigate_to` — Navigate to specific coordinates or fit view

### Library
- `easyeda_lib_get_libraries` — List available component libraries
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
- `easyeda_get_canvas_image` — Capture canvas screenshot

### JLCPCB Parts Search
- `jlcpcb_search_parts` — Search the JLCPCB component catalog by keyword
- `jlcpcb_search_resistors` — Search for resistors with filters (resistance, package, tolerance)
- `jlcpcb_search_capacitors` — Search for capacitors with filters (capacitance, package, voltage)

## Project Structure

```
EasyEdaMcp/
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
```

## Known Limitations

- PCB text placement (`easyeda_pcb_place_text`) is not available in the current EasyEDA API
- Some EasyEDA zoom API calls never resolve their promises — the extension uses timeout workarounds
- Export tools return metadata (filename, size, type) rather than raw file data
- The EasyEDA extension API is in beta and may change between versions

## License

[MIT](LICENSE)

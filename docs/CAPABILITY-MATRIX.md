# Capability Matrix

Every one of the 84 MCP tools, tested live against **EasyEDA Pro 2.2.47.7 / pro-api 0.2.29**
and cross-checked against the shipped `api.js` implementation.

## Legend

| Mark | Meaning |
|------|---------|
| ✅ | Working — verified live |
| ⚠️ | Works, with a caveat or a fallback path |
| ❌ | Blocked by EasyEDA Pro 0.2.29 itself (unimplemented API) — fails fast with a clear error |
| ⏭️ | Not exercised live (deliberate) — code path verified |

**How "blocked" was determined:** the EasyEDA `api.js` is a thin RPC client. A blocked
method is either an empty stub (`methodName(){}` / `{return[]}` in `api.js`) or it issues an
`rpcCall` to a backend handler that does not exist in 0.2.29 (the call never resolves).
Every blocked tool's underlying method is tagged `@alpha` or `@beta` in `api-types.d.ts` —
but the tag alone is not reliable (`getPrimitiveByPrimitiveId` is `@public` yet a stub), so
the `api.js` body is the source of truth.

## Summary

| Status | Count |
|--------|-------|
| ✅ Working | 67 |
| ⚠️ Works with caveat / fallback | 7 |
| ❌ Blocked by EasyEDA Pro 0.2.29 | 9 |
| ⏭️ Not run live | 1 |
| **Total** | **84** |

**74 of 84 tools are usable today** (67 fully + 7 with caveats). The 9 blocked tools
should begin working with no change to this project once EasyEDA Pro ships the missing
backend handlers.

---

## Connection (1)

| Tool | Status | EasyEDA API | Notes |
|------|--------|-------------|-------|
| `easyeda_connection_status` | ✅ | (bridge-internal) | — |

## JLCPCB Search (3) — no EasyEDA extension required

| Tool | Status | Notes |
|------|--------|-------|
| `jlcpcb_search_parts` | ✅ | Direct HTTP to the JLCPCB catalog |
| `jlcpcb_search_resistors` | ✅ | Category word kept out of the query (it poisoned ranking) |
| `jlcpcb_search_capacitors` | ✅ | Same fix as resistors |

## Project & Documents (16)

| Tool | Status | EasyEDA API | Notes |
|------|--------|-------------|-------|
| `easyeda_get_project_info` | ✅ | `dmt_Project.getCurrentProjectInfo` | |
| `easyeda_get_current_document` | ✅ | `dmt_SelectControl.getCurrentDocumentInfo` | |
| `easyeda_open_document` | ✅ | `dmt_EditorControl.openDocument` | |
| `easyeda_close_document` | ✅ | `dmt_EditorControl.closeDocument` | Needs the tab ID |
| `easyeda_save_document` | ⏭️ | `sch_Document.save` / `pcb_Document.save` | Not run live — would persist edits to the open project |
| `easyeda_open_project` | ✅ | `dmt_Project.openProject` | |
| `easyeda_create_schematic` | ✅ | `dmt_Schematic.createSchematic` | Returns the new UUID |
| `easyeda_create_pcb` | ✅ | `dmt_Pcb.createPcb` | Returns the new UUID |
| `easyeda_create_board` | ✅ | `dmt_Board.createBoard` | Returns the new board name |
| `easyeda_get_board_info` | ✅ | `dmt_Board.getBoardInfo` | Keyed by board **name** |
| `easyeda_list_schematics` | ✅ | `dmt_Schematic.getAllSchematicsInfo` | |
| `easyeda_list_schematic_pages` | ✅ | `dmt_Schematic.getAllSchematicPagesInfo` | |
| `easyeda_list_pcbs` | ✅ | `dmt_Pcb.getAllPcbsInfo` | |
| `easyeda_list_boards` | ✅ | `dmt_Board.getAllBoardsInfo` | |
| `easyeda_create_project` | ❌ | `dmt_Project.createProject` | `@beta` — returns `undefined`, creates nothing |
| `easyeda_create_schematic_page` | ❌ | `dmt_Schematic.createSchematicPage` | `@beta` — throws `TypeError: …'sheet'` internally |

## Library (6)

| Tool | Status | EasyEDA API | Notes |
|------|--------|-------------|-------|
| `easyeda_lib_search_device` | ✅ | `lib_Device.search` | |
| `easyeda_lib_get_device` | ✅ | `lib_Device.get` | |
| `easyeda_lib_get_by_lcsc` | ✅ | `lib_Device.getByLcscIds` | Returns device/symbol/footprint UUIDs |
| `easyeda_lib_search_footprint` | ✅ | `lib_Footprint.search` | |
| `easyeda_lib_search_symbol` | ✅ | `lib_Symbol.search` | |
| `easyeda_lib_get_libraries` | ⚠️ | `lib_LibrariesList.getAllLibrariesList` | Returns `[]` — likely "no personal libraries"; system libs still work via the search tools |

## Schematic (15)

Coordinates are in **0.01-inch** units. Read an existing component's position to calibrate.

| Tool | Status | EasyEDA API | Notes |
|------|--------|-------------|-------|
| `easyeda_sch_get_all_components` | ✅ | `sch_PrimitiveComponent.getAll` | Output can be large on big designs |
| `easyeda_sch_get_component` | ⚠️ | `sch_PrimitiveComponent.getAll` (filtered) | Native `getPrimitiveByPrimitiveId` is an empty stub — resolved via `getAll` instead |
| `easyeda_sch_get_selected` | ✅ | `sch_SelectControl.getAllSelectedPrimitives_PrimitiveId` | |
| `easyeda_sch_get_netlist` | ✅ | `sch_Netlist.getNetlist` | `@deprecated` upstream but functional; returns rich JSON |
| `easyeda_sch_get_bom` | ✅ | `sch_ManufactureData.getBomFile` | Returns a base64 xlsx |
| `easyeda_sch_run_drc` | ✅ | `sch_Drc.check` | Returns the violation list |
| `easyeda_sch_place_component` | ✅ | `sch_PrimitiveComponent.create` | Requires `deviceUuid` **and** `libraryUuid` |
| `easyeda_sch_place_wire` | ✅ | `sch_PrimitiveWire.create` | |
| `easyeda_sch_place_text` | ✅ | `sch_PrimitiveText.create` | The API negates the Y coordinate |
| `easyeda_sch_modify_component` | ✅ | `sch_PrimitiveComponent.modify` | Primitive ID changes form after modify |
| `easyeda_sch_delete_primitives` | ✅ | `sch_Primitive.delete` | Generic delete — handles wires/text too |
| `easyeda_sch_select_primitives` | ⚠️ | `sch_SelectControl.doSelectPrimitives` | Returns `true`; not always reflected by `get_selected` |
| `easyeda_sch_clear_selection` | ✅ | `sch_SelectControl.clearSelected` | |
| `easyeda_sch_find_in_region` | ⚠️ | `sch_PrimitiveComponent.getAll` (filtered) | Native API is a stub — falls back to filtering **components** by origin (not wires/text) |
| `easyeda_sch_find_at_point` | ❌ | `sch_Document.getPrimitiveAtPoint` | `@alpha` — empty stub. Use `find_in_region` instead |

## PCB (30)

Coordinates and dimensions are in **mil** (1 mil = 0.0254 mm). Y points down; the origin can be negative.

| Tool | Status | EasyEDA API | Notes |
|------|--------|-------------|-------|
| `easyeda_pcb_get_all_components` | ✅ | `pcb_PrimitiveComponent.getAll` | Output can be large |
| `easyeda_pcb_get_component` | ✅ | `pcb_PrimitiveComponent.get` | Includes pads + nets |
| `easyeda_pcb_get_selected` | ✅ | `pcb_SelectControl.getAllSelectedPrimitives_PrimitiveId` | |
| `easyeda_pcb_get_layers` | ✅ | `pcb_Layer.getAllLayers` | |
| `easyeda_pcb_set_layer_visibility` | ✅ | `pcb_Layer.setLayerVisible` / `setLayerInvisible` | Use numeric layer IDs |
| `easyeda_pcb_set_copper_layers` | ✅ | `pcb_Layer.setTheNumberOfCopperLayers` | |
| `easyeda_pcb_get_nets` | ✅ | `pcb_Net.getAllNetsName` | |
| `easyeda_pcb_get_net_info` | ✅ | `pcb_Net.getNet` + `getNetLength` | |
| `easyeda_pcb_highlight_net` | ✅ | `pcb_Net.highlightNet` / `unhighlightAllNets` | |
| `easyeda_pcb_select_net` | ✅ | `pcb_Net.selectNet` | |
| `easyeda_pcb_run_drc` | ✅ | `pcb_Drc.check` | Formatted violation summary |
| `easyeda_pcb_get_design_rules` | ✅ | `pcb_Drc.getCurrentRuleConfiguration` | Full rule config object |
| `easyeda_pcb_import_changes` | ⚠️ | `pcb_Document.importChanges` | Returns `true` even when EasyEDA shows an error dialog (e.g. schematic/PCB not under the same board) |
| `easyeda_pcb_place_component` | ✅ | `pcb_PrimitiveComponent.create` | Requires `deviceUuid` + `libraryUuid` |
| `easyeda_pcb_place_via` | ✅ | `pcb_PrimitiveVia.create` | Dimensions in mil |
| `easyeda_pcb_place_trace` | ✅ | `pcb_PrimitiveLine.create` | One segment per point pair |
| `easyeda_pcb_modify_component` | ✅ | `pcb_PrimitiveComponent.modify` | |
| `easyeda_pcb_delete_primitives` | ✅ | `pcb_Primitive.delete` | Generic delete — handles vias/traces too |
| `easyeda_pcb_select_primitives` | ✅ | `pcb_SelectControl.doSelectPrimitives` | |
| `easyeda_pcb_clear_selection` | ✅ | `pcb_SelectControl.clearSelected` | |
| `easyeda_pcb_cross_probe` | ✅ | `pcb_SelectControl.doCrossProbeSelect` | |
| `easyeda_pcb_navigate_to` | ✅ | `dmt_EditorControl.zoomTo*` | Uses a timeout-race (zoom APIs don't resolve) |
| `easyeda_pcb_zoom_to_board` | ✅ | `pcb_Document.zoomToBoardOutline` | |
| `easyeda_pcb_find_in_region` | ⚠️ | `pcb_PrimitiveComponent.getAll` (filtered) | Native API has no backend — falls back to filtering **components** by origin |
| `easyeda_pcb_find_at_point` | ❌ | `pcb_Document.getPrimitiveAtPoint` | `@beta` — `rpcCall` with no backend; hangs. Use `find_in_region` |
| `easyeda_pcb_set_design_rules` | ❌ | `pcb_Drc.overwriteCurrentRuleConfiguration` | `@beta` — `rpcCall` with no backend; hangs even with a complete config |
| `easyeda_pcb_auto_route` | ❌ | `sch_Document.autoRouting` | `@beta` — `rpcCall` with no backend; hangs |
| `easyeda_pcb_auto_place` | ❌ | `sch_Document.autoLayout` | `@beta` — `rpcCall` with no backend; hangs |
| `easyeda_pcb_clear_routing` | ❌ | `pcb_Document.clearRouting` | `@alpha` — `rpcCall` with no backend; hangs |
| `easyeda_pcb_place_text` | ❌ | `pcb_PrimitiveString.create` | `@alpha` — hangs; also needs the font pre-imported into EasyEDA Pro |

## Editor & Navigation (5)

| Tool | Status | EasyEDA API | Notes |
|------|--------|-------------|-------|
| `easyeda_zoom_to_all` | ✅ | `dmt_EditorControl.zoomToAllPrimitives` | Timeout-race; zoom APIs never resolve their promise |
| `easyeda_zoom_to_selected` | ✅ | `dmt_EditorControl.zoomToSelectedPrimitives` | Timeout-race |
| `easyeda_zoom_to_region` | ✅ | `dmt_EditorControl.zoomToRegion` | Timeout-race |
| `easyeda_add_markers` | ✅ | `dmt_EditorControl.generateIndicatorMarkers` | |
| `easyeda_remove_markers` | ✅ | `dmt_EditorControl.removeIndicatorMarkers` | |

## Export & Manufacturing (8)

All export tools return metadata (filename, MIME type, size, base64 length), not raw bytes.

| Tool | Status | EasyEDA API | Notes |
|------|--------|-------------|-------|
| `easyeda_export_gerber` | ✅ | `pcb_ManufactureData.getGerberFile` | |
| `easyeda_export_bom` | ✅ | `pcb_ManufactureData.getBomFile` | |
| `easyeda_export_pick_and_place` | ✅ | `pcb_ManufactureData.getPickAndPlaceFile` | |
| `easyeda_export_3d_model` | ✅ | `pcb_ManufactureData.get3DFile` | |
| `easyeda_export_pdf` | ✅ | `pcb_ManufactureData.getPdfFile` / `sch_ManufactureData.getExportDocumentFile` | Schematic side does PDF/PNG/SVG only |
| `easyeda_export_dxf` | ✅ | `pcb_ManufactureData.getDxfFile` | PCB only; filename comes back oddly named |
| `easyeda_export_dsn` | ✅ | `pcb_ManufactureData.getDsnFile` | Filename comes back as `undefined` (cosmetic) |
| `easyeda_get_canvas_image` | ⚠️ | `dmt_EditorControl.getCurrentRenderedAreaImage` | Works on PCB; returns null on schematics |

---

## Re-test guidance

When a new EasyEDA Pro version is installed, the blocked tools can be re-checked quickly:

1. Find the new pro-api version in `…\easyeda-pro\resources\app\assets\pro-api\<version>\`.
2. Grep `api.js` for the method body — if it's no longer `methodName(){}` / `{return[]}` and
   the `rpcCall` resolves, the tool works with no code change here.
3. Update the `@jlceda/pro-api-types` pin in `extension/package.json` to match.

See [DEVELOPING.md](./DEVELOPING.md) for the full verification procedure.

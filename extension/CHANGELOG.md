# 0.3.1

> Version bumped from 0.3.0 so the handshake version distinguishes this build from the
> earlier in-development 0.3.0 builds. All changes below ship in 0.3.1.

## Fixed — API alignment with installed EasyEDA Pro (pro-api 0.2.29)

The extension previously pinned `@jlceda/pro-api-types@^0.1.175`, a major version behind
the installed runtime. Re-pinned to `0.2.29` and corrected every call that drifted:

1. `sch.primitive.placeComponent` — `createByMousePlacement` (removed in 0.2.x) replaced
   with `sch_PrimitiveComponent.create(component, x, y, …)`; now requires `libraryUuid`.
2. `pcb.document.save` — now passes the required `uuid` argument.
3. `sch.manufactureData.getPdfFile` — schematic PDF export routed through
   `getExportDocumentFile` (the old `getPdfFile`/`getDxfFile` don't exist on the schematic API).
4. `sch.drc.runDrc` — added the required third `includeVerboseError` argument; now returns
   the violation list instead of a bare boolean.
5. `sch.netlist.generate` — `altium`/`protel` formats corrected to the `Protel2` enum value.
6. `dmt.board.getBoardInfo` — parameter is the board *name*, not a UUID.
7. `getCurrentRenderedAreaImage` — simplified to the `Blob | undefined` return shape.

## Fixed — bugs found during live tool testing

8. `sch.manufactureData.getBom` — base64-encodes the returned `File` (was serializing to `{}`).
9. `sch.primitive.delete` / `pcb.primitive.delete` — use the generic `*_Primitive.delete`
   so wires/vias/traces/text are deleted too (was component-only).
10. PCB dimension defaults corrected to **mil** units (vias 12/24 mil, traces 10 mil, text 40/6 mil).
11. Status menu item — connection state is mirrored into `sys_Storage`, since EasyEDA Pro
    runs each header-menu handler in a fresh module instance and the in-memory flag was invisible.

## Changed — alignment to verified EasyEDA capabilities

12. `sch.primitive.getComponent` — resolves via `sch_PrimitiveComponent.getAll()` because
    `sch_Primitive.getPrimitiveByPrimitiveId` ships as an empty stub in 0.2.29.
13. `sch.document.getPrimitivesInRegion` / `pcb.document.getPrimitivesInRegion` — fall back
    to filtering components by origin (the native APIs are stubs / have no backend handler).
14. `getPrimitiveAtPoint` (sch + pcb), `autoRoute`, `autoLayout`, `clearRouting`,
    `setRules`, `pcb placeText` — wrapped with a fail-fast timeout / explicit error so they
    no longer hang 30–120s on EasyEDA Pro 0.2.29's missing backends.

## Added

15. New handlers: document creation (`createProject`, `createSchematic`, `createSchematicPage`,
    `createPcb`, `createBoard`, `closeDocument`), PCB component placement, net info/highlight/select,
    design-rule get/set, auto-route/auto-place/clear-routing, cross-probe, zoom-to-board,
    spatial find.

## Build

16. `build/packaged.ts` — creates the `build/dist/` output directory before writing the `.eext`.

---

# 0.2.0

## Changes

1. Added WebSocket bridge client for MCP server communication
2. Added handler registry with command routing for all EDA API domains
3. Added file-to-base64 conversion for manufacturing exports
4. Added Promise.race timeout workaround for EDA zoom APIs

# 0.1.0

Initial version based on EasyEDA Pro extension SDK template.

/**
 * EasyEDA Pro MCP Bridge Extension
 *
 * Connects to a local MCP bridge server via WebSocket,
 * receives commands from Claude Code, and executes them
 * against the EasyEDA Pro API.
 */

import { HandlerRegistry } from './handler-registry';
import { BridgeClient } from './bridge-client';
import dmtHandlers from './handlers/dmt';
import schHandlers from './handlers/sch';
import pcbHandlers from './handlers/pcb';
import libHandlers from './handlers/lib';
import exportHandlers from './handlers/export';
import editorHandlers from './handlers/editor';

// Build the handler registry
const registry = new HandlerRegistry();
registry.registerModule(dmtHandlers);
registry.registerModule(schHandlers);
registry.registerModule(pcbHandlers);
registry.registerModule(libHandlers);
registry.registerModule(exportHandlers);
registry.registerModule(editorHandlers);

// Create the bridge client
const bridge = new BridgeClient(registry);

/** Called when the extension is loaded by EasyEDA Pro. */
export function activate(): void {
	eda.sys_ToastMessage.showMessage(
		`MCP Bridge loaded (${registry.size} commands). Use MCP Bridge > Connect to start.`,
		ESYS_ToastMessageType.INFO,
	);
}

/** Connect to the local MCP bridge server. */
export function connect(): void {
	bridge.connect();
}

/** Disconnect from the MCP bridge server. */
export function disconnect(): void {
	bridge.disconnect();
}

/** Show connection status. */
export function status(): void {
	bridge.showStatus();
}

import type { BridgeRequest, BridgeResponse, BridgeNotification } from './types';
import type { HandlerRegistry } from './handler-registry';

const WS_ID = 'mcp-bridge';
const DEFAULT_URI = 'ws://127.0.0.1:3000';
const CONNECTED_KEY = 'mcpBridgeConnected';

export class BridgeClient {
  private connected = false;
  private registry: HandlerRegistry;
  private uri: string;

  constructor(registry: HandlerRegistry, uri: string = DEFAULT_URI) {
    this.registry = registry;
    this.uri = uri;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  /**
   * EasyEDA Pro runs each header-menu handler in a fresh module instance, so the
   * in-memory `connected` flag set by connect() is invisible to a later status()
   * call. SYS_WebSocket exposes no state query, so we mirror the flag into
   * persistent extension storage, which IS shared across menu invocations.
   */
  private persistConnected(value: boolean): void {
    try {
      void eda.sys_Storage.setExtensionUserConfig(CONNECTED_KEY, value);
    } catch {
      // Storage is best-effort — the toast still tells the user the real outcome.
    }
  }

  private readPersistedConnected(): boolean {
    try {
      return eda.sys_Storage.getExtensionUserConfig(CONNECTED_KEY) === true;
    } catch {
      return false;
    }
  }

  connect(): void {
    if (this.connected || this.readPersistedConnected()) {
      eda.sys_ToastMessage.showMessage('Already connected to MCP server.', ESYS_ToastMessageType.WARNING);
      return;
    }

    eda.sys_ToastMessage.showMessage('Connecting to MCP server...', ESYS_ToastMessageType.INFO);

    try {
      eda.sys_WebSocket.register(
        WS_ID,
        this.uri,
        (event: MessageEvent) => { this.onMessage(event); },
        () => {
          this.connected = true;
          this.persistConnected(true);
          eda.sys_ToastMessage.showMessage('Connected to MCP server!', ESYS_ToastMessageType.INFO);

          // Send handshake notification
          this.sendNotification('extension.connected', {
            extensionVersion: '0.3.1',
            bridgeProtocolVersion: 1,
            registeredCommands: this.registry.listCommands(),
            commandCount: this.registry.size,
          });
        },
      );
    } catch (err) {
      eda.sys_ToastMessage.showMessage('Failed to connect: ' + String(err), ESYS_ToastMessageType.ERROR);
    }
  }

  disconnect(): void {
    // Read persisted state — `this.connected` may be false in a fresh module instance
    // even when a connection is live.
    if (!this.connected && !this.readPersistedConnected()) {
      eda.sys_ToastMessage.showMessage('Not connected.', ESYS_ToastMessageType.WARNING);
      return;
    }

    try {
      eda.sys_WebSocket.close(WS_ID, 1000, 'User disconnected');
      this.connected = false;
      this.persistConnected(false);
      eda.sys_ToastMessage.showMessage('Disconnected from MCP server.', ESYS_ToastMessageType.INFO);
    } catch (err) {
      eda.sys_ToastMessage.showMessage('Error disconnecting: ' + String(err), ESYS_ToastMessageType.ERROR);
    }
  }

  showStatus(): void {
    // Use persisted state — a freshly-loaded module instance has connected=false
    // even when connect() (in another instance) established a live connection.
    const connected = this.connected || this.readPersistedConnected();
    const msg = connected
      ? `Connected to MCP server at ${this.uri}\n\n${this.registry.size} commands registered.`
      : `Not connected.\n\nUse MCP Bridge > Connect to start.\n${this.registry.size} commands registered.`;
    eda.sys_Dialog.showInformationMessage(msg, 'MCP Bridge Status');
  }

  private async onMessage(event: MessageEvent): Promise<void> {
    try {
      const msg = JSON.parse(String(event.data));

      if (msg.type === 'request') {
        const response = await this.handleRequest(msg as BridgeRequest);
        eda.sys_WebSocket.send(WS_ID, JSON.stringify(response));
      }
      // Notifications from server can be handled here if needed
    } catch (err) {
      // Send error response if we can extract an ID
      try {
        const parsed = JSON.parse(String(event.data));
        if (parsed.id) {
          const errResponse: BridgeResponse = {
            type: 'response',
            id: parsed.id,
            success: false,
            error: { code: 'PARSE_ERROR', message: String(err) },
            timestamp: Date.now(),
          };
          eda.sys_WebSocket.send(WS_ID, JSON.stringify(errResponse));
        }
      } catch {
        // Can't even parse the message — nothing to do
      }
    }
  }

  private async handleRequest(req: BridgeRequest): Promise<BridgeResponse> {
    const handler = this.registry.getHandler(req.command);

    if (!handler) {
      return {
        type: 'response',
        id: req.id,
        success: false,
        error: {
          code: 'UNKNOWN_COMMAND',
          message: `No handler for command "${req.command}". ` +
            `Available: ${this.registry.listCommands().join(', ')}`,
        },
        timestamp: Date.now(),
      };
    }

    try {
      const result = await handler(req.params);
      return {
        type: 'response',
        id: req.id,
        success: true,
        result,
        timestamp: Date.now(),
      };
    } catch (err) {
      return {
        type: 'response',
        id: req.id,
        success: false,
        error: {
          code: 'API_ERROR',
          message: err instanceof Error ? err.message : String(err),
        },
        timestamp: Date.now(),
      };
    }
  }

  private sendNotification(event: string, data?: unknown): void {
    const notification: BridgeNotification = {
      type: 'notification',
      event,
      data,
      timestamp: Date.now(),
    };
    eda.sys_WebSocket.send(WS_ID, JSON.stringify(notification));
  }
}

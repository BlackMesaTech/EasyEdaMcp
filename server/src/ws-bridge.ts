import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import type { BridgeRequest, BridgeResponse, BridgeNotification } from './types.js';
import * as logger from './logger.js';

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  command: string;
}

const DEFAULT_TIMEOUT = 30_000;
const LONG_TIMEOUT = 120_000;

/** Commands that need longer timeouts (exports, DRC, etc.) */
const LONG_TIMEOUT_COMMANDS = new Set([
  'pcb.manufactureData.getGerberFile',
  'pcb.manufactureData.get3DFile',
  'pcb.manufactureData.getBomFile',
  'pcb.manufactureData.getPickAndPlaceFile',
  'pcb.manufactureData.getPdfFile',
  'pcb.manufactureData.getDxfFile',
  'pcb.manufactureData.getDsnFile',
  'pcb.manufactureData.getNetlistFile',
  'pcb.manufactureData.getOpenDatabaseDoublePlusFile',
  'pcb.manufactureData.getAltiumDesignerFile',
  'pcb.drc.runDrc',
  'sch.drc.runDrc',
  'sch.manufactureData.getBomFile',
  'dmt.editorControl.getCurrentRenderedAreaImage',
  'dmt.editorControl.zoomToAllPrimitives',
  'dmt.editorControl.zoomToSelectedPrimitives',
  'dmt.editorControl.zoomToRegion',
]);

export class WsBridge {
  private wss: WebSocketServer;
  private client: WebSocket | null = null;
  private pending: Map<string, PendingRequest> = new Map();
  private extensionInfo: Record<string, unknown> | null = null;

  constructor(port: number = 3000) {
    this.wss = new WebSocketServer({ host: '127.0.0.1', port });
    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
    this.wss.on('error', (err) => logger.error('WebSocket server error:', err.message));

    logger.log(`WebSocket bridge listening on ws://127.0.0.1:${port}`);
  }

  get isConnected(): boolean {
    return this.client !== null && this.client.readyState === WebSocket.OPEN;
  }

  getStatus(): { connected: boolean; extensionInfo: Record<string, unknown> | null } {
    return {
      connected: this.isConnected,
      extensionInfo: this.extensionInfo,
    };
  }

  /** Send a command to the extension and return a Promise for the result. */
  async sendCommand(command: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.isConnected) {
      throw new Error(
        'EasyEDA Pro extension is not connected. ' +
        'Open EasyEDA Pro, then click MCP Bridge > Connect in the top menu.'
      );
    }

    const id = randomUUID();
    const timeoutMs = LONG_TIMEOUT_COMMANDS.has(command) ? LONG_TIMEOUT : DEFAULT_TIMEOUT;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Command "${command}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer, command });

      const request: BridgeRequest = {
        type: 'request',
        id,
        command,
        params,
        timestamp: Date.now(),
      };

      this.client!.send(JSON.stringify(request));
    });
  }

  close(): void {
    if (this.client) {
      this.client.close(1000, 'Server shutting down');
    }
    this.wss.close();
  }

  private handleConnection(ws: WebSocket, req: { socket: { remoteAddress?: string } }): void {
    logger.log(`Extension connected from ${req.socket.remoteAddress}`);

    // Only one extension connection at a time
    if (this.client && this.client.readyState === WebSocket.OPEN) {
      logger.warn('Replacing existing extension connection');
      this.client.close(1000, 'New connection replacing old');
    }

    this.client = ws;

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'response') {
          this.handleResponse(msg as BridgeResponse);
        } else if (msg.type === 'notification') {
          this.handleNotification(msg as BridgeNotification);
        }
      } catch (err) {
        logger.error('Failed to parse message from extension:', err);
      }
    });

    ws.on('close', (code, reason) => {
      logger.log(`Extension disconnected: code=${code} reason=${reason.toString()}`);
      this.client = null;
      this.extensionInfo = null;

      // Reject all pending requests
      for (const [id, pending] of this.pending) {
        clearTimeout(pending.timer);
        pending.reject(new Error('EasyEDA extension disconnected'));
        this.pending.delete(id);
      }
    });

    ws.on('error', (err) => {
      logger.error('WebSocket error:', err.message);
    });
  }

  private handleResponse(msg: BridgeResponse): void {
    const pending = this.pending.get(msg.id);
    if (!pending) return; // stale or duplicate

    clearTimeout(pending.timer);
    this.pending.delete(msg.id);

    if (msg.success) {
      pending.resolve(msg.result);
    } else {
      const errMsg = msg.error
        ? `[${msg.error.code}] ${msg.error.message}`
        : 'Unknown error from extension';
      pending.reject(new Error(errMsg));
    }
  }

  private handleNotification(msg: BridgeNotification): void {
    if (msg.event === 'extension.connected') {
      this.extensionInfo = (msg.data as Record<string, unknown>) ?? null;
      logger.log('Extension handshake complete:', JSON.stringify(this.extensionInfo));
    }
  }
}

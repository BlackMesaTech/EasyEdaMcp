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

/** Max WebSocket frame size — large enough for gerber/3D exports, bounded to avoid OOM. */
const MAX_PAYLOAD = 64 * 1024 * 1024;

/** Heartbeat interval — detects half-open connections. */
const HEARTBEAT_INTERVAL = 15_000;

/** Commands that need longer timeouts (exports, DRC, auto-route, etc.) */
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
  'pcb.document.autoRoute',
  'pcb.document.autoLayout',
  'pcb.document.importChanges',
  'sch.drc.runDrc',
  'sch.manufactureData.getBomFile',
  'sch.manufactureData.getNetlistFile',
  'sch.manufactureData.getPdfFile',
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
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private clientAlive = false;

  constructor(port: number = 3000) {
    this.wss = new WebSocketServer({ host: '127.0.0.1', port, maxPayload: MAX_PAYLOAD });
    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
    this.wss.on('error', (err) => logger.error('WebSocket server error:', err.message));
  }

  /**
   * Resolves once the server is listening, rejects on bind failure (e.g. EADDRINUSE).
   * Callers MUST await this before relying on the bridge — otherwise a port conflict
   * is silently swallowed and every tool fails with "extension not connected".
   */
  waitUntilListening(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.wss.address() !== null) {
        resolve();
        return;
      }
      const onListening = () => {
        this.wss.off('error', onError);
        const addr = this.wss.address();
        const port = typeof addr === 'object' && addr ? addr.port : '?';
        logger.log(`WebSocket bridge listening on ws://127.0.0.1:${port}`);
        this.startHeartbeat();
        resolve();
      };
      const onError = (err: NodeJS.ErrnoException) => {
        this.wss.off('listening', onListening);
        if (err.code === 'EADDRINUSE') {
          reject(new Error(
            `Port is already in use — another MCP server or process is using it. ` +
            `Set EASYEDA_WS_PORT to a free port, or stop the conflicting process. (${err.message})`,
          ));
        } else {
          reject(err);
        }
      };
      this.wss.once('listening', onListening);
      this.wss.once('error', onError);
    });
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
        'Open EasyEDA Pro, then click MCP Bridge > Connect in the top menu.',
      );
    }

    const id = randomUUID();
    const timeoutMs = LONG_TIMEOUT_COMMANDS.has(command) ? LONG_TIMEOUT : DEFAULT_TIMEOUT;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(
          `Command "${command}" timed out after ${timeoutMs}ms. ` +
          `The extension may be busy or the operation may require interaction in the EasyEDA Pro window — check it.`,
        ));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer, command });

      const request: BridgeRequest = {
        type: 'request',
        id,
        command,
        params,
        timestamp: Date.now(),
      };

      this.client!.send(JSON.stringify(request), (err) => {
        if (err) {
          const pending = this.pending.get(id);
          if (pending) {
            clearTimeout(pending.timer);
            this.pending.delete(id);
            pending.reject(new Error(`Failed to send command "${command}": ${err.message}`));
          }
        }
      });
    });
  }

  close(): void {
    if (this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = null;
    }
    this.rejectAllPending('Server shutting down');
    if (this.client) {
      this.client.close(1000, 'Server shutting down');
    }
    this.wss.close();
  }

  private startHeartbeat(): void {
    this.heartbeat = setInterval(() => {
      const ws = this.client;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      if (!this.clientAlive) {
        logger.warn('Extension failed heartbeat — terminating stale connection');
        ws.terminate();
        return;
      }
      this.clientAlive = false;
      ws.ping();
    }, HEARTBEAT_INTERVAL);
  }

  private rejectAllPending(reason: string): void {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
      this.pending.delete(id);
    }
  }

  private handleConnection(ws: WebSocket, req: { socket: { remoteAddress?: string } }): void {
    logger.log(`Extension connected from ${req.socket.remoteAddress}`);

    // Only one extension connection at a time.
    if (this.client && this.client.readyState === WebSocket.OPEN) {
      logger.warn('Replacing existing extension connection');
      this.client.close(1000, 'New connection replacing old');
    }

    this.client = ws;
    this.clientAlive = true;

    ws.on('pong', () => {
      this.clientAlive = true;
    });

    ws.on('message', (data) => {
      let msg: unknown;
      try {
        msg = JSON.parse(data.toString());
      } catch (err) {
        logger.error('Failed to parse message from extension:', err);
        return;
      }
      if (typeof msg !== 'object' || msg === null) return;
      const m = msg as Record<string, unknown>;
      if (m.type === 'response' && typeof m.id === 'string') {
        this.handleResponse(m as unknown as BridgeResponse);
      } else if (m.type === 'notification' && typeof m.event === 'string') {
        this.handleNotification(m as unknown as BridgeNotification);
      }
    });

    ws.on('close', (code, reason) => {
      // Only clear state if this is still the current client — a replacement
      // connection may already have taken over.
      if (this.client === ws) {
        logger.log(`Extension disconnected: code=${code} reason=${reason.toString()}`);
        this.client = null;
        this.extensionInfo = null;
        this.rejectAllPending('EasyEDA extension disconnected');
      } else {
        logger.log(`Old extension connection closed: code=${code}`);
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
    } else {
      logger.log(`Extension notification: ${msg.event}`);
    }
  }
}

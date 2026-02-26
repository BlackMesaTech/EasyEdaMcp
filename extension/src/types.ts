/** Bridge protocol message types — shared between server and extension. */

export interface BridgeRequest {
  type: 'request';
  id: string;
  command: string;
  params: Record<string, unknown>;
  timestamp: number;
}

export interface BridgeResponse {
  type: 'response';
  id: string;
  success: boolean;
  result?: unknown;
  error?: {
    code: string;
    message: string;
  };
  timestamp: number;
}

export interface BridgeNotification {
  type: 'notification';
  event: string;
  data?: unknown;
  timestamp: number;
}

export type BridgeMessage = BridgeRequest | BridgeResponse | BridgeNotification;

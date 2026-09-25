/**
 * WebSocket signaling client for WebRTC session coordination.
 * Connects to the signaling server and exchanges SDP offers/answers
 * and ICE candidates between customer and support agent.
 */

export type SignalMessageType =
  | "join"
  | "joined"
  | "offer"
  | "answer"
  | "ice-candidate"
  | "leave"
  | "end-session";

export interface SignalMessage {
  type: SignalMessageType;
  sessionId: string;
  role: "customer" | "agent";
  data?: unknown;
}

export interface SignalingClientCallbacks {
  onMessage?: (msg: SignalMessage) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (err: Event) => void;
}

export class SignalingClient {
  private ws: WebSocket | null = null;
  private callbacks: SignalingClientCallbacks;
  private messageQueue: SignalMessage[] = [];

  constructor(callbacks: SignalingClientCallbacks = {}) {
    this.callbacks = callbacks;
  }

  connect(sessionId: string, role: "customer" | "agent"): void {
    const wsUrl =
      process.env.NEXT_PUBLIC_SIGNALING_URL ?? this.getDefaultUrl();

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      // Join the session room
      this.send({ type: "join", sessionId, role, data: undefined });
      this.callbacks.onOpen?.();

      // Flush queued messages
      while (this.messageQueue.length > 0) {
        const msg = this.messageQueue.shift()!;
        this.ws!.send(JSON.stringify(msg));
      }
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg: SignalMessage = JSON.parse(event.data);
        this.callbacks.onMessage?.(msg);
      } catch (err) {
        console.error("Signaling message parse error:", err);
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      this.callbacks.onClose?.();
    };

    this.ws.onerror = (err: Event) => {
      this.callbacks.onError?.(err);
    };
  }

  send(msg: SignalMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      this.messageQueue.push(msg);
    }
  }

  sendOffer(sessionId: string, role: "customer" | "agent", offer: RTCSessionDescription): void {
    this.send({ type: "offer", sessionId, role, data: offer });
  }

  sendAnswer(sessionId: string, role: "customer" | "agent", answer: RTCSessionDescription): void {
    this.send({ type: "answer", sessionId, role, data: answer });
  }

  sendIceCandidate(sessionId: string, role: "customer" | "agent", candidate: RTCIceCandidate): void {
    this.send({ type: "ice-candidate", sessionId, role, data: candidate });
  }

  sendLeave(sessionId: string, role: "customer" | "agent"): void {
    this.send({ type: "leave", sessionId, role });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private getDefaultUrl(): string {
    const host = typeof window !== "undefined" ? window.location.host : "localhost:3001";
    const proto = host.includes("localhost") ? "ws" : "wss";
    return `${proto}://${host}/api/support/signaling`;
  }
}

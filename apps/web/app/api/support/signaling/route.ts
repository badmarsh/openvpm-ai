/**
 * WebSocket signaling endpoint for WebRTC support sessions.
 * Handles room-based message passing between customer and agent.
 */
import { NextRequest } from "next/server";

// In-memory room tracking (for single-instance; use Redis for scale)
const rooms = new Map<string, Set<WebSocket>>();

export async function GET(req: NextRequest): Promise<Response> {
  const { headers } = req;

  // WebSocket upgrade check
  const upgrade = headers.get("upgrade")?.toLowerCase();
  if (upgrade !== "websocket") {
    return new Response("Expected WebSocket upgrade", { status: 400 });
  }

  // Note: Next.js doesn't natively support WebSocket in API routes.
  // For production, use a separate WS server or a service like Pusher/LiveKit.
  // This endpoint serves as a placeholder for the signaling URL config.
  return new Response(
    "WebSocket signaling requires a dedicated server. Use external WS server or LiveKit.",
    { status: 501 }
  );
}

/**
 * In-memory signaling implementation for development.
 * In production, replace with a dedicated WebSocket server
 * or use a managed service like LiveKit/Pusher.
 */
export interface SignalingRoom {
  peers: Map<string, { ws: WebSocket; role: string }>;
  createdAt: Date;
}

// Simple in-memory signaling for dev (single-process only)
export const devRooms = new Map<string, SignalingRoom>();

export function getOrCreateRoom(sessionId: string): SignalingRoom {
  if (!devRooms.has(sessionId)) {
    devRooms.set(sessionId, {
      peers: new Map(),
      createdAt: new Date(),
    });
  }
  return devRooms.get(sessionId)!;
}

export function broadcastToRoom(
  sessionId: string,
  message: unknown,
  senderId?: string
): void {
  const room = devRooms.get(sessionId);
  if (!room) return;

  for (const [peerId, peer] of room.peers) {
    if (peerId !== senderId && peer.ws.readyState === 1) {
      peer.ws.send(JSON.stringify(message));
    }
  }
}

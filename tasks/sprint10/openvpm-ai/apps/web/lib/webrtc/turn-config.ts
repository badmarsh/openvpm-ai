/**
 * ICE server configuration for WebRTC NAT traversal.
 * Uses Google's public STUN server + optional TURN for production.
 */

export interface TurnConfig {
  urls: string;
  username?: string;
  credential?: string;
}

export function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  // Production TURN server (optional, env-controlled)
  if (process.env.NEXT_PUBLIC_TURN_URL) {
    servers.push({
      urls: process.env.NEXT_PUBLIC_TURN_URL,
      username: process.env.NEXT_PUBLIC_TURN_USERNAME ?? "",
      credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL ?? "",
    });
  }

  return servers;
}

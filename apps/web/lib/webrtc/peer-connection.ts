/**
 * WebRTC peer connection wrapper for screen sharing.
 * Handles SDP negotiation, ICE candidates, and stream management.
 */

import { getIceServers } from "./turn-config";

export interface PeerConnectionOpts {
  initiator: boolean;
  stream?: MediaStream;
  onRemoteStream?: (stream: MediaStream) => void;
  onSignal?: (data: unknown) => void;
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
}

export function createPeerConnection({
  initiator,
  stream,
  onRemoteStream,
  onSignal,
  onIceCandidate,
}: PeerConnectionOpts): RTCPeerConnection {
  const pc = new RTCPeerConnection({
    iceServers: getIceServers(),
  });

  // Add local stream tracks if sharing
  if (stream) {
    for (const track of stream.getTracks()) {
      pc.addTrack(track);
    }
  }

  // Handle incoming remote stream
  pc.ontrack = (event) => {
    if (onRemoteStream && event.streams?.[0]) {
      onRemoteStream(event.streams[0]);
    }
  };

  // Handle ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate && onIceCandidate) {
      onIceCandidate(event.candidate);
    }
  };

  // If initiator, create offer
  if (initiator) {
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => {
        if (onSignal && pc.localDescription) {
          onSignal(pc.localDescription);
        }
      })
      .catch((err) => console.error("WebRTC createOffer failed:", err));
  }

  return pc;
}

export async function handleOffer(
  pc: RTCPeerConnection,
  offer: RTCSessionDescriptionInit
): Promise<void> {
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return;
}

export async function handleAnswer(
  pc: RTCPeerConnection,
  answer: RTCSessionDescriptionInit
): Promise<void> {
  await pc.setRemoteDescription(new RTCSessionDescription(answer));
}

export async function handleIceCandidate(
  pc: RTCPeerConnection,
  candidate: RTCIceCandidateInit
): Promise<void> {
  await pc.addIceCandidate(new RTCIceCandidate(candidate));
}

export function destroyPeerConnection(pc: RTCPeerConnection): void {
  pc.onicecandidate = null;
  pc.ontrack = null;
  pc.close();
}

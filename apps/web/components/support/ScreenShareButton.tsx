"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Monitor, StopCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createPeerConnection } from "@/lib/webrtc/peer-connection";
import { SignalingClient } from "@/lib/webrtc/signaling-client";

interface ScreenShareButtonProps {
  sessionId: string;
  role: "customer" | "agent";
  onSessionStart?: () => void;
  onSessionEnd?: () => void;
}

export function ScreenShareButton({
  sessionId,
  role,
  onSessionStart,
  onSessionEnd,
}: ScreenShareButtonProps) {
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peerConn, setPeerConn] = useState<RTCPeerConnection | null>(null);
  const [signaling, setSignaling] = useState<SignalingClient | null>(null);

  const startSharing = useCallback(async () => {
    try {
      // Request screen share permission
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      // Create peer connection
      const pc = createPeerConnection({
        initiator: true,
        stream,
        onSignal: (data) => {
          signaling?.sendOffer(sessionId, role, data as RTCSessionDescription);
        },
        onIceCandidate: (candidate) => {
          signaling?.sendIceCandidate(sessionId, role, candidate);
        },
      });

      setPeerConn(pc);
      setSharing(true);
      onSessionStart?.();

      // Handle stream end (user stops sharing via browser UI)
      stream.getVideoTracks()[0].onended = () => {
        stopSharing();
      };

      toast.success("Zdieľanie obrazovky spustené");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      toast.error("Nepodarilo sa spustiť zdieľanie obrazovky");
    }
  }, [sessionId, role, signaling, onSessionStart]);

  const stopSharing = useCallback(() => {
    if (peerConn) {
      peerConn.close();
      setPeerConn(null);
    }
    signaling?.sendLeave(sessionId, role);
    setSharing(false);
    onSessionEnd?.();
    toast.info("Zdieľanie obrazovky ukončené");
  }, [peerConn, signaling, sessionId, role, onSessionEnd]);

  if (error) {
    return (
      <div className="text-sm text-red-600 mb-2">
        Chyba: {error}
        <button
          onClick={() => setError(null)}
          className="ml-2 underline text-stone-500"
        >
          Skúsiť znova
        </button>
      </div>
    );
  }

  if (sharing) {
    return (
      <Button
        variant="destructive"
        size="sm"
        onClick={stopSharing}
        className="gap-2"
      >
        <StopCircle className="w-4 h-4" />
        Ukončiť zdieľanie
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={startSharing} className="gap-2">
      <Monitor className="w-4 h-4" />
      Zdieľať obrazovku s podporou
    </Button>
  );
}

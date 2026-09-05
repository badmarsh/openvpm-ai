"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPeerConnection, handleOffer, handleAnswer, handleIceCandidate } from "@/lib/webrtc/peer-connection";
import { SignalingClient } from "@/lib/webrtc/signaling-client";
import { Button } from "@/components/ui/button";
import { Monitor, Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface ScreenViewerProps {
  sessionId: string;
  role: "agent";
  onEnd?: () => void;
}

export function ScreenViewer({ sessionId, role, onEnd }: ScreenViewerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"connecting" | "waiting" | "viewing" | "ended">("connecting");
  const [peerConn, setPeerConn] = useState<RTCPeerConnection | null>(null);
  const [signaling, setSignaling] = useState<SignalingClient | null>(null);
  const [agentName, setAgentName] = useState<string>("");

  useEffect(() => {
    // Create signaling client
    const sig = new SignalingClient({
      onMessage: async (msg) => {
        if (!peerConn) return;

        switch (msg.type) {
          case "offer":
            await handleOffer(peerConn, msg.data as RTCSessionDescriptionInit);
            if (peerConn.localDescription) {
              sig.sendAnswer(sessionId, role, peerConn.localDescription);
            }
            break;
          case "answer":
            await handleAnswer(peerConn, msg.data as RTCSessionDescriptionInit);
            break;
          case "ice-candidate":
            await handleIceCandidate(peerConn, msg.data as RTCIceCandidateInit);
            break;
          case "leave":
            setStatus("ended");
            toast.info("Zákazník ukončil zdieľanie");
            onEnd?.();
            break;
        }
      },
      onOpen: () => {
        setStatus("waiting");
      },
      onClose: () => {
        setStatus("ended");
      },
    });

    sig.connect(sessionId, role);
    setSignaling(sig);

    // Create peer connection (non-initiator)
    const pc = createPeerConnection({
      initiator: false,
      onRemoteStream: (stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setStatus("viewing");
          toast.success("Pripojenie k obrazovke zákazníka");
        }
      },
      onSignal: (data) => {
        // For non-initiator, signals are handled via offer/answer above
      },
      onIceCandidate: (candidate) => {
        sig.sendIceCandidate(sessionId, role, candidate);
      },
    });

    setPeerConn(pc);

    return () => {
      sig.disconnect();
      pc.close();
    };
  }, [sessionId, role, onEnd]);

  const handleEndSession = useCallback(() => {
    signaling?.sendLeave(sessionId, role);
    if (peerConn) {
      peerConn.close();
    }
    setStatus("ended");
    onEnd?.();
  }, [signaling, peerConn, sessionId, role, onEnd]);

  if (status === "ended") {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-stone-500">
        <X className="w-12 h-12 mb-4" />
        <p className="text-lg font-medium">Session ukončená</p>
        <p className="text-sm mt-1">Zákazník ukončil zdieľanie obrazovky.</p>
        <Button variant="outline" size="sm" onClick={onEnd} className="mt-4">
          Zavrieť
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-stone-600" />
          <span className="text-sm font-medium">
            {status === "connecting" && "Pripájanie..."}
            {status === "waiting" && "Čaká sa na zdieľanie"}
            {status === "viewing" && "Zdieľaná obrazovka"}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleEndSession}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="relative rounded-lg border border-stone-200 bg-stone-50 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-auto block"
          style={{ display: status === "viewing" ? "block" : "none" }}
        />

        {status !== "viewing" && (
          <div className="flex flex-col items-center justify-center py-24 text-stone-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3" />
            <p className="text-sm">
              {status === "connecting" && "Pripájanie k session..."}
              {status === "waiting" && "Čaká sa, kým zákazník začne zdieľať..."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

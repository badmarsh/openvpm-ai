"use client";

import { useEffect, useState, useRef } from "react";

interface UseWhiteboardStreamOptions {
  onUpdate?: () => void;
  enabled?: boolean;
}

export function useWhiteboardStream({
  onUpdate,
  enabled = true,
}: UseWhiteboardStreamOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEventTime, setLastEventTime] = useState<Date | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connect = () => {
      try {
        eventSource = new EventSource("/api/whiteboard/stream");

        eventSource.onopen = () => {
          setIsConnected(true);
        };

        eventSource.addEventListener("connected", () => {
          setIsConnected(true);
          setLastEventTime(new Date());
        });

        eventSource.addEventListener("ping", () => {
          setLastEventTime(new Date());
          onUpdateRef.current?.();
        });

        eventSource.addEventListener("update", () => {
          setLastEventTime(new Date());
          onUpdateRef.current?.();
        });

        eventSource.onerror = () => {
          setIsConnected(false);
          eventSource?.close();
          // Attempt reconnection after 5s
          reconnectTimeout = setTimeout(connect, 5000);
        };
      } catch {
        setIsConnected(false);
        reconnectTimeout = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [enabled]);

  return { isConnected, lastEventTime };
}

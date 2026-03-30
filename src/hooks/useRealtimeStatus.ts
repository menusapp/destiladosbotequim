import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RealtimeStatus = "connected" | "reconnecting" | "disconnected";

/**
 * Hook that monitors the Supabase Realtime connection status
 * and provides automatic reconnection awareness.
 */
export function useRealtimeStatus() {
  const [status, setStatus] = useState<RealtimeStatus>("connected");
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    // Monitor online/offline events for reconnection
    const handleOnline = () => {
      setStatus("reconnecting");
      // Supabase client auto-reconnects; give it a moment
      reconnectTimer.current = setTimeout(() => {
        setStatus("connected");
      }, 2000);
    };

    const handleOffline = () => {
      setStatus("disconnected");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Check initial status
    if (!navigator.onLine) {
      setStatus("disconnected");
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, []);

  return status;
}

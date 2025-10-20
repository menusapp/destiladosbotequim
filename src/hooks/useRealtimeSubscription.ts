import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseRealtimeSubscriptionProps {
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  callback: () => void;
  enabled?: boolean;
}

export const useRealtimeSubscription = ({ 
  table, 
  event = '*', 
  callback, 
  enabled = true 
}: UseRealtimeSubscriptionProps) => {
  const memoizedCallback = useCallback(callback, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(`${table}-changes`)
      .on(
        'postgres_changes' as any,
        {
          event,
          schema: 'public',
          table,
        },
        memoizedCallback
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, event, memoizedCallback, enabled]);
};

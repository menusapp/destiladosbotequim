// Unified Realtime Hook - works with both Supabase (online) and Electron Events (offline)
import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isElectronApp, events } from '@/lib/localDB';

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface RealtimePayload {
  eventType: RealtimeEvent;
  new: any;
  old: any;
  table: string;
  schema: string;
  commit_timestamp?: string;
}

interface UseLocalRealtimeOptions {
  table: string;
  event?: RealtimeEvent;
  filter?: string; // e.g., "table_id=eq.123"
  schema?: string;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
  onChange?: (payload: RealtimePayload) => void;
}

export function useLocalRealtime({
  table,
  event = '*',
  filter,
  schema = 'public',
  onInsert,
  onUpdate,
  onDelete,
  onChange,
}: UseLocalRealtimeOptions) {
  const channelRef = useRef<any>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const handlePayload = useCallback((payload: RealtimePayload) => {
    // Apply filter if specified
    if (filter && payload.new) {
      const [field, op, value] = filter.split(/[=.]/);
      if (op === 'eq' && payload.new[field] !== value) {
        return; // Filter doesn't match
      }
    }

    // Call appropriate handler
    if (onChange) {
      onChange(payload);
    }

    switch (payload.eventType) {
      case 'INSERT':
        if (onInsert) onInsert(payload.new);
        break;
      case 'UPDATE':
        if (onUpdate) onUpdate(payload.new);
        break;
      case 'DELETE':
        if (onDelete) onDelete(payload.old);
        break;
    }
  }, [filter, onChange, onInsert, onUpdate, onDelete]);

  useEffect(() => {
    if (isElectronApp()) {
      // Electron mode - use local event system
      const unsubscribe = events.on(table, (payload: RealtimePayload) => {
        handlePayload(payload);
      });

      unsubscribeRef.current = unsubscribe;

      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }
      };
    } else {
      // Online mode - use Supabase Realtime
      const channelName = `realtime-${table}-${Date.now()}`;
      
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes' as any,
          {
            event: event as any,
            schema: schema,
            table: table,
            filter: filter,
          } as any,
          (payload: any) => {
            handlePayload({
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old,
              table: table,
              schema: schema,
              commit_timestamp: payload.commit_timestamp,
            });
          }
        )
        .subscribe();

      channelRef.current = channel;

      return () => {
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
      };
    }
  }, [table, event, filter, schema, handlePayload]);

  // Manual trigger for testing or local updates
  const emit = useCallback((eventType: RealtimeEvent, data: any) => {
    if (isElectronApp()) {
      const payload: RealtimePayload = {
        eventType,
        new: eventType !== 'DELETE' ? data : null,
        old: eventType === 'DELETE' ? data : null,
        table,
        schema,
      };
      handlePayload(payload);
    }
  }, [table, schema, handlePayload]);

  return { emit };
}

// Convenience hooks for common tables

export function useOrdersRealtime(
  restaurantId: string,
  options: {
    onInsert?: (order: any) => void;
    onUpdate?: (order: any) => void;
    onDelete?: (order: any) => void;
  }
) {
  return useLocalRealtime({
    table: 'orders',
    filter: `restaurant_id=eq.${restaurantId}`,
    ...options,
  });
}

export function useBillsRealtime(
  tableId: string,
  options: {
    onInsert?: (bill: any) => void;
    onUpdate?: (bill: any) => void;
    onDelete?: (bill: any) => void;
  }
) {
  return useLocalRealtime({
    table: 'bills',
    filter: `table_id=eq.${tableId}`,
    ...options,
  });
}

export function useTablesRealtime(
  restaurantId: string,
  options: {
    onInsert?: (table: any) => void;
    onUpdate?: (table: any) => void;
    onDelete?: (table: any) => void;
  }
) {
  return useLocalRealtime({
    table: 'tables',
    filter: `restaurant_id=eq.${restaurantId}`,
    ...options,
  });
}

export function useComandasRealtime(
  tableId: string,
  options: {
    onInsert?: (comanda: any) => void;
    onUpdate?: (comanda: any) => void;
    onDelete?: (comanda: any) => void;
  }
) {
  return useLocalRealtime({
    table: 'comandas',
    filter: `table_id=eq.${tableId}`,
    ...options,
  });
}

export function useProductsRealtime(
  restaurantId: string,
  options: {
    onInsert?: (product: any) => void;
    onUpdate?: (product: any) => void;
    onDelete?: (product: any) => void;
  }
) {
  return useLocalRealtime({
    table: 'products',
    // Products don't have restaurant_id directly, so we listen to all changes
    // The component should filter by category.restaurant_id if needed
    ...options,
  });
}

export function useRestaurantRealtime(
  restaurantId: string,
  options: {
    onUpdate?: (restaurant: any) => void;
  }
) {
  return useLocalRealtime({
    table: 'restaurants',
    filter: `id=eq.${restaurantId}`,
    event: 'UPDATE',
    ...options,
  });
}

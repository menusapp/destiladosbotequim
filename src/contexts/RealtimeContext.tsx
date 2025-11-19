import { createContext, useContext, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RealtimeContextProps {
  children: ReactNode;
  restaurantId: string;
  onOrdersChange: () => void;
  onProductsChange: () => void;
  onBillsChange: () => void;
}

const RealtimeContext = createContext<null>(null);

export const RealtimeProvider = ({ 
  children, 
  restaurantId,
  onOrdersChange,
  onProductsChange,
  onBillsChange
}: RealtimeContextProps) => {
  useEffect(() => {
    // Single unified subscription for all restaurant updates
    const channel = supabase
      .channel(`restaurant-${restaurantId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders',
        filter: `restaurant_id=eq.${restaurantId}`
      }, onOrdersChange)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'products'
      }, onProductsChange)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'bills'
      }, onBillsChange)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, onOrdersChange, onProductsChange, onBillsChange]);

  return <RealtimeContext.Provider value={null}>{children}</RealtimeContext.Provider>;
};

export const useRealtime = () => {
  const context = useContext(RealtimeContext);
  if (context === undefined) {
    throw new Error('useRealtime must be used within RealtimeProvider');
  }
  return context;
};

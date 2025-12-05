import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Bell, X } from "lucide-react";
import { Card } from "@/components/ui/card";

interface NewOrderNotificationProps {
  orderId: string;
  customerName: string;
  total: number;
  orderType: 'local' | 'delivery';
  tableNumber?: number;
  deliveryType?: 'delivery' | 'pickup';
  onView: () => void;
  onDismiss: () => void;
}

export const NewOrderNotification = ({
  orderId,
  customerName,
  total,
  orderType,
  tableNumber,
  deliveryType,
  onView,
  onDismiss,
}: NewOrderNotificationProps) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    playBeepSound();

    return () => {
      stopSound();
    };
  }, []);

  const playBeepSound = () => {
    try {
      // Create audio context
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playBeep = () => {
        if (!audioContextRef.current) return;

        const oscillator = audioContextRef.current.createOscillator();
        const gainNode = audioContextRef.current.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContextRef.current.destination);
        
        // Apito agudo - 1000Hz com onda quadrada
        oscillator.frequency.value = 1000;
        oscillator.type = 'square';
        
        // Volume moderado
        gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.2);
        
        // Bip curto de 200ms
        oscillator.start(audioContextRef.current.currentTime);
        oscillator.stop(audioContextRef.current.currentTime + 0.2);
      };

      // Toca o primeiro bip imediatamente
      playBeep();

      // Loop: bip-bip-bip (200ms on, 200ms off)
      intervalRef.current = setInterval(() => {
        playBeep();
      }, 400); // 200ms som + 200ms pausa
    } catch (error) {
      console.error("Erro ao reproduzir som:", error);
    }
  };

  const stopSound = () => {
    // Para o intervalo
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Para o oscillator se existir
    if (oscillatorRef.current) {
      try {
        oscillatorRef.current.stop();
      } catch (e) {
        // Oscillator já foi parado
      }
      oscillatorRef.current = null;
    }

    // Fecha o AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Para o gain node
    if (gainNodeRef.current) {
      gainNodeRef.current = null;
    }
  };

  const handleStopSound = () => {
    stopSound();
  };

  const handleView = () => {
    stopSound();
    onView();
  };

  const handleClose = () => {
    stopSound();
    onDismiss();
  };

  return (
    <div className="fixed top-4 right-4 z-[100] w-96 animate-in slide-in-from-top-5">
      <Card className="bg-green-50 border-green-200 shadow-2xl">
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-green-900">Novo Pedido!</h3>
                <p className="text-sm text-green-700">
                  {orderType === 'local' 
                    ? `🍽️ Pedido local - Mesa ${tableNumber || '?'}` 
                    : deliveryType === 'pickup' 
                      ? '📦 Pedido online - Retirada'
                      : '🚚 Pedido online - Entrega'
                  }
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8 text-green-700 hover:text-green-900 hover:bg-green-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-1">
            <p className="text-lg font-semibold text-green-800">
              Pedido #{orderId.slice(0, 8)}
            </p>
            <p className="text-green-700">{customerName}</p>
            <p className="text-2xl font-bold text-green-900">
              R$ {total.toFixed(2)}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleView}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              VER PEDIDO
            </Button>
            <Button
              onClick={handleStopSound}
              variant="outline"
              className="flex-1 border-green-300 text-green-700 hover:bg-green-100"
            >
              Parar Som
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

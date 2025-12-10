import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Receipt, X } from "lucide-react";
import { Card } from "@/components/ui/card";

interface NewBillNotificationProps {
  billId: string;
  tableNumber: number;
  total: number;
  onView: () => void;
  onDismiss: () => void;
}

export const NewBillNotification = ({
  billId,
  tableNumber,
  total,
  onView,
  onDismiss,
}: NewBillNotificationProps) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    playBeepSound();

    return () => {
      stopSound();
    };
  }, []);

  const playBeepSound = () => {
    try {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const playBeep = () => {
        if (!audioContextRef.current) return;

        const oscillator = audioContextRef.current.createOscillator();
        const gainNode = audioContextRef.current.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContextRef.current.destination);
        
        // Som diferenciado - 800Hz
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.25, audioContextRef.current.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.15);
        
        oscillator.start(audioContextRef.current.currentTime);
        oscillator.stop(audioContextRef.current.currentTime + 0.15);
      };

      playBeep();

      intervalRef.current = setInterval(() => {
        playBeep();
      }, 500);
    } catch (error) {
      console.error("Erro ao reproduzir som:", error);
    }
  };

  const stopSound = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
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
      <Card className="bg-amber-50 border-amber-200 shadow-2xl dark:bg-amber-950 dark:border-amber-800">
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center animate-bounce">
                <Receipt className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-amber-900 dark:text-amber-100">Conta Solicitada!</h3>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  🍽️ Mesa {tableNumber}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8 text-amber-700 hover:text-amber-900 hover:bg-amber-100 dark:text-amber-300"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-1">
            <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
              R$ {total.toFixed(2)}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleView}
              className="flex-1 bg-amber-600 hover:bg-amber-700"
            >
              VER CONTA
            </Button>
            <Button
              onClick={handleStopSound}
              variant="outline"
              className="flex-1 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300"
            >
              Parar Som
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

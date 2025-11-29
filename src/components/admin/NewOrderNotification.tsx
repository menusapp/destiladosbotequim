import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";

interface NewOrderNotificationProps {
  orderId: string;
  customerName: string;
  total: number;
  onView: () => void;
  onDismiss: () => void;
}

export const NewOrderNotification = ({
  orderId,
  customerName,
  total,
  onView,
  onDismiss,
}: NewOrderNotificationProps) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create audio context for notification sound
    if (isPlaying) {
      playNotificationSound();
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [isPlaying]);

  const playNotificationSound = () => {
    // Using Web Audio API to generate a bell-like sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const playBell = () => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    };

    // Play bell sound in loop
    const interval = setInterval(() => {
      if (isPlaying) {
        playBell();
      } else {
        clearInterval(interval);
      }
    }, 1500);

    return () => clearInterval(interval);
  };

  const handleStopSound = () => {
    setIsPlaying(false);
  };

  const handleView = () => {
    setIsPlaying(false);
    onView();
  };

  const handleClose = () => {
    setIsPlaying(false);
    onDismiss();
  };

  return (
    <Dialog open={true} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-green-50 border-green-200">
        <div className="flex flex-col items-center text-center space-y-4 py-4">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
            <Bell className="w-8 h-8 text-white" />
          </div>
          
          <div>
            <h2 className="text-2xl font-bold text-green-900 mb-2">Novo Pedido!</h2>
            <p className="text-lg font-semibold text-green-800">Pedido #{orderId.slice(0, 8)}</p>
            <p className="text-green-700">{customerName}</p>
            <p className="text-xl font-bold text-green-900 mt-2">
              R$ {total.toFixed(2)}
            </p>
          </div>

          <div className="flex gap-2 w-full">
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
      </DialogContent>
    </Dialog>
  );
};

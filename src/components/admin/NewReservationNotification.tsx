import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { CalendarCheck, X } from "lucide-react";
import { Card } from "@/components/ui/card";

interface NewReservationNotificationProps {
  reservationId: string;
  customerName: string;
  tableName: string;
  date: string;
  time: string;
  partySize: number;
  onView: () => void;
  onDismiss: () => void;
}

export const NewReservationNotification = ({
  reservationId,
  customerName,
  tableName,
  date,
  time,
  partySize,
  onView,
  onDismiss,
}: NewReservationNotificationProps) => {
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
        
        // Som diferente para reservas - frequência mais baixa
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + 0.3);
        
        oscillator.start(audioContextRef.current.currentTime);
        oscillator.stop(audioContextRef.current.currentTime + 0.3);
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

  // Formatar data para exibição
  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="fixed top-4 right-4 z-[100] w-96 animate-in slide-in-from-top-5">
      <Card className="bg-purple-50 border-purple-200 shadow-2xl">
        <div className="p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center animate-bounce">
                <CalendarCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-purple-900">Nova Reserva!</h3>
                <p className="text-sm text-purple-700">
                  📅 {formatDate(date)} às {time.slice(0, 5)}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="h-8 w-8 text-purple-700 hover:text-purple-900 hover:bg-purple-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="space-y-1">
            <p className="text-lg font-semibold text-purple-800">
              {tableName}
            </p>
            <p className="text-purple-700">{customerName}</p>
            <p className="text-sm text-purple-600">
              👥 {partySize} {partySize === 1 ? 'pessoa' : 'pessoas'}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleView}
              className="flex-1 bg-purple-600 hover:bg-purple-700"
            >
              VER RESERVA
            </Button>
            <Button
              onClick={handleStopSound}
              variant="outline"
              className="flex-1 border-purple-300 text-purple-700 hover:bg-purple-100"
            >
              Parar Som
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

import { useRealtimeStatus, type RealtimeStatus } from "@/hooks/useRealtimeStatus";
import { Wifi, WifiOff } from "lucide-react";

export function RealtimeStatusIndicator() {
  const status = useRealtimeStatus();

  if (status === "connected") {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-label" title="Conexão ativa">
        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-green-600 dark:text-green-400 font-medium hidden sm:inline">Online</span>
      </div>
    );
  }

  if (status === "reconnecting") {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 text-label" title="Reconectando...">
        <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
        <span className="text-yellow-600 dark:text-yellow-400 font-medium hidden sm:inline">Reconectando...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 text-label" title="Sem conexão">
      <WifiOff className="h-3 w-3 text-destructive" />
      <span className="text-destructive font-medium hidden sm:inline">Offline</span>
    </div>
  );
}

import { useState } from "react";
import { Copy, Clock, Moon, Sun, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";

interface AdminHeaderProps {
  restaurantId: string;
  restaurantSlug: string;
  prepTime: number;
  pickupTime: number;
  onPrepTimeUpdate: (time: number) => void;
  onPickupTimeUpdate: (time: number) => void;
}

export const AdminHeader = ({
  restaurantId,
  restaurantSlug,
  prepTime,
  pickupTime,
  onPrepTimeUpdate,
  onPickupTimeUpdate,
}: AdminHeaderProps) => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [editingPrepTime, setEditingPrepTime] = useState(false);
  const [editingPickupTime, setEditingPickupTime] = useState(false);
  const [tempPrepTime, setTempPrepTime] = useState(prepTime);
  const [tempPickupTime, setTempPickupTime] = useState(pickupTime);

  const menuUrl = `${window.location.origin}/delivery/${restaurantSlug}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(menuUrl);
    toast.success("Link copiado!");
  };

  const handleUpdatePrepTime = async () => {
    const { error } = await supabase
      .from("restaurants")
      .update({ prep_time_minutes: tempPrepTime })
      .eq("id", restaurantId);

    if (error) {
      toast.error("Erro ao atualizar tempo de espera");
      return;
    }

    onPrepTimeUpdate(tempPrepTime);
    setEditingPrepTime(false);
    toast.success("Tempo de espera atualizado!");
  };

  const handleUpdatePickupTime = async () => {
    const { error } = await supabase
      .from("restaurants")
      .update({ pickup_time_minutes: tempPickupTime })
      .eq("id", restaurantId);

    if (error) {
      toast.error("Erro ao atualizar tempo de retirada");
      return;
    }

    onPickupTimeUpdate(tempPickupTime);
    setEditingPickupTime(false);
    toast.success("Tempo de retirada atualizado!");
  };

  const handleLogout = () => {
    localStorage.removeItem('restaurant_id');
    localStorage.removeItem('restaurant_name');
    toast.success("Logout realizado com sucesso");
    navigate("/");
  };

  const userName = localStorage.getItem('restaurant_name') || 'Usuário';

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-card px-6">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <img src="/logo-menus.png" alt="Menus" className="h-8 w-8" />
        <span className="font-bold text-lg text-foreground">Menus</span>
      </div>

      {/* Link do Cardápio */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
        <span className="text-sm text-muted-foreground">Cardápio:</span>
        <a
          href={menuUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline font-medium"
        >
          {restaurantSlug}
        </a>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleCopyUrl}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Tempo de Espera */}
      <Popover open={editingPrepTime} onOpenChange={setEditingPrepTime}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="flex items-center gap-2 h-9"
            onClick={() => setTempPrepTime(prepTime)}
          >
            <Clock className="h-4 w-4" />
            <span className="text-sm">Espera: {prepTime}min</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <div className="space-y-3">
            <Label htmlFor="prep-time">Tempo de Espera (min)</Label>
            <Input
              id="prep-time"
              type="number"
              value={tempPrepTime}
              onChange={(e) => setTempPrepTime(Number(e.target.value))}
              min={1}
              max={180}
            />
            <Button onClick={handleUpdatePrepTime} className="w-full">
              Salvar
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Tempo de Retirada */}
      <Popover open={editingPickupTime} onOpenChange={setEditingPickupTime}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="flex items-center gap-2 h-9"
            onClick={() => setTempPickupTime(pickupTime)}
          >
            <Clock className="h-4 w-4" />
            <span className="text-sm">Retirada: {pickupTime}min</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <div className="space-y-3">
            <Label htmlFor="pickup-time">Tempo de Retirada (min)</Label>
            <Input
              id="pickup-time"
              type="number"
              value={tempPickupTime}
              onChange={(e) => setTempPickupTime(Number(e.target.value))}
              min={1}
              max={180}
            />
            <Button onClick={handleUpdatePickupTime} className="w-full">
              Salvar
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <div className="flex-1" />

      {/* Botão de Tema */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? (
          <Sun className="h-5 w-5" />
        ) : (
          <Moon className="h-5 w-5" />
        )}
      </Button>

      {/* Ícone de Estoque */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate("/admin#estoque")}
      >
        <Package className="h-5 w-5" />
      </Button>

      {/* Usuário Logado */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {userName.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-sm font-medium">{userName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleLogout}>Sair</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
};

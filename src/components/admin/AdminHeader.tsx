import { useState } from "react";
import { Copy, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import { RealtimeStatusIndicator } from "./RealtimeStatusIndicator";

interface AdminHeaderProps {
  restaurantId: string;
  restaurantSlug: string;
  prepTime: number;
  pickupTime: number;
  isOpen: boolean;
  autoOpenClose?: boolean;
  onPrepTimeUpdate: (time: number) => void;
  onPickupTimeUpdate: (time: number) => void;
  onIsOpenUpdate: (isOpen: boolean) => void;
}

export const AdminHeader = ({
  restaurantId,
  restaurantSlug,
  prepTime,
  pickupTime,
  isOpen,
  autoOpenClose = false,
  onPrepTimeUpdate,
  onPickupTimeUpdate,
  onIsOpenUpdate,
}: AdminHeaderProps) => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [updatingOpen, setUpdatingOpen] = useState(false);

  const handleToggleOpen = async () => {
    setUpdatingOpen(true);
    const newIsOpen = !isOpen;
    
    const { error } = await supabase
      .from("restaurants")
      .update({ is_open: newIsOpen })
      .eq("id", restaurantId);

    if (error) {
      toast.error("Erro ao atualizar status do restaurante");
      setUpdatingOpen(false);
      return;
    }

    onIsOpenUpdate(newIsOpen);
    toast.success(newIsOpen ? "Restaurante aberto!" : "Restaurante fechado!");
    setUpdatingOpen(false);
  };

  const menuUrl = `${window.location.origin}/${restaurantSlug}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(menuUrl);
    toast.success("Link copiado!");
  };

  const handleLogout = () => {
    // Clear staff session, keep restaurant session
    localStorage.removeItem('staff_id');
    localStorage.removeItem('staff_name');
    localStorage.removeItem('staff_role');
    localStorage.removeItem('staff_allowed_sections');
    toast.success("Logout realizado com sucesso");
    navigate("/login/staff");
  };

  const handleFullLogout = () => {
    localStorage.removeItem('restaurant_id');
    localStorage.removeItem('restaurant_name');
    localStorage.removeItem('staff_id');
    localStorage.removeItem('staff_name');
    localStorage.removeItem('staff_role');
    localStorage.removeItem('restaurant_slug');
    localStorage.removeItem('staff_allowed_sections');
    toast.success("Logout realizado com sucesso");
    navigate("/login");
  };

  const userName = localStorage.getItem('staff_name') || localStorage.getItem('restaurant_name') || 'Usuário';
  const staffRole = localStorage.getItem('staff_role');

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <img src="/logo-menus.png" alt="Menus" className="h-7 w-7" />
        <span className="font-semibold text-sm text-foreground">Menus</span>
      </div>

      {/* Divider */}
      <div className="h-5 w-px bg-border" />

      {/* Link do Cardápio */}
      <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-button">
        <a
          href={menuUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-label text-primary hover:underline font-medium"
        >
          {restaurantSlug}
        </a>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleCopyUrl}
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>

      {/* Prep/Pickup times compact */}
      <div className="hidden lg:flex items-center gap-2 text-label text-muted-foreground">
        <span>Espera: {prepTime}min</span>
        <span className="text-border">·</span>
        <span>Retirada: {pickupTime}min</span>
      </div>

      <div className="flex-1" />

      {/* Realtime connection status */}
      <RealtimeStatusIndicator />

      {/* Toggle Abrir/Fechar */}
      <div className="flex items-center gap-2 px-2.5 py-1 rounded-button border border-border">
        <Store className={`h-3.5 w-3.5 ${isOpen ? 'text-green-500' : 'text-destructive'}`} />
        <span className={`text-label font-medium ${isOpen ? 'text-green-500' : 'text-destructive'}`}>
          {isOpen ? 'Aberto' : 'Fechado'}
        </span>
        {autoOpenClose && (
          <span className="text-small text-muted-foreground">(Auto)</span>
        )}
        <Switch
          checked={isOpen}
          onCheckedChange={handleToggleOpen}
          disabled={updatingOpen || autoOpenClose}
          className="data-[state=checked]:bg-green-500 h-4 w-8"
        />
      </div>

      {/* Theme toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        {theme === "dark" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </Button>

      {/* User */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 h-8 px-2">
            <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-small font-medium text-primary">
                {userName.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-label font-medium hidden sm:inline">{userName}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {staffRole && <DropdownMenuItem className="text-xs text-muted-foreground" disabled>{staffRole === 'admin' ? 'Administrador' : staffRole.charAt(0).toUpperCase() + staffRole.slice(1)}</DropdownMenuItem>}
          <DropdownMenuItem onClick={handleLogout}>Trocar Conta</DropdownMenuItem>
          <DropdownMenuItem onClick={handleFullLogout}>Sair do Restaurante</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
};

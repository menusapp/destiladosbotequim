import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { LogOut } from "lucide-react";

interface RestaurantHeaderProps {
  restaurantName: string;
  isOpen: boolean;
  onToggleOpen: (isOpen: boolean) => void;
  onLogout: () => void;
}

export const RestaurantHeader = ({ 
  restaurantName, 
  isOpen, 
  onToggleOpen, 
  onLogout 
}: RestaurantHeaderProps) => {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
          {restaurantName}
        </h1>
        <p className="text-muted-foreground mt-1">Painel Administrativo</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch
            id="restaurant-status"
            checked={isOpen}
            onCheckedChange={onToggleOpen}
          />
          <Label htmlFor="restaurant-status" className="cursor-pointer">
            {isOpen ? "Aberto" : "Fechado"}
          </Label>
        </div>
        <Button onClick={onLogout} variant="outline">
          <LogOut className="h-4 w-4 mr-2" />
          Sair
        </Button>
      </div>
    </div>
  );
};

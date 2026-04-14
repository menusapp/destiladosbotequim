import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AccountSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
}

export const AccountSettingsDialog = ({ open, onOpenChange, restaurantId }: AccountSettingsDialogProps) => {
  const [username, setUsername] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    setFetching(true);
    try {
      const [credRes, restRes] = await Promise.all([
        (supabase as any).from("restaurant_credentials").select("username").eq("restaurant_id", restaurantId).limit(1).single(),
        supabase.from("restaurants").select("name").eq("id", restaurantId).single(),
      ]);
      if (credRes.data) setUsername(credRes.data.username);
      if (restRes.data) setRestaurantName(restRes.data.name);
    } catch {
      // ignore
    }
    setFetching(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Digite a senha atual para confirmar as alterações");
      return;
    }
    if (newPassword && newPassword.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("update-restaurant-credentials", {
        body: {
          restaurant_id: restaurantId,
          current_password: currentPassword,
          new_username: username || undefined,
          new_name: restaurantName || undefined,
          new_password: newPassword || undefined,
        },
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error);

      // Update localStorage
      if (restaurantName) localStorage.setItem("restaurant_name", restaurantName);

      toast.success("Dados atualizados com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar dados");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dados da Conta</DialogTitle>
        </DialogHeader>
        {fetching ? (
          <p className="text-center text-muted-foreground py-6">Carregando...</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Restaurante</Label>
              <Input value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} placeholder="Nome do restaurante" />
            </div>
            <div className="space-y-2">
              <Label>Nome de Usuário (login)</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Usuário para login" autoCapitalize="off" />
            </div>
            <hr className="border-border" />
            <div className="space-y-2">
              <Label>Senha Atual *</Label>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Obrigatória para salvar"
                  required
                />
                <button type="button" className="absolute right-3 top-2.5 text-muted-foreground" onClick={() => setShowCurrentPassword(!showCurrentPassword)}>
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Nova Senha (deixe vazio para manter)</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                />
                <button type="button" className="absolute right-3 top-2.5 text-muted-foreground" onClick={() => setShowNewPassword(!showNewPassword)}>
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

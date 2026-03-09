import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import menusLogo from "@/assets/menus-logo.png";

const StaffLogin = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const restaurantId = localStorage.getItem("restaurant_id");
  const restaurantName = localStorage.getItem("restaurant_name");

  // If no restaurant session, redirect to landing
  if (!restaurantId || !restaurantName) {
    navigate("/");
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await (supabase as any).rpc("validate_staff_credentials", {
        p_restaurant_id: restaurantId,
        p_username: username.trim(),
        p_password: password,
      });

      if (error) throw error;

      if (data && Array.isArray(data) && data.length > 0) {
        const staff = data[0];
        localStorage.setItem("staff_id", staff.staff_id);
        localStorage.setItem("staff_name", staff.display_name);
        localStorage.setItem("staff_role", staff.role);
        localStorage.setItem("staff_allowed_sections", JSON.stringify(staff.allowed_sections));
        toast.success(`Bem-vindo, ${staff.display_name}!`);
        navigate("/admin");
      } else {
        toast.error("Credenciais inválidas");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToRestaurantLogin = () => {
    localStorage.removeItem("restaurant_id");
    localStorage.removeItem("restaurant_name");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-border/50">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-24 h-24 flex items-center justify-center">
            <img src={menusLogo} alt="Menu's" className="w-full h-full object-contain" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{restaurantName}</h2>
            <CardDescription className="text-base mt-1">
              Faça login com sua conta de funcionário
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário</Label>
              <Input
                id="username"
                type="text"
                placeholder="Digite seu usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoCapitalize="off"
                autoCorrect="off"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={handleBackToRestaurantLogin}
          >
            ← Trocar restaurante
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffLogin;

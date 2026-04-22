import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import menusLogo from "@/assets/menus-logo.png";

const Landing = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const clearStaffSession = () => {
    localStorage.removeItem('staff_id');
    localStorage.removeItem('staff_name');
    localStorage.removeItem('staff_role');
    localStorage.removeItem('staff_allowed_sections');
  };

  const cacheRestaurantSlug = async (restaurantId: string) => {
    try {
      const { data } = await supabase
        .from('restaurants')
        .select('slug')
        .eq('id', restaurantId)
        .maybeSingle();

      if (data?.slug) {
        localStorage.setItem('restaurant_slug', data.slug);
      }
    } catch (error) {
      console.error('Erro ao carregar slug do restaurante:', error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await (supabase as any)
        .rpc('validate_restaurant_credentials', {
          p_username: username,
          p_password: password
        });

      if (error) throw error;

      if (data && Array.isArray(data) && data.length > 0) {
        const { restaurant_id, restaurant_name } = data[0];
        clearStaffSession();
        localStorage.removeItem('restaurant_slug');
        localStorage.setItem('restaurant_id', restaurant_id);
        localStorage.setItem('restaurant_name', restaurant_name);
        void cacheRestaurantSlug(restaurant_id);
        toast.success(`Bem-vindo ao ${restaurant_name}!`);
        navigate('/login/staff');
      } else if (username.trim().toUpperCase() === "CEO" && password === "CEO123") {
        // CEO master access - redirect to CEO user login
        localStorage.setItem('ceo_access', 'true');
        navigate('/login/ceo');
      } else {
        toast.error("Credenciais inválidas");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-border/50">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-32 h-32 flex items-center justify-center">
            <img src={menusLogo} alt="Menu's" className="w-full h-full object-contain" />
          </div>
          <CardDescription className="text-base">
            Sistema de Gestão de Cardápios Digitais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuário do Restaurante</Label>
              <Input
                id="username"
                type="text"
                placeholder="Digite o usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <PasswordInput
                id="password"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar no Painel"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Landing;

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleCEOLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (username === "gutin" && password === "gutin123") {
        // Salvar no sessionStorage que é CEO
        sessionStorage.setItem("userType", "ceo");
        sessionStorage.setItem("username", username);
        toast.success("Login como CEO realizado com sucesso!");
        navigate("/ceo");
      } else {
        toast.error("Credenciais de CEO inválidas!");
      }
    } catch (error) {
      toast.error("Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleRestaurantLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Buscar credenciais do restaurante
      const { data: credentials, error } = await supabase
        .from("restaurant_credentials")
        .select("*, restaurants(*)")
        .eq("username", username)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar credenciais:", error);
        toast.error("Erro ao fazer login");
        setLoading(false);
        return;
      }

      if (!credentials) {
        toast.error("Credenciais inválidas!");
        setLoading(false);
        return;
      }

      // Em produção, você deveria usar bcrypt para comparar senhas
      // Por agora, vamos fazer comparação simples
      if (credentials.password_hash === password) {
        sessionStorage.setItem("userType", "restaurant");
        sessionStorage.setItem("restaurantId", credentials.restaurant_id);
        sessionStorage.setItem("username", username);
        toast.success(`Bem-vindo ao ${credentials.restaurants.name}!`);
        navigate("/admin");
      } else {
        toast.error("Senha incorreta!");
      }
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      toast.error("Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <Card className="w-full max-w-md shadow-lg border-border/50">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-glow">
            <UtensilsCrossed className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Menu's
            </CardTitle>
            <CardDescription className="text-base mt-2">
              Sistema de Gestão de Cardápios Digitais
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="restaurant" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="restaurant">Restaurante</TabsTrigger>
              <TabsTrigger value="ceo">CEO</TabsTrigger>
            </TabsList>

            <TabsContent value="restaurant">
              <form onSubmit={handleRestaurantLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rest-username">Usuário</Label>
                  <Input
                    id="rest-username"
                    type="text"
                    placeholder="Digite seu usuário"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rest-password">Senha</Label>
                  <Input
                    id="rest-password"
                    type="password"
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Acessar Menu's"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="ceo">
              <form onSubmit={handleCEOLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ceo-username">Usuário CEO</Label>
                  <Input
                    id="ceo-username"
                    type="text"
                    placeholder="gutin"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ceo-password">Senha CEO</Label>
                  <Input
                    id="ceo-password"
                    type="password"
                    placeholder="gutin123"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Entrando..." : "Acessar como CEO"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;

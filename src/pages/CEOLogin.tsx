import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { supabase, applyRealtimeAuth } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { setSessionToken } from "@/lib/authSession";
import menusLogo from "@/assets/menus-logo.png";
import { Crown } from "lucide-react";

const CEOLogin = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: resp, error } = await supabase.functions.invoke("issue-session-token", {
        body: { type: "ceo", username: username.trim(), password },
      });

      if (error) throw error;
      if (resp?.error) {
        toast.error(resp.error);
        return;
      }

      if (resp?.token && resp?.data) {
        const ceoUser = resp.data;
        setSessionToken(resp.token, resp.expires_at);
        applyRealtimeAuth();
        localStorage.setItem("ceo_user_id", ceoUser.ceo_user_id);
        localStorage.setItem("ceo_display_name", ceoUser.display_name);
        toast.success(`Bem-vindo, ${ceoUser.display_name}!`);
        navigate("/ceo");
      } else {
        toast.error("Credenciais inválidas");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    localStorage.removeItem("ceo_access");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-border/50">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-24 h-24 flex items-center justify-center">
            <img src={menusLogo} alt="Menu's" className="w-full h-full object-contain rounded-lg" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            <h2 className="text-xl font-bold text-foreground">Painel CEO</h2>
          </div>
          <CardDescription className="text-base mt-1">
            Faça login com sua conta CEO
          </CardDescription>
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
              <PasswordInput
                id="password"
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
            onClick={handleBack}
          >
            ← Voltar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CEOLogin;

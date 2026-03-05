import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, Crown, Code, ArrowLeft } from "lucide-react";

type SelectedRole = "ceo" | "dev" | null;

export default function AdminPanel() {
  const [selectedRole, setSelectedRole] = useState<SelectedRole>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        redirectByRole(session.user.id);
      } else {
        setCheckingSession(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        redirectByRole(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const redirectByRole = async (userId: string) => {
    try {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      if (roles?.some(r => r.role === "dev")) {
        navigate("/admin-panel/dev", { replace: true });
      } else if (roles?.some(r => r.role === "ceo")) {
        navigate("/admin-panel/ceo", { replace: true });
      } else {
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para acessar este painel.",
          variant: "destructive",
        });
        await supabase.auth.signOut();
        setCheckingSession(false);
      }
    } catch {
      setCheckingSession(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        toast({
          title: "Erro ao entrar",
          description: error.message.includes("Invalid login") ? "Email ou senha incorretos" : error.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (data.session) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.session.user.id);

        const hasRole = roles?.some(r => r.role === selectedRole);

        if (!hasRole) {
          toast({
            title: "Acesso negado",
            description: `Você não tem acesso como ${selectedRole === "ceo" ? "CEO" : "Dev"}.`,
            variant: "destructive",
          });
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        if (selectedRole === "dev") {
          navigate("/admin-panel/dev", { replace: true });
        } else {
          navigate("/admin-panel/ceo", { replace: true });
        }
      }
    } catch {
      toast({ title: "Erro", description: "Ocorreu um erro inesperado", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/30 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <img src="/logo-menus.png" alt="Menus" className="h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground">Painel Administrativo</h1>
          <p className="text-muted-foreground text-sm mt-1">Acesso exclusivo para Dev e CEO</p>
        </div>

        {!selectedRole ? (
          <div className="grid grid-cols-2 gap-4">
            <Card
              className="cursor-pointer border-2 border-transparent hover:border-amber-500/50 transition-all hover:shadow-lg hover:shadow-amber-500/10 group"
              onClick={() => setSelectedRole("ceo")}
            >
              <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Crown className="h-8 w-8 text-white" />
                </div>
                <span className="font-bold text-lg text-foreground">Login CEO</span>
                <span className="text-xs text-muted-foreground text-center">Gestão de restaurantes e assinaturas</span>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer border-2 border-transparent hover:border-blue-500/50 transition-all hover:shadow-lg hover:shadow-blue-500/10 group"
              onClick={() => setSelectedRole("dev")}
            >
              <CardContent className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                  <Code className="h-8 w-8 text-white" />
                </div>
                <span className="font-bold text-lg text-foreground">Login Dev</span>
                <span className="text-xs text-muted-foreground text-center">Versões, configs e monitoramento</span>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="shadow-lg">
            <CardHeader className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                  selectedRole === "ceo"
                    ? "bg-gradient-to-br from-amber-400 to-amber-600"
                    : "bg-gradient-to-br from-blue-400 to-blue-600"
                }`}>
                  {selectedRole === "ceo" ? (
                    <Crown className="h-5 w-5 text-white" />
                  ) : (
                    <Code className="h-5 w-5 text-white" />
                  )}
                </div>
              </div>
              <CardTitle className="text-xl font-bold text-foreground">
                Acesso {selectedRole === "ceo" ? "CEO" : "Dev"}
              </CardTitle>
              <CardDescription>Insira suas credenciais</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entrar
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => { setSelectedRole(null); setEmail(""); setPassword(""); }}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

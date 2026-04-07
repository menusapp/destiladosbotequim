import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import menusLogo from "@/assets/menus-logo.png";

const StaffLogin = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [restaurantLogo, setRestaurantLogo] = useState<string | null>(null);

  // First-time setup state
  const [checkingStaff, setCheckingStaff] = useState(true);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newConfirmPassword, setNewConfirmPassword] = useState("");
  const [creatingOwner, setCreatingOwner] = useState(false);

  const restaurantId = localStorage.getItem("restaurant_id");
  const restaurantName = localStorage.getItem("restaurant_name");

  useEffect(() => {
    if (!restaurantId) return;

    // Load logo and check staff count in parallel
    const loadData = async () => {
      const [logoRes, hasStaffRes] = await Promise.all([
        supabase.from("restaurants").select("logo_url").eq("id", restaurantId).single(),
        supabase.rpc("admin_check_has_staff", { p_restaurant_id: restaurantId }),
      ]);

      if (logoRes.data?.logo_url) setRestaurantLogo(logoRes.data.logo_url);

      const hasStaff = hasStaffRes.data === true;
      setIsFirstTime(!hasStaff);
      setCheckingStaff(false);
    };

    loadData();
  }, [restaurantId]);

  // If no restaurant session, redirect to login
  if (!restaurantId || !restaurantName) {
    navigate("/login");
    return null;
  }

  const handleCreateOwnerAccount = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== newConfirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newUsername.trim().length < 3) {
      toast.error("O usuário deve ter pelo menos 3 caracteres");
      return;
    }
    if (newDisplayName.trim().length < 2) {
      toast.error("O nome deve ter pelo menos 2 caracteres");
      return;
    }

    setCreatingOwner(true);
    try {
      // Hash password via edge function
      const { data: hashData, error: hashError } = await supabase.functions.invoke("hash-password", {
        body: { password: newPassword },
      });

      if (hashError || !hashData?.hash) {
        throw new Error("Erro ao processar senha");
      }

      // Create owner staff account with full permissions
      const allSections = [
        "pedidos", "mesas", "cardapio", "produtos", "categorias", "complementos",
        "destaques", "estoque", "clientes", "relatorios", "fiscal", "marketing",
        "fidelidade", "integracoes", "configuracoes", "pdv", "custos", "modulos"
      ];

      const { error: insertError } = await supabase.rpc("admin_create_first_staff", {
        p_restaurant_id: restaurantId,
        p_display_name: newDisplayName.trim(),
        p_username: newUsername.trim(),
        p_password_hash: hashData.hash,
        p_role: "admin",
        p_allowed_sections: JSON.stringify(allSections),
      });

      if (insertError) {
        if (insertError.message?.includes("duplicate") || insertError.message?.includes("unique")) {
          toast.error("Este nome de usuário já está em uso");
        } else {
          throw insertError;
        }
        return;
      }

      toast.success("Conta de proprietário criada com sucesso!");
      setIsFirstTime(false);
      // Pre-fill the login form
      setUsername(newUsername.trim());
      setPassword("");
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar conta");
    } finally {
      setCreatingOwner(false);
    }
  };

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
        const slug = localStorage.getItem("restaurant_slug") || restaurantId;
        toast.success(`Bem-vindo, ${staff.display_name}!`);
        navigate(`/${slug}/admin`);
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
    localStorage.removeItem("restaurant_slug");
    navigate("/login");
  };

  if (checkingStaff) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-border/50">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-24 h-24 flex items-center justify-center">
            <img src={restaurantLogo || menusLogo} alt={restaurantName || "Menu's"} className="w-full h-full object-contain rounded-lg" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{restaurantName}</h2>
            {isFirstTime ? (
              <CardDescription className="text-base mt-1">
                <span className="flex items-center justify-center gap-1.5 text-primary font-medium">
                  <ShieldCheck className="h-4 w-4" />
                  Primeiro acesso — Crie sua conta de proprietário
                </span>
              </CardDescription>
            ) : (
              <CardDescription className="text-base mt-1">
                Faça login com sua conta de funcionário
              </CardDescription>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {isFirstTime ? (
            <form onSubmit={handleCreateOwnerAccount} className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Este é o primeiro acesso do seu restaurante. Crie as credenciais da conta do proprietário (administrador).
              </p>
              <div className="space-y-2">
                <Label htmlFor="ownerName">Seu Nome</Label>
                <Input
                  id="ownerName"
                  type="text"
                  placeholder="Ex: João Silva"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  required
                  minLength={2}
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerUsername">Usuário de Login</Label>
                <Input
                  id="ownerUsername"
                  type="text"
                  placeholder="Ex: joao"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  autoCapitalize="off"
                  autoCorrect="off"
                  required
                  minLength={3}
                  maxLength={50}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ownerPassword">Senha</Label>
                  <Input
                    id="ownerPassword"
                    type="password"
                    placeholder="••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ownerConfirm">Confirmar</Label>
                  <Input
                    id="ownerConfirm"
                    type="password"
                    placeholder="••••••"
                    value={newConfirmPassword}
                    onChange={(e) => setNewConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={creatingOwner}>
                {creatingOwner ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando conta...</>
                ) : (
                  "Criar Conta de Proprietário"
                )}
              </Button>
            </form>
          ) : (
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
          )}

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

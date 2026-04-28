import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { trackEvent } from "@/lib/metaPixel";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { Loader2, CheckCircle, Store, CreditCard } from "lucide-react";

const planDisplayMap: Record<string, { name: string; color: string }> = {
  trial: { name: "Básico (7 dias grátis)", color: "text-green-600" },
  basico: { name: "Básico", color: "text-blue-600" },
  intermediario: { name: "Intermediário", color: "text-primary" },
  avancado: { name: "Avançado", color: "text-amber-600" },
};

const isPaidPlan = (slug: string) => ["basico", "intermediario", "avancado"].includes(slug);

const RestaurantRegistration = () => {
  const { planSlug } = useParams<{ planSlug: string }>();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    slug: "",
    cnpj: "",
    phone: "",
    address: "",
    username: "",
    password: "",
    confirmPassword: "",
    adminUsername: "",
    adminPassword: "",
    adminConfirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [success, setSuccess] = useState(false);
  const [redirectingToPayment, setRedirectingToPayment] = useState(false);

  const planInfo = planDisplayMap[planSlug || ""] || { name: "Desconhecido", color: "text-muted-foreground" };

  const handleSlugChange = (value: string) => {
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 50);
    setForm((f) => ({ ...f, slug: sanitized }));
    setSlugAvailable(null);
  };

  const checkSlug = async () => {
    if (form.slug.length < 3) return;
    setSlugChecking(true);
    const { data } = await supabase
      .from("restaurants")
      .select("id")
      .eq("slug", form.slug)
      .maybeSingle();
    setSlugAvailable(!data);
    setSlugChecking(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error("As senhas do restaurante não coincidem");
      return;
    }
    if (form.password.length < 6) {
      toast.error("A senha do restaurante deve ter pelo menos 6 caracteres");
      return;
    }
    if (form.adminPassword !== form.adminConfirmPassword) {
      toast.error("As senhas da conta admin não coincidem");
      return;
    }
    if (form.adminPassword.length < 6) {
      toast.error("A senha da conta admin deve ter pelo menos 6 caracteres");
      return;
    }
    if (form.adminUsername.trim().length < 3) {
      toast.error("O usuário da conta admin deve ter pelo menos 3 caracteres");
      return;
    }
    if (form.slug.length < 3) {
      toast.error("O slug deve ter pelo menos 3 caracteres");
      return;
    }

    setLoading(true);
    try {
      const res = await supabase.functions.invoke("register-restaurant", {
        body: {
          name: form.name,
          slug: form.slug,
          cnpj: form.cnpj,
          phone: form.phone,
          address: form.address,
          username: form.username,
          password: form.password,
          adminUsername: form.adminUsername,
          adminPassword: form.adminPassword,
          planSlug,
        },
      });

      if (res.error) {
        let errorMsg = "Erro ao registrar. Tente novamente.";
        try {
          if (res.error.context && typeof res.error.context === "object") {
            const body = await (res.error.context as Response).json();
            if (body?.error) errorMsg = body.error;
          } else if (res.error.message) {
            errorMsg = res.error.message;
          }
        } catch {
          // fallback
        }
        toast.error(errorMsg);
        setLoading(false);
        return;
      }

      if (res.data?.error) {
        toast.error(res.data.error);
        setLoading(false);
        return;
      }

      // Save full session (restaurant + staff admin)
      const restaurantId = res.data?.restaurantId;
      if (restaurantId) {
        localStorage.setItem("restaurant_id", restaurantId);
        localStorage.setItem("restaurant_name", form.name.trim());
        localStorage.setItem("restaurant_slug", form.slug.trim());
        // Auto-login as admin staff
        if (res.data?.staffId) {
          localStorage.setItem("staff_id", res.data.staffId);
          localStorage.setItem("staff_name", form.adminUsername.trim());
          localStorage.setItem("staff_role", "admin");
          localStorage.setItem("staff_allowed_sections", JSON.stringify([]));
        }
      }

      // Check if there's a payment redirect (paid plans)
      if (res.data?.redirectUrl) {
        setRedirectingToPayment(true);
        toast.success("Restaurante criado! Redirecionando para pagamento...");
        setTimeout(() => {
          window.location.href = res.data.redirectUrl;
        }, 2000);
        return;
      }

      // Trial flow: go directly to admin
      setSuccess(true);
      toast.success("Restaurante cadastrado com sucesso!");
      setTimeout(() => navigate(`/${form.slug}/admin`), 3000);
    } catch {
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  if (!planSlug || !planDisplayMap[planSlug]) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <p className="text-destructive font-medium">Link de registro inválido.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>
              Voltar ao site
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (redirectingToPayment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center space-y-4">
            <CreditCard className="h-16 w-16 text-primary mx-auto animate-pulse" />
            <h2 className="text-2xl font-bold">Redirecionando para pagamento...</h2>
            <p className="text-muted-foreground">
              Seu restaurante foi criado no plano <span className={`font-semibold ${planInfo.color}`}>{planInfo.name}</span>.
            </p>
            <p className="text-sm text-muted-foreground">
              Você será redirecionado para o Mercado Pago para finalizar a assinatura.
            </p>
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">Cadastro realizado!</h2>
            <p className="text-muted-foreground">
              Seu restaurante foi criado no plano <span className={`font-semibold ${planInfo.color}`}>{planInfo.name}</span>.
            </p>
            {planSlug === "trial" && (
              <p className="text-sm font-medium text-green-600">
                Seu período gratuito termina em 7 dias.
              </p>
            )}
            <p className="text-sm text-muted-foreground">Redirecionando para o painel...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Store className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">Cadastre seu Restaurante</CardTitle>
          <CardDescription>
            Plano selecionado: <span className={`font-semibold ${planInfo.color}`}>{planInfo.name}</span>
            {isPaidPlan(planSlug || "") && (
              <span className="block text-xs mt-1 text-muted-foreground">Após o cadastro, você será redirecionado para o pagamento</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Restaurante *</Label>
              <Input
                required
                maxLength={200}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Pizzaria do João"
              />
            </div>

            <div className="space-y-2">
              <Label>Slug (URL personalizada) *</Label>
              <div className="flex gap-2">
                <Input
                  required
                  value={form.slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  onBlur={checkSlug}
                  placeholder="pizzaria-do-joao"
                />
                {slugChecking && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-2" />}
                {slugAvailable === true && <CheckCircle className="h-5 w-5 text-green-500 mt-2" />}
                {slugAvailable === false && <span className="text-xs text-destructive mt-2.5">Indisponível</span>}
              </div>
              <p className="text-xs text-muted-foreground">Seu cardápio ficará em: menusapp.com.br/<strong>{form.slug || "seu-slug"}</strong></p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input
                  value={form.cnpj}
                  onChange={(e) => setForm((f) => ({ ...f, cnpj: e.target.value }))}
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Rua, número, bairro, cidade - UF"
                maxLength={300}
              />
            </div>

            <div className="border-t pt-4 mt-2">
              <p className="text-sm font-semibold text-foreground mb-1">Credenciais do Restaurante</p>
              <p className="text-xs text-muted-foreground mb-3">Usadas para abrir/acessar o restaurante no sistema.</p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Usuário do Restaurante *</Label>
                  <Input
                    required
                    minLength={3}
                    maxLength={100}
                    value={form.username}
                    onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                    placeholder="meu-restaurante"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Senha *</Label>
                    <PasswordInput
                      required
                      minLength={6}
                      maxLength={100}
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="••••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirmar Senha *</Label>
                    <PasswordInput
                      required
                      value={form.confirmPassword}
                      onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                      placeholder="••••••"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t pt-4 mt-2">
              <p className="text-sm font-semibold text-foreground mb-1">Credenciais da Conta Admin</p>
              <p className="text-xs text-muted-foreground mb-3">Usadas para fazer login como administrador dentro do restaurante. Devem ser diferentes das credenciais acima.</p>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Usuário Admin *</Label>
                  <Input
                    required
                    minLength={3}
                    maxLength={100}
                    value={form.adminUsername}
                    onChange={(e) => setForm((f) => ({ ...f, adminUsername: e.target.value }))}
                    placeholder="admin"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Senha Admin *</Label>
                    <PasswordInput
                      required
                      minLength={6}
                      maxLength={100}
                      value={form.adminPassword}
                      onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))}
                      placeholder="••••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirmar Senha Admin *</Label>
                    <PasswordInput
                      required
                      value={form.adminConfirmPassword}
                      onChange={(e) => setForm((f) => ({ ...f, adminConfirmPassword: e.target.value }))}
                      placeholder="••••••"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full h-11 font-semibold mt-2" disabled={loading || slugAvailable === false}>
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cadastrando...</>
              ) : isPaidPlan(planSlug || "") ? (
                "Cadastrar e ir para pagamento"
              ) : (
                "Criar meu Restaurante"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default RestaurantRegistration;

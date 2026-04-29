import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { z } from "zod";
import { trackEvent } from "@/lib/metaPixel";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import {
  Loader2, CheckCircle, CreditCard, Check,
  Utensils, Sandwich, Pizza, Beer, Salad, IceCream, Coffee, Store,
  ArrowRight, ArrowLeft,
} from "lucide-react";
import menusLogo from "@/assets/menus-logo.png";

/* ────────────────────────────────────────────────────────────
   Constants
   ──────────────────────────────────────────────────────────── */

const STEPS = [
  { id: 1, label: "Negócio" },
  { id: 2, label: "Localização" },
  { id: 3, label: "Acesso" },
  { id: 4, label: "Plano" },
] as const;

const ESTABLISHMENT_TYPES = [
  { id: "restaurante", label: "Restaurante", icon: Utensils },
  { id: "hamburgueria", label: "Hamburgueria", icon: Sandwich },
  { id: "pizzaria", label: "Pizzaria", icon: Pizza },
  { id: "bar", label: "Bar", icon: Beer },
  { id: "marmitaria", label: "Marmitaria", icon: Salad },
  { id: "sorveteria", label: "Sorveteria", icon: IceCream },
  { id: "cafeteria", label: "Cafeteria", icon: Coffee },
  { id: "outro", label: "Outro", icon: Store },
] as const;

type PlanSlug = "basico" | "intermediario" | "avancado" | "trial";

const PLAN_OPTIONS: { slug: Exclude<PlanSlug, "trial">; name: string; price: string; daily: string; description: string; highlighted: boolean; features: string[] }[] = [
  {
    slug: "basico", name: "Básico", price: "69,90", daily: "R$ 2,33/dia",
    description: "Para começar a digitalizar", highlighted: false,
    features: ["Cardápio digital ilimitado", "QR Code para mesas", "Pedidos em tempo real", "1 usuário admin"],
  },
  {
    slug: "intermediario", name: "Intermediário", price: "149,90", daily: "R$ 5,00/dia",
    description: "Para crescer com eficiência", highlighted: false,
    features: ["Tudo do Básico", "Delivery completo", "Estoque & CMV", "Relatórios e DRE", "Até 5 usuários"],
  },
  {
    slug: "avancado", name: "Avançado", price: "249,90", daily: "R$ 8,33/dia",
    description: "Solução completa", highlighted: true,
    features: ["Tudo do Intermediário", "Robô IA Vendedor", "Marketing WhatsApp", "Nota fiscal eletrônica", "Usuários ilimitados"],
  },
];

const planDisplayMap: Record<string, { name: string; color: string }> = {
  trial: { name: "Básico (7 dias grátis)", color: "text-green-600" },
  basico: { name: "Básico", color: "text-blue-600" },
  intermediario: { name: "Intermediário", color: "text-primary" },
  avancado: { name: "Avançado", color: "text-amber-600" },
};

const isPaidPlan = (slug: string) => ["basico", "intermediario", "avancado"].includes(slug);

/* ────────────────────────────────────────────────────────────
   Masks / helpers
   ──────────────────────────────────────────────────────────── */

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{0,2})(\d{0,4})(\d{0,4}).*/, (_, a, b, c) => [a && `(${a}`, a?.length === 2 ? ") " : "", b, c && `-${c}`].filter(Boolean).join(""));
  return d.replace(/(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3");
};
const maskCEP = (v: string) => v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d{0,3})/, (_, a, b) => (b ? `${a}-${b}` : a));
const maskCNPJ = (v: string) =>
  v.replace(/\D/g, "").slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
const sanitizeSlug = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 50);
const onlyDigits = (v: string) => v.replace(/\D/g, "");

/* ────────────────────────────────────────────────────────────
   Per-step zod schemas
   ──────────────────────────────────────────────────────────── */

const step1Schema = z.object({
  name: z.string().trim().min(2, "Informe o nome do restaurante").max(200),
  type: z.string().min(1, "Escolha o tipo de estabelecimento"),
  phone: z.string().refine((v) => onlyDigits(v).length >= 10, "Telefone inválido"),
});

const step2Schema = z.object({
  cep: z.string().refine((v) => onlyDigits(v).length === 8, "CEP deve ter 8 dígitos"),
  street: z.string().trim().min(2, "Rua é obrigatória"),
  number: z.string().trim().min(1, "Número é obrigatório"),
  city: z.string().trim().min(2, "Cidade é obrigatória"),
});

const step3Schema = z
  .object({
    responsibleName: z.string().trim().min(2, "Informe seu nome").max(100),
    email: z.string().trim().email("Email inválido").max(200),
    slug: z.string().min(3, "Mínimo 3 caracteres").max(50).regex(/^[a-z0-9-]+$/, "Use só letras minúsculas, números e -"),
    password: z.string().min(6, "Mínimo 6 caracteres").max(100),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Senhas não coincidem" });

/* ────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────── */

const RestaurantRegistration = () => {
  const { planSlug: routePlan } = useParams<{ planSlug: string }>();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [animKey, setAnimKey] = useState(0); // forces re-mount to retrigger animation

  // Step 1
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [phone, setPhone] = useState("");

  // Step 2
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [cepLoading, setCepLoading] = useState(false);

  // Step 3
  const [responsibleName, setResponsibleName] = useState("");
  const [email, setEmail] = useState("");
  const [slug, setSlug] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);

  // Step 4
  const initialPlan: Exclude<PlanSlug, "trial"> =
    routePlan === "basico" || routePlan === "intermediario" || routePlan === "avancado"
      ? routePlan
      : "avancado";
  const [selectedPlan, setSelectedPlan] = useState<Exclude<PlanSlug, "trial">>(initialPlan);
  const isTrialFlow = routePlan === "trial";

  // Validation errors per field
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Submission state
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [redirectingToPayment, setRedirectingToPayment] = useState(false);

  const planForDisplay = isTrialFlow ? "trial" : selectedPlan;
  const planInfo = planDisplayMap[planForDisplay] || { name: "Desconhecido", color: "text-muted-foreground" };

  /* ── Meta Pixel Lead on mount ── */
  useEffect(() => {
    trackEvent("Lead", {
      content_name: `Cadastro - Plano ${planInfo.name}`,
      content_category: routePlan || "unknown",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── ViaCEP auto-fill ── */
  const fetchCep = useCallback(async (rawCep: string) => {
    const digits = onlyDigits(rawCep);
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data?.erro) {
        toast.error("CEP não encontrado");
        return;
      }
      setStreet(data.logradouro || "");
      setNeighborhood(data.bairro || "");
      setCity(data.localidade || "");
      setUf(data.uf || "");
      setErrors((e) => ({ ...e, cep: "" }));
    } catch {
      toast.error("Não foi possível buscar o CEP");
    } finally {
      setCepLoading(false);
    }
  }, []);

  useEffect(() => {
    if (onlyDigits(cep).length === 8) fetchCep(cep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cep]);

  /* ── Debounced slug availability check ── */
  const slugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setSlugAvailable(null);
    if (slug.length < 3) return;
    if (slugTimer.current) clearTimeout(slugTimer.current);
    slugTimer.current = setTimeout(async () => {
      setSlugChecking(true);
      const { data } = await supabase
        .from("restaurants")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      setSlugAvailable(!data);
      setSlugChecking(false);
    }, 500);
    return () => {
      if (slugTimer.current) clearTimeout(slugTimer.current);
    };
  }, [slug]);

  /* ── Step navigation ── */
  const transitionTo = (nextStep: number, dir: "forward" | "back") => {
    setDirection(dir);
    setStep(nextStep);
    setAnimKey((k) => k + 1);
    setErrors({});
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const validateCurrentStep = (): boolean => {
    setErrors({});
    if (step === 1) {
      const r = step1Schema.safeParse({ name, type, phone });
      if (!r.success) {
        const e: Record<string, string> = {};
        r.error.issues.forEach((i) => (e[i.path[0] as string] = i.message));
        setErrors(e);
        return false;
      }
    }
    if (step === 2) {
      const r = step2Schema.safeParse({ cep, street, number, city });
      if (!r.success) {
        const e: Record<string, string> = {};
        r.error.issues.forEach((i) => (e[i.path[0] as string] = i.message));
        setErrors(e);
        return false;
      }
    }
    if (step === 3) {
      const r = step3Schema.safeParse({ responsibleName, email, slug, password, confirmPassword });
      if (!r.success) {
        const e: Record<string, string> = {};
        r.error.issues.forEach((i) => (e[i.path[0] as string] = i.message));
        setErrors(e);
        return false;
      }
      if (slugAvailable === false) {
        setErrors({ slug: "Este nome de usuário já está em uso" });
        return false;
      }
      if (slugAvailable === null) {
        toast.info("Aguarde a verificação do nome de usuário…");
        return false;
      }
    }
    return true;
  };

  const goNext = () => {
    if (!validateCurrentStep()) return;
    if (step < 4) transitionTo(step + 1, "forward");
  };
  const goBack = () => {
    if (step > 1) transitionTo(step - 1, "back");
  };
  const jumpTo = (target: number) => {
    if (target < step) transitionTo(target, "back");
  };

  /* ── Submission ── */
  const handleSubmit = async () => {
    if (!validateCurrentStep()) return;
    const finalPlanSlug: PlanSlug = isTrialFlow ? "trial" : selectedPlan;
    const composedAddress = [
      street && number ? `${street}, ${number}` : street,
      neighborhood,
      city && uf ? `${city}/${uf}` : city,
      cep ? `CEP ${cep}` : "",
    ].filter(Boolean).join(" - ");

    setLoading(true);
    try {
      const res = await supabase.functions.invoke("register-restaurant", {
        body: {
          name: name.trim(),
          slug: slug.trim(),
          cnpj: cnpj.trim(),
          phone: phone.trim(),
          address: composedAddress,
          email: email.trim().toLowerCase(),
          username: slug.trim(),
          password,
          adminUsername: responsibleName.trim() || slug.trim(),
          adminPassword: password,
          planSlug: finalPlanSlug,
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
          /* fallback */
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

      const restaurantId = res.data?.restaurantId;
      if (restaurantId) {
        localStorage.setItem("restaurant_id", restaurantId);
        localStorage.setItem("restaurant_name", name.trim());
        localStorage.setItem("restaurant_slug", slug.trim());
        if (res.data?.staffId) {
          localStorage.setItem("staff_id", res.data.staffId);
          localStorage.setItem("staff_name", (responsibleName.trim() || slug.trim()));
          localStorage.setItem("staff_role", "admin");
          localStorage.setItem("staff_allowed_sections", JSON.stringify([]));
        }
      }

      trackEvent("CompleteRegistration", {
        content_name: `Restaurante cadastrado - ${planDisplayMap[finalPlanSlug]?.name ?? finalPlanSlug}`,
        content_category: finalPlanSlug,
        status: true,
      });

      if (res.data?.redirectUrl) {
        setRedirectingToPayment(true);
        toast.success("Restaurante criado! Redirecionando para pagamento...");
        trackEvent("InitiateCheckout", {
          content_name: `Checkout - Plano ${planDisplayMap[finalPlanSlug]?.name ?? finalPlanSlug}`,
          content_ids: [finalPlanSlug],
          content_type: "subscription_plan",
          currency: "BRL",
        });
        setTimeout(() => {
          window.location.href = res.data.redirectUrl;
        }, 2000);
        return;
      }

      setSuccess(true);
      toast.success("Restaurante cadastrado com sucesso!");
      setTimeout(() => navigate(`/${slug.trim()}/admin`), 3000);
    } catch {
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  /* ── Guard: invalid plan slug ── */
  if (routePlan && !planDisplayMap[routePlan]) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <p className="text-destructive font-medium">Link de registro inválido.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>Voltar ao site</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ── Redirect / success screens (preserved) ── */
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
            <p className="text-sm text-muted-foreground">Você será redirecionado para o Mercado Pago para finalizar a assinatura.</p>
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
            {isTrialFlow && (
              <p className="text-sm font-medium text-green-600">Seu período gratuito termina em 7 dias.</p>
            )}
            <p className="text-sm text-muted-foreground">Redirecionando para o painel...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ── Wizard UI ── */
  const progressPct = ((step - 1) / (STEPS.length - 1)) * 100;
  const SelectedTypeIcon = ESTABLISHMENT_TYPES.find((t) => t.id === type)?.icon ?? Store;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 flex flex-col">
      {/* Header with logo */}
      <header className="pt-8 pb-6 px-4 flex flex-col items-center gap-3">
        <button onClick={() => navigate("/")} className="flex items-center gap-2.5">
          <img src={menusLogo} alt="Menu's" className="h-10 w-10" />
          <span className="text-2xl font-bold tracking-tight">Menu's</span>
        </button>
      </header>

      {/* Stepper */}
      <div className="w-full max-w-2xl mx-auto px-4 mb-6">
        <ol className="flex items-center justify-between gap-1 sm:gap-2">
          {STEPS.map((s, i) => {
            const completed = step > s.id;
            const active = step === s.id;
            const clickable = s.id < step;
            return (
              <li key={s.id} className="flex-1 flex flex-col items-center">
                <div className="w-full flex items-center">
                  {i > 0 && (
                    <div className={`flex-1 h-[2px] ${step > s.id - 1 ? "bg-primary" : "bg-border"} transition-colors`} />
                  )}
                  <button
                    type="button"
                    onClick={() => clickable && jumpTo(s.id)}
                    disabled={!clickable}
                    aria-current={active ? "step" : undefined}
                    className={`shrink-0 h-9 w-9 rounded-full grid place-items-center text-sm font-bold border-2 transition-all ${
                      completed
                        ? "bg-primary border-primary text-primary-foreground"
                        : active
                        ? "bg-primary/10 border-primary text-primary scale-110 shadow-md shadow-primary/20"
                        : "bg-card border-border text-muted-foreground"
                    } ${clickable ? "cursor-pointer hover:scale-105" : ""}`}
                  >
                    {completed ? <Check className="h-4 w-4" /> : s.id}
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-[2px] ${step > s.id ? "bg-primary" : "bg-border"} transition-colors`} />
                  )}
                </div>
                <span className={`mt-2 text-[11px] sm:text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="mt-4 h-1 w-full rounded-full bg-border overflow-hidden">
          <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Animated step content */}
      <main className="flex-1 px-4 pb-12">
        <div className="max-w-lg mx-auto overflow-hidden">
          <div
            key={animKey}
            className={`${direction === "forward" ? "animate-step-in-right" : "animate-step-in-left"}`}
          >
            <Card className="shadow-xl border-border/60">
              <CardContent className="p-6 sm:p-8">
                {step === 1 && (
                  <div className="space-y-6">
                    <div className="text-center space-y-2">
                      <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <SelectedTypeIcon className="h-7 w-7 text-primary" />
                      </div>
                      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Vamos começar!</h1>
                      <p className="text-muted-foreground text-sm">Em 2 minutos seu cardápio digital estará no ar.</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="name">Como se chama seu restaurante?</Label>
                      <Input
                        id="name"
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ex: Pizzaria do João"
                        maxLength={200}
                        className="h-12 text-base"
                        aria-invalid={!!errors.name}
                      />
                      {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label>Tipo de estabelecimento</Label>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {ESTABLISHMENT_TYPES.map((t) => {
                          const Icon = t.icon;
                          const selected = type === t.id;
                          return (
                            <button
                              type="button"
                              key={t.id}
                              onClick={() => setType(t.id)}
                              className={`group flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                                selected
                                  ? "border-primary bg-primary/10 text-primary shadow-sm"
                                  : "border-border bg-card hover:border-primary/40 text-foreground"
                              }`}
                            >
                              <Icon className="h-5 w-5" />
                              <span className="text-[11px] font-semibold leading-tight text-center">{t.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      {errors.type && <p className="text-xs text-destructive">{errors.type}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone / WhatsApp</Label>
                      <Input
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(maskPhone(e.target.value))}
                        placeholder="(11) 99999-9999"
                        inputMode="tel"
                        className="h-12"
                        aria-invalid={!!errors.phone}
                      />
                      {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                    </div>

                    <Button onClick={goNext} className="w-full h-12 text-base font-semibold rounded-full">
                      Continuar <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-6">
                    <div className="text-center space-y-2">
                      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Onde você está?</h1>
                      <p className="text-muted-foreground text-sm">Usado para configurar sua área de delivery.</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cep">CEP</Label>
                      <div className="relative">
                        <Input
                          id="cep"
                          autoFocus
                          value={cep}
                          onChange={(e) => setCep(maskCEP(e.target.value))}
                          placeholder="00000-000"
                          inputMode="numeric"
                          className="h-12 pr-10"
                          aria-invalid={!!errors.cep}
                        />
                        {cepLoading && (
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                        )}
                      </div>
                      {errors.cep && <p className="text-xs text-destructive">{errors.cep}</p>}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="street">Rua</Label>
                        <Input id="street" value={street} onChange={(e) => setStreet(e.target.value)} className="h-11" aria-invalid={!!errors.street} />
                        {errors.street && <p className="text-xs text-destructive">{errors.street}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="number">Número</Label>
                        <Input id="number" value={number} onChange={(e) => setNumber(e.target.value)} className="h-11" aria-invalid={!!errors.number} />
                        {errors.number && <p className="text-xs text-destructive">{errors.number}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="neighborhood">Bairro</Label>
                        <Input id="neighborhood" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className="h-11" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="city">Cidade / UF</Label>
                        <div className="flex gap-2">
                          <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} className="h-11" aria-invalid={!!errors.city} />
                          <Input value={uf} onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} className="h-11 w-14 text-center" />
                        </div>
                        {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="cnpj">CNPJ</Label>
                      <Input
                        id="cnpj"
                        value={cnpj}
                        onChange={(e) => setCnpj(maskCNPJ(e.target.value))}
                        placeholder="00.000.000/0000-00"
                        inputMode="numeric"
                        className="h-11"
                      />
                      <p className="text-xs text-muted-foreground">Opcional — para emissão de nota fiscal.</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button variant="outline" onClick={goBack} className="h-12 rounded-full px-5">
                        <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
                      </Button>
                      <Button onClick={goNext} className="flex-1 h-12 text-base font-semibold rounded-full">
                        Continuar <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    <div className="text-center space-y-2">
                      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Crie seu acesso</h1>
                      <p className="text-muted-foreground text-sm">Você usará isso para acessar seu painel de gestão.</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="responsibleName">Nome do responsável</Label>
                      <Input id="responsibleName" autoFocus value={responsibleName} onChange={(e) => setResponsibleName(e.target.value)} className="h-11" maxLength={100} aria-invalid={!!errors.responsibleName} />
                      {errors.responsibleName && <p className="text-xs text-destructive">{errors.responsibleName}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" maxLength={200} aria-invalid={!!errors.email} />
                      <p className="text-xs text-muted-foreground">Use o mesmo email do Mercado Pago para ativar seu plano automaticamente.</p>
                      {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="slug">Nome de usuário</Label>
                      <div className="relative">
                        <Input
                          id="slug"
                          value={slug}
                          onChange={(e) => setSlug(sanitizeSlug(e.target.value))}
                          placeholder="meu-restaurante"
                          className="h-11 pr-10"
                          aria-invalid={!!errors.slug || slugAvailable === false}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {slugChecking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                          {!slugChecking && slugAvailable === true && <CheckCircle className="h-5 w-5 text-green-500" />}
                          {!slugChecking && slugAvailable === false && (
                            <span className="text-xs font-semibold text-destructive">Em uso</span>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Seu cardápio: <span className="font-mono text-foreground">menusapp.com.br/<strong>{slug || "seu-usuario"}</strong></span>
                      </p>
                      {errors.slug && <p className="text-xs text-destructive">{errors.slug}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="password">Senha</Label>
                        <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11" placeholder="••••••" aria-invalid={!!errors.password} />
                        {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirmar senha</Label>
                        <PasswordInput id="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-11" placeholder="••••••" aria-invalid={!!errors.confirmPassword} />
                        {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button variant="outline" onClick={goBack} className="h-12 rounded-full px-5">
                        <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
                      </Button>
                      <Button onClick={goNext} className="flex-1 h-12 text-base font-semibold rounded-full">
                        Continuar <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-6">
                    <div className="text-center space-y-2">
                      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Qual plano faz sentido para você?</h1>
                      <p className="text-muted-foreground text-sm">7 dias grátis em qualquer plano. Cancele quando quiser.</p>
                    </div>

                    {isTrialFlow && (
                      <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 text-center">
                        <p className="text-sm font-semibold text-green-700 dark:text-green-300">
                          Você está iniciando o teste gratuito de 7 dias 🎉
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {PLAN_OPTIONS.map((p) => {
                        const selected = !isTrialFlow && selectedPlan === p.slug;
                        return (
                          <button
                            type="button"
                            key={p.slug}
                            onClick={() => !isTrialFlow && setSelectedPlan(p.slug)}
                            disabled={isTrialFlow}
                            className={`relative text-left p-4 rounded-2xl border-2 transition-all ${
                              selected
                                ? "border-primary bg-primary/5 shadow-md shadow-primary/15"
                                : "border-border bg-card hover:border-primary/40"
                            } ${isTrialFlow ? "opacity-60 cursor-not-allowed" : ""}`}
                          >
                            {p.highlighted && !selected && (
                              <span className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full">
                                Mais escolhido
                              </span>
                            )}
                            {selected && (
                              <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary text-primary-foreground grid place-items-center shadow">
                                <Check className="h-3.5 w-3.5" />
                              </span>
                            )}
                            <p className="text-sm font-bold">{p.name}</p>
                            <p className="text-[11px] text-muted-foreground mb-2 leading-tight">{p.description}</p>
                            <div>
                              <span className="text-[11px] text-muted-foreground">R$ </span>
                              <span className="text-2xl font-extrabold">{p.price}</span>
                              <span className="text-[11px] text-muted-foreground">/mês</span>
                            </div>
                            <p className="text-[10px] text-primary font-semibold mb-2">{p.daily}</p>
                            <ul className="space-y-1">
                              {p.features.slice(0, 4).map((f) => (
                                <li key={f} className="flex items-start gap-1.5 text-[11px] text-foreground/80">
                                  <Check className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                                  <span>{f}</span>
                                </li>
                              ))}
                            </ul>
                          </button>
                        );
                      })}
                    </div>

                    {/* Resumo */}
                    <div className="rounded-xl bg-muted/50 border border-border p-4 space-y-1.5 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Resumo</p>
                      <p><span className="text-muted-foreground">Restaurante:</span> <strong>{name || "—"}</strong></p>
                      <p><span className="text-muted-foreground">URL:</span> <span className="font-mono text-xs">menusapp.com.br/{slug || "—"}</span></p>
                      <p><span className="text-muted-foreground">Plano:</span>{" "}
                        <span className={`font-semibold ${planDisplayMap[planForDisplay]?.color}`}>
                          {planDisplayMap[planForDisplay]?.name}
                        </span>
                      </p>
                    </div>

                    <div className="space-y-3">
                      <Button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full h-12 text-base font-bold rounded-full shadow-lg shadow-primary/20"
                      >
                        {loading ? (
                          <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Cadastrando...</>
                        ) : (
                          <>Criar minha conta grátis 🚀</>
                        )}
                      </Button>
                      <p className="text-center text-xs text-muted-foreground">
                        7 dias grátis · Sem cartão · Cancele quando quiser
                      </p>
                      <button
                        type="button"
                        onClick={goBack}
                        disabled={loading}
                        className="w-full text-sm text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" /> Voltar
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <style>{`
        @keyframes step-in-right {
          from { transform: translateX(40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes step-in-left {
          from { transform: translateX(-40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-step-in-right { animation: step-in-right 0.3s ease-out both; }
        .animate-step-in-left { animation: step-in-left 0.3s ease-out both; }
      `}</style>
    </div>
  );
};

export default RestaurantRegistration;

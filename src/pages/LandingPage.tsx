import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import menusLogo from "@/assets/menus-logo.png";
import heroDashboard from "@/assets/landing-hero-dashboard.jpg";
import {
  ArrowRight, Check, ChevronRight, Zap, Star,
  QrCode, ShoppingCart, Utensils, CalendarCheck, Package,
  BarChart3, Receipt, Users, MessageSquare, Truck,
  Smartphone, TrendingUp, Megaphone, Calculator, CreditCard,
  Shield, Clock, Headphones, MapPin, Printer, Bot,
  PieChart, Wallet, BadgePercent, BookOpen, Coffee,
  Pizza, Beer, Sandwich, UtensilsCrossed, ChefHat, BrainCircuit,
  AlertTriangle, Rocket, ThumbsUp, DollarSign, LayoutGrid,
  Timer, Award, Heart, ChevronDown,
} from "lucide-react";

/* ── Plans ── */
const plans = [
  {
    name: "Básico", price: "69,90", daily: "R$ 2,33/dia", description: "Para começar a digitalizar", highlighted: false,
    features: ["Cardápio digital ilimitado", "QR Code para mesas", "Pedidos em tempo real", "1 usuário administrador", "Suporte por email"],
    cta: "Começar grátis",
    mpLink: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=ce558ba8031d48e78c875adbe8af561a",
  },
  {
    name: "Intermediário", price: "149,90", daily: "R$ 5,00/dia", description: "Para crescer com eficiência", highlighted: true,
    features: ["Tudo do Básico", "Delivery completo", "Gestão de estoque & CMV", "Relatórios e DRE", "Programa de fidelidade", "Até 5 usuários", "Suporte prioritário"],
    cta: "Começar grátis",
    mpLink: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=fe9ff4a87e634b86a493887ab8737b17",
  },
  {
    name: "Avançado", price: "249,90", daily: "R$ 8,33/dia", description: "Solução completa", highlighted: false,
    features: ["Tudo do Intermediário", "Robô IA Vendedor", "Marketing WhatsApp", "Remarketing automático", "Nota fiscal eletrônica", "Fluxo de caixa & DRE", "Reservas online", "Usuários ilimitados", "Suporte VIP"],
    cta: "Começar grátis",
    mpLink: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=e0f8cd5628974aa180490d2b6e9d78ea",
  },
];

/* ── FAQs ── */
const faqs = [
  { q: "Preciso instalar algum aplicativo?", a: "Não! O Menus App funciona 100% no navegador. Seus clientes acessam o cardápio pelo link ou QR Code sem baixar nada." },
  { q: "Posso cancelar a qualquer momento?", a: "Sim, sem fidelidade e sem multa. Cancele quando quiser." },
  { q: "Como funciona o delivery?", a: "Você tem seu próprio sistema de delivery com zonas de entrega, taxas configuráveis e acompanhamento de pedidos. Zero comissão." },
  { q: "O sistema emite nota fiscal?", a: "Sim! No plano Avançado você tem emissão de NFC-e integrada diretamente ao SEFAZ." },
  { q: "Como funciona o Robô IA?", a: "O Robô IA conversa com seus clientes pelo WhatsApp, sugere produtos, tira dúvidas e finaliza pedidos automaticamente." },
  { q: "Preciso de equipamentos especiais?", a: "Não. Qualquer computador, tablet ou celular com navegador funciona." },
  { q: "Quanto tempo leva para configurar?", a: "Menos de 2 minutos para criar a conta. Seu cardápio pode estar no ar no mesmo dia." },
];

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

/* ── Component ── */
const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-card overflow-x-hidden font-sans">
      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <img src={menusLogo} alt="Menus App" className="h-9 w-9" />
            <span className="text-2xl font-bold text-foreground tracking-tight">Menu's</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            {[
              { href: "#como-funciona", label: "Como funciona" },
              { href: "#vantagens", label: "Vantagens" },
              { href: "#pricing", label: "Planos" },
              { href: "#faq", label: "FAQ" },
            ].map((l) => (
              <a key={l.href} href={l.href} className="text-base font-medium text-muted-foreground hover:text-foreground transition-colors">{l.label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex text-base font-medium" onClick={() => navigate("/login")}>
              Entrar
            </Button>
            <Button size="sm" className="font-semibold text-base shadow-md shadow-primary/20" onClick={() => navigate("/register")}>
              Criar meu cardápio grátis
            </Button>
          </div>
        </div>
      </header>

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden bg-card">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] via-transparent to-transparent" />
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-primary/[0.05] blur-[120px] pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 sm:pt-24 sm:pb-16 text-center">
          <ScrollReveal>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-8 border border-primary/20">
              <Zap className="h-4 w-4" />
              7 dias grátis • Sem cartão de crédito
            </div>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground tracking-[-0.03em] leading-[1.1]">
              Pare de perder pedidos no WhatsApp e{" "}
              <span className="text-primary">automatize seu delivery</span> em minutos
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Cardápio digital + sistema automático de pedidos — pronto em menos de 5 minutos e sem comissão.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={300}>
            <div className="mt-8 flex flex-col items-center gap-3">
              <Button size="lg" className="text-lg px-10 h-14 font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] transition-all" onClick={() => navigate("/register")}>
                Criar meu cardápio grátis
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <p className="text-sm text-muted-foreground">
                Leva menos de 2 minutos • Não precisa cartão
              </p>
            </div>
          </ScrollReveal>

          {/* Trust badges */}
          <ScrollReveal delay={350}>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
              {[
                { icon: Shield, text: "7 dias grátis" },
                { icon: DollarSign, text: "Sem taxa por pedido" },
                { icon: MessageSquare, text: "Funciona com WhatsApp" },
              ].map((b) => (
                <div key={b.text} className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <b.icon className="h-4 w-4 text-primary" />
                  {b.text}
                </div>
              ))}
            </div>
          </ScrollReveal>

          {/* Hero mockup */}
          <ScrollReveal delay={400}>
            <div className="mt-12 mx-auto max-w-4xl">
              <div className="rounded-2xl border border-border shadow-2xl shadow-primary/10 overflow-hidden">
                <img src={heroDashboard} alt="Dashboard do Menus App" className="w-full h-auto" />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ SEÇÃO DE DOR ═══ */}
      <section className="py-16 sm:py-20 bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">
              Você pode estar <span className="text-destructive">perdendo pedidos</span> todos os dias
            </h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: Clock, text: "Clientes desistem porque você demora a responder" },
              { icon: AlertTriangle, text: "Pedidos se perdem no WhatsApp" },
              { icon: Users, text: "Atendimento vira bagunça nos horários de pico" },
              { icon: DollarSign, text: "Dependência de apps com taxas altas" },
            ].map((item, i) => (
              <ScrollReveal key={i} delay={i * 80}>
                <div className="flex items-start gap-4 p-5 rounded-xl border border-border bg-card hover:shadow-md transition-shadow">
                  <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                    <item.icon className="h-5 w-5 text-destructive" />
                  </div>
                  <p className="text-base font-medium text-foreground leading-relaxed">{item.text}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SEÇÃO DE SOLUÇÃO ═══ */}
      <section className="py-16 sm:py-20 bg-card">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
              <Zap className="h-4 w-4" />
              A solução
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-[-0.025em] leading-tight">
              Transforme seu WhatsApp em uma{" "}
              <span className="text-primary">máquina automática</span> de pedidos
            </h2>
            <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Com o Menus App, seu cliente faz o pedido sozinho direto do cardápio digital — e você recebe tudo pronto e organizado.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ COMO FUNCIONA (3 PASSOS) ═══ */}
      <section id="como-funciona" className="py-16 sm:py-20 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">Passo a passo</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">Funciona em minutos</h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { num: "1", icon: QrCode, title: "Crie seu cardápio", desc: "Cadastre seus produtos com fotos e preços em minutos." },
              { num: "2", icon: Smartphone, title: "Envie o link", desc: "Compartilhe o link do cardápio com seus clientes por WhatsApp ou QR Code." },
              { num: "3", icon: ShoppingCart, title: "Receba pedidos", desc: "Pedidos chegam automaticamente, organizados e prontos para preparar." },
            ].map((s, i) => (
              <ScrollReveal key={s.num} delay={i * 120}>
                <div className="text-center space-y-4 p-6">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto relative">
                    <s.icon className="h-8 w-8 text-primary" />
                    <div className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center">
                      {s.num}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{s.title}</h3>
                  <p className="text-base text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={400}>
            <p className="text-center mt-8 text-base font-semibold text-muted-foreground">
              Sem instalação. Sem complicação.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ DIFERENCIAL / VANTAGENS ═══ */}
      <section id="vantagens" className="py-16 sm:py-20 bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">Diferenciais</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">Muito mais que um cardápio digital</h2>
            <p className="mt-3 text-lg text-muted-foreground max-w-xl mx-auto">
              Você não só recebe pedidos — você automatiza todo o atendimento.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: QrCode, title: "Cardápio digital completo", desc: "QR Code, link compartilhável, fotos em alta, categorias e complementos." },
              { icon: ShoppingCart, title: "Pedidos automáticos", desc: "Seu cliente faz o pedido sozinho. Sem precisar ligar ou mandar mensagem." },
              { icon: MessageSquare, title: "Integração com WhatsApp", desc: "Robô que atende, sugere e fecha vendas automaticamente no WhatsApp." },
              { icon: Smartphone, title: "Totem de autoatendimento", desc: "Transforme um tablet em totem e elimine filas no balcão.", highlight: true },
              { icon: Package, title: "Estoque automático", desc: "Baixa automática a cada venda. Alertas de estoque baixo." },
              { icon: BarChart3, title: "Relatórios e DRE", desc: "Dashboard completo: vendas, DRE automático, fluxo de caixa e margens." },
            ].map((f, i) => (
              <ScrollReveal key={f.title} delay={i * 60}>
                <div className={`flex items-start gap-4 p-5 rounded-xl border transition-all duration-300 hover:shadow-md ${f.highlight ? "border-primary/30 bg-primary/[0.04]" : "border-border bg-card"}`}>
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${f.highlight ? "bg-primary text-primary-foreground" : "bg-primary/10"}`}>
                    <f.icon className={`h-5 w-5 ${f.highlight ? "" : "text-primary"}`} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground mb-1">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ BENEFÍCIOS ═══ */}
      <section className="py-16 sm:py-20 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">Benefícios</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">Resultados reais para o seu negócio</h2>
          </ScrollReveal>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: TrendingUp, title: "Mais pedidos", desc: "sem esforço extra" },
              { icon: Timer, title: "Atendimento", desc: "mais rápido" },
              { icon: Wallet, title: "Mais lucro", desc: "sem comissão" },
              { icon: LayoutGrid, title: "Organização", desc: "total" },
            ].map((b, i) => (
              <ScrollReveal key={b.title} delay={i * 80}>
                <div className="text-center p-5 rounded-xl border border-border bg-card hover:shadow-md hover:border-primary/20 transition-all">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <b.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-base font-bold text-foreground">{b.title}</h3>
                  <p className="text-sm text-muted-foreground">{b.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PROVA SOCIAL ═══ */}
      <section className="py-16 sm:py-20 bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">Depoimentos</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">Quem usa, recomenda</h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: "Carlos M.", role: "Dono de hamburgueria", text: "Triplicamos nossos pedidos de delivery no primeiro mês. O sistema é muito fácil de usar." },
              { name: "Ana P.", role: "Dona de restaurante", text: "O robô do WhatsApp atende meus clientes de madrugada. Acordo com pedidos prontos!" },
              { name: "Roberto S.", role: "Dono de pizzaria", text: "Saí do iFood e economizo mais de R$ 3.000/mês em comissões. Valeu muito a pena." },
            ].map((t, i) => (
              <ScrollReveal key={t.name} delay={i * 100}>
                <Card className="border-border hover:shadow-md transition-shadow h-full">
                  <CardContent className="p-6 flex flex-col h-full">
                    <div className="flex gap-1 mb-4">
                      {[...Array(5)].map((_, j) => (
                        <Star key={j} className="h-4 w-4 fill-primary text-primary" />
                      ))}
                    </div>
                    <p className="text-base text-foreground leading-relaxed flex-1">"{t.text}"</p>
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-sm font-bold text-foreground">{t.name}</p>
                      <p className="text-sm text-muted-foreground">{t.role}</p>
                    </div>
                  </CardContent>
                </Card>
              </ScrollReveal>
            ))}
          </div>

          {/* Numbers */}
          <ScrollReveal delay={300}>
            <div className="mt-12 grid grid-cols-3 gap-6 text-center max-w-2xl mx-auto">
              {[
                { value: "500+", label: "Restaurantes ativos" },
                { value: "50k+", label: "Pedidos por mês" },
                { value: "0%", label: "Taxa sobre vendas" },
              ].map((s) => (
                <div key={s.label}>
                  <div className="text-2xl sm:text-3xl font-extrabold text-primary">{s.value}</div>
                  <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ OFERTA / TESTE GRÁTIS ═══ */}
      <section className="py-16 sm:py-20" style={{ background: 'linear-gradient(135deg, hsl(25 100% 50%) 0%, hsl(25 100% 42%) 100%)' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-[-0.025em]">
              Teste grátis por 7 dias
            </h2>
            <p className="mt-4 text-lg text-white/80 max-w-xl mx-auto leading-relaxed">
              Use sem compromisso. Se não gostar, não precisa pagar nada.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm font-semibold text-white/90">
              <span className="flex items-center gap-1.5"><Shield className="h-4 w-4" /> Sem cartão</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4" /> Sem risco</span>
              <span className="flex items-center gap-1.5"><Zap className="h-4 w-4" /> Setup em 2 min</span>
            </div>
            <div className="mt-8">
              <Button
                size="lg"
                className="text-lg px-10 h-14 font-bold bg-white text-primary hover:bg-white/90 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all"
                onClick={() => navigate("/register")}
              >
                Começar grátis agora
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section id="pricing" className="py-16 sm:py-20 bg-background relative overflow-hidden">
        <div className="absolute top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.04] blur-[120px] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <ScrollReveal className="text-center mb-14">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">Planos & Preços</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-[-0.025em]">Escolha o plano ideal</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">7 dias grátis em todos os planos. Sem fidelidade, sem multa.</p>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
            {plans.map((plan, i) => (
              <ScrollReveal key={plan.name} delay={i * 120}>
                <Card className={`relative flex flex-col h-full transition-all duration-300 hover:shadow-xl ${plan.highlighted ? "border-primary shadow-lg shadow-primary/15 ring-2 ring-primary/25 md:scale-[1.05] md:-my-4" : "border-border hover:border-primary/25"}`}>
                  {plan.highlighted && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-sm font-bold rounded-full shadow-lg shadow-primary/30">
                      ⭐ Mais Escolhido
                    </div>
                  )}
                  <div className="p-6 pb-0 text-center">
                    <h3 className="text-xl font-bold text-foreground">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                    <div className="mt-5 mb-2">
                      <span className="text-sm text-muted-foreground">R$ </span>
                      <span className="text-4xl font-extrabold text-foreground">{plan.price}</span>
                      <span className="text-base text-muted-foreground font-medium">/mês</span>
                    </div>
                    <p className="text-sm text-primary font-semibold mb-6">{plan.daily}</p>
                  </div>
                  <CardContent className="flex-1 flex flex-col pt-0">
                    <ul className="space-y-3 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5">
                          <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="h-3 w-3 text-primary" />
                          </div>
                          <span className="text-sm text-foreground">{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={`w-full mt-8 h-12 font-bold text-base hover:scale-[1.02] transition-all ${plan.highlighted ? "shadow-lg shadow-primary/25" : ""}`}
                      variant={plan.highlighted ? "default" : "outline"}
                      onClick={() => {
                        if (plan.mpLink && plan.mpLink !== "#") {
                          window.open(plan.mpLink, "_blank");
                        }
                      }}
                    >
                      {plan.cta}
                      <ChevronRight className="ml-1 h-5 w-5" />
                    </Button>
                    <p className="text-xs text-center text-muted-foreground mt-2">7 dias grátis • Cancele quando quiser</p>
                  </CardContent>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ GARANTIA ═══ */}
      <section className="py-12 sm:py-16 bg-card">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <div className="flex items-center justify-center gap-3 mb-4">
              <Shield className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-[-0.025em]">
              Garantia de satisfação
            </h2>
            <p className="mt-3 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Se você não tiver mais organização e mais pedidos, você simplesmente não paga. Teste 7 dias sem risco.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section id="faq" className="py-16 sm:py-20 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">FAQ</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">Perguntas frequentes</h2>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-xl px-6 bg-card data-[state=open]:shadow-md transition-shadow">
                  <AccordionTrigger className="text-left text-base font-semibold text-foreground hover:no-underline py-5">{faq.q}</AccordionTrigger>
                  <AccordionContent className="text-base text-muted-foreground leading-relaxed pb-5">{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ CTA FINAL ═══ */}
      <section className="py-16 sm:py-20 bg-card">
        <ScrollReveal>
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground mb-4 tracking-[-0.025em]">
              Comece agora e automatize seu delivery hoje mesmo
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Seu cardápio digital pronto em minutos. Sem risco, sem complicação.
            </p>
            <Button size="lg" className="text-lg px-10 h-14 font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:scale-[1.02] transition-all" onClick={() => navigate("/register")}>
              Criar meu cardápio grátis
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <p className="text-sm text-muted-foreground mt-3">
              Leva menos de 2 minutos • Não precisa cartão
            </p>
          </div>
        </ScrollReveal>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-border bg-card py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <img src={menusLogo} alt="Menus App" className="h-8 w-8" />
              <span className="text-lg font-bold text-foreground tracking-tight">Menu's</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#como-funciona" className="hover:text-foreground transition-colors">Como funciona</a>
              <a href="#vantagens" className="hover:text-foreground transition-colors">Vantagens</a>
              <a href="#pricing" className="hover:text-foreground transition-colors">Planos</a>
              <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
            </div>
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Menu's. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

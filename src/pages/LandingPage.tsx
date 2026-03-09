import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { TypingEffect } from "@/components/landing/TypingEffect";
import { AnimatedCounter } from "@/components/landing/AnimatedCounter";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import menusLogo from "@/assets/menus-logo.png";
import heroDashboard from "@/assets/landing-hero-dashboard.jpg";
import whatsappImg from "@/assets/landing-whatsapp.jpg";
import ordersImg from "@/assets/landing-orders.jpg";
import financialImg from "@/assets/landing-financial.jpg";
import {
  ArrowRight, Check, ChevronRight, Zap, Star,
  QrCode, ShoppingCart, Utensils, CalendarCheck, Package,
  BarChart3, Receipt, Users, MessageSquare, Truck,
  Smartphone, TrendingUp, Megaphone, Calculator, CreditCard,
  Shield, Clock, Headphones, MapPin, Printer, Bot,
  PieChart, Wallet, BadgePercent, BookOpen, Coffee,
  Pizza, Beer, Sandwich, UtensilsCrossed, ChefHat,
} from "lucide-react";

/* ── Carousel items ── */
const carouselItems = [
  { icon: ShoppingCart, title: "Venda sem taxas", desc: "Delivery, retirada, balcão e mesa — sem comissão de marketplace." },
  { icon: Smartphone, title: "Fácil e personalizado", desc: "Seu cardápio com a sua marca. Setup em menos de 2 minutos." },
  { icon: Bot, title: "Robô WhatsApp", desc: "Receba pedidos automaticamente pelo WhatsApp com chatbot integrado." },
  { icon: Printer, title: "Impressão automática", desc: "Pedidos impressos direto na cozinha. Sem atrasos manuais." },
  { icon: Package, title: "Estoque e CMV", desc: "Baixa automática, fichas técnicas e CMV calculado em tempo real." },
  { icon: MapPin, title: "Áreas de entrega", desc: "Configure zonas, taxas e raios de entrega no mapa interativo." },
  { icon: Headphones, title: "Suporte dedicado", desc: "Time de suporte pronto para te ajudar a qualquer momento." },
];

/* ── Bento grid features ── */
const bentoFeatures = [
  { icon: QrCode, title: "Cardápio personalizado", desc: "QR Code por mesa, sua marca, cores e fotos em alta resolução.", span: "md:col-span-2" },
  { icon: Users, title: "Fidelidade e CRM", desc: "Cadastro de clientes, programa de pontos, cupons e recompensas automáticas.", span: "" },
  { icon: CreditCard, title: "Pagamento online", desc: "Pix e cartão de crédito integrados com Mercado Pago. Sem complicação.", span: "" },
  { icon: Package, title: "Estoque automático", desc: "Baixa automática a cada venda. Alertas de estoque baixo e fichas técnicas.", span: "md:col-span-2" },
  { icon: BarChart3, title: "Relatórios e DRE", desc: "Dashboard completo: vendas, DRE automático, fluxo de caixa e margens.", span: "" },
  { icon: Receipt, title: "Nota fiscal eletrônica", desc: "Emissão de NFC-e integrada direto ao SEFAZ. Compliance sem dor de cabeça.", span: "" },
  { icon: CalendarCheck, title: "Reservas de mesas", desc: "Sistema de reservas online com gestão visual de mesas e comandas digitais.", span: "" },
  { icon: MessageSquare, title: "Marketing WhatsApp", desc: "Campanhas automáticas, remarketing por inatividade, cupons personalizados.", span: "md:col-span-2" },
];

/* ── Segments ── */
const segments = [
  { icon: UtensilsCrossed, name: "Restaurante" },
  { icon: Sandwich, name: "Hamburgueria" },
  { icon: Pizza, name: "Pizzaria" },
  { icon: Beer, name: "Bar" },
  { icon: Coffee, name: "Cafeteria" },
  { icon: ChefHat, name: "E muito mais!" },
];

/* ── Plans (reordered: Básico, Premium, Avançado) ── */
const plans = [
  {
    name: "Básico", price: "99", daily: "R$ 3,30/dia", description: "Para começar a digitalizar", highlighted: false,
    features: ["Cardápio digital ilimitado", "QR Code para mesas", "Pedidos em tempo real", "1 usuário administrador", "Suporte por email"],
    cta: "Começar Agora",
  },
  {
    name: "Premium", price: "349", daily: "R$ 11,63/dia", description: "Solução completa", highlighted: true,
    features: ["Tudo do Avançado", "Marketing WhatsApp", "Remarketing automático", "Nota fiscal eletrônica", "Fluxo de caixa & DRE", "Reservas online", "Usuários ilimitados", "Suporte VIP"],
    cta: "Escolher Premium",
  },
  {
    name: "Avançado", price: "199", daily: "R$ 6,63/dia", description: "Para crescer com eficiência", highlighted: false,
    features: ["Tudo do Básico", "Delivery completo", "Gestão de estoque & CMV", "Relatórios e DRE", "Programa de fidelidade", "Até 5 usuários", "Suporte prioritário"],
    cta: "Escolher Avançado",
  },
];

/* ── Steps ── */
const steps = [
  { num: "01", title: "Crie sua conta", desc: "Cadastro rápido em poucos minutos." },
  { num: "02", title: "Configure seu cardápio", desc: "Adicione produtos, fotos, preços e complementos." },
  { num: "03", title: "Comece a vender", desc: "Compartilhe o QR Code e receba pedidos na hora." },
];

/* ── FAQs ── */
const faqs = [
  { q: "Preciso instalar algum aplicativo?", a: "Não! O Menu's funciona 100% no navegador. Seus clientes acessam o cardápio pelo QR Code sem baixar nada. Você gerencia tudo pelo painel web." },
  { q: "Posso cancelar a qualquer momento?", a: "Sim, sem fidelidade e sem multa. Você pode fazer upgrade, downgrade ou cancelar quando quiser." },
  { q: "Como funciona o delivery?", a: "Você tem seu próprio sistema de delivery com zonas de entrega, taxas configuráveis e acompanhamento de pedidos. Zero comissão de marketplace." },
  { q: "O sistema emite nota fiscal?", a: "Sim! No plano Premium você tem emissão de NFC-e integrada diretamente ao sistema, com envio automático ao SEFAZ." },
  { q: "Como funciona o marketing por WhatsApp?", a: "Você configura campanhas automáticas que disparam mensagens via WhatsApp baseadas em comportamento do cliente: inatividade, compras específicas, aniversário e mais." },
  { q: "Preciso de equipamentos especiais?", a: "Não. Qualquer computador, tablet ou celular com navegador funciona. Para impressão, qualquer impressora térmica USB ou de rede é compatível." },
  { q: "Quanto tempo leva para configurar?", a: "Menos de 2 minutos para criar a conta. O cardápio básico pode estar no ar no mesmo dia." },
  { q: "O sistema funciona offline?", a: "Sim! O Menu's possui modo offline para PDV e comandas, sincronizando automaticamente quando a conexão voltar." },
];

/* ── Component ── */
const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-card overflow-x-hidden font-sans">
      {/* ═══ HEADER ═══ */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <img src={menusLogo} alt="Menu's" className="h-8 w-8" />
            <span className="text-xl font-bold text-foreground tracking-tight">Menu's</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            {[
              { href: "#funcoes", label: "Funções" },
              { href: "#features", label: "Funcionalidades" },
              { href: "#pricing", label: "Planos" },
              { href: "#faq", label: "FAQ" },
            ].map((l) => (
              <a key={l.href} href={l.href} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{l.label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex text-sm font-medium" onClick={() => navigate("/login")}>
              Entrar
            </Button>
            <Button size="sm" className="font-semibold shadow-md shadow-primary/20" onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}>
              Começar agora
            </Button>
          </div>
        </div>
      </header>

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden bg-card">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] via-transparent to-transparent" />
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-primary/[0.04] blur-[120px] pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center">
          <ScrollReveal>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6 border border-primary/20">
              <Star className="h-3.5 w-3.5 fill-primary" />
              Usado por mais de 500 restaurantes
            </div>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-foreground tracking-[-0.025em] leading-[1.08]">
              O sistema completo
              <br />
              para <TypingEffect />
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-light">
              Cardápio digital, pedidos online, delivery, estoque automático, financeiro, marketing e muito mais.
              <span className="font-medium text-foreground"> Tudo em uma só plataforma.</span>
            </p>
          </ScrollReveal>

          <ScrollReveal delay={300}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="text-base px-10 h-13 font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all" onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}>
                Começar agora
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="text-base px-8 h-13 font-medium" onClick={() => document.getElementById("funcoes")?.scrollIntoView({ behavior: "smooth" })}>
                Ver funcionalidades
              </Button>
            </div>
          </ScrollReveal>

          {/* Hero mockup */}
          <ScrollReveal delay={400}>
            <div className="mt-16 mx-auto max-w-4xl">
              <div className="rounded-2xl border border-border shadow-2xl shadow-primary/10 overflow-hidden">
                <img src={heroDashboard} alt="Dashboard do Menu's - Sistema de gestão para restaurantes" className="w-full h-auto" />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Divider gradient ── */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      {/* ═══ CAROUSEL DE FUNÇÕES ═══ */}
      <section id="funcoes" className="py-16 sm:py-24 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-3">Funções</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">Funções para você vender mais</h2>
            <p className="mt-3 text-lg text-muted-foreground max-w-xl mx-auto font-light">Tudo o que você precisa num único lugar, sem ferramentas avulsas.</p>
          </ScrollReveal>

          {/* Horizontal scroll */}
          <div className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide -mx-4 px-4">
            {carouselItems.map((item, i) => (
              <ScrollReveal key={item.title} delay={i * 80} className="snap-start shrink-0 w-[280px]">
                <Card className="h-full border-border hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group">
                  <CardContent className="p-6">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 group-hover:scale-110 transition-all duration-300">
                      <item.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground mb-1.5">{item.title}</h3>
                     <p className="text-sm text-muted-foreground leading-relaxed font-light">{item.desc}</p>
                  </CardContent>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Divider gradient ── */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* ═══ WHATSAPP / AUTOMAÇÃO ═══ */}
      <section className="py-16 sm:py-24 bg-card relative overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-green-500/[0.04] blur-[100px] pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <ScrollReveal>
            <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/15 p-8 sm:p-14 flex flex-col lg:flex-row gap-10 items-center">
              <div className="flex-1 space-y-5">
                <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">WhatsApp</span>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-foreground leading-tight tracking-[-0.025em]">
                  Marketing automático e central de alertas no WhatsApp
                </h2>
                <p className="text-base text-muted-foreground leading-relaxed font-light">
                  Crie campanhas de remarketing que disparam automaticamente. Cliente inativo? Ele recebe um cupom. Pedido confirmado? Notificação instantânea. Tudo sem você levantar um dedo.
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {["Remarketing automático", "Cupons personalizados", "Notificações de pedido", "Segmentação inteligente"].map((h) => (
                    <li key={h} className="flex items-center gap-2.5 text-sm font-medium text-foreground">
                      <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Check className="h-3 w-3 text-primary" />
                      </div>
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex-1 w-full max-w-sm">
                <div className="rounded-2xl overflow-hidden shadow-xl shadow-green-500/10 border border-green-500/10">
                  <img src={whatsappImg} alt="Interface WhatsApp com marketing automático" className="w-full h-auto" />
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Divider gradient ── */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      {/* ═══ BENTO GRID FEATURES ═══ */}
      <section id="features" className="py-16 sm:py-24 bg-background relative overflow-hidden">
        <div className="absolute top-20 -left-40 w-80 h-80 rounded-full bg-primary/[0.03] blur-[100px] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <ScrollReveal className="text-center mb-14">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-3">Funcionalidades</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-[-0.025em]">Tudo que seu restaurante precisa</h2>
            <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto font-light">Um sistema completo que substitui dezenas de ferramentas fragmentadas.</p>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {bentoFeatures.map((f, i) => (
              <ScrollReveal key={f.title} delay={i * 60} className={f.span}>
                <Card className="h-full border-border hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group overflow-hidden">
                  <CardContent className="p-6 sm:p-8">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/15 group-hover:scale-110 transition-all duration-300">
                      <f.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed font-light">{f.desc}</p>
                  </CardContent>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Divider gradient ── */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* ═══ GESTOR DE PEDIDOS ═══ */}
      <section className="py-16 sm:py-24 bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row gap-12 items-center">
            <ScrollReveal className="flex-1 space-y-5">
              <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">Operação</span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-foreground leading-tight tracking-[-0.025em]">
                Gestor de pedidos completo
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed font-light">
                PDV integrado, app de garçom, comandas digitais e confirmação automática de pedidos. Gerencie toda a operação do balcão ao delivery num só lugar.
              </p>
              <ul className="space-y-3 pt-2">
                {["PDV completo com atalhos", "Comandas digitais por mesa", "Gestão visual de mesas", "Confirmação automática"].map((h) => (
                  <li key={h} className="flex items-center gap-2.5 text-sm font-medium text-foreground">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    {h}
                  </li>
                ))}
              </ul>
            </ScrollReveal>
            <ScrollReveal delay={150} className="flex-1 w-full">
              <div className="rounded-2xl overflow-hidden border border-border shadow-xl shadow-primary/5">
                <img src={ordersImg} alt="Gestor de pedidos do Menu's" className="w-full h-auto" />
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Divider gradient ── */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      {/* ═══ VISÃO DE NEGÓCIOS ═══ */}
      <section className="py-16 sm:py-24 bg-background relative overflow-hidden">
        <div className="absolute bottom-20 -right-40 w-80 h-80 rounded-full bg-primary/[0.03] blur-[100px] pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="flex flex-col lg:flex-row-reverse gap-12 items-center">
            <ScrollReveal className="flex-1 space-y-5">
              <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">Financeiro</span>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-foreground leading-tight tracking-[-0.025em]">
                Visão completa do seu negócio
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed font-light">
                DRE automático, fluxo de caixa diário, CMV por produto, custos fixos e variáveis — tudo calculado a partir das suas vendas reais. Pare de usar planilha.
              </p>
              <ul className="space-y-3 pt-2">
                {["DRE automático mensal", "Fluxo de caixa em tempo real", "CMV por produto", "Margens e lucratividade", "Custos fixos e variáveis"].map((h) => (
                  <li key={h} className="flex items-center gap-2.5 text-sm font-medium text-foreground">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    {h}
                  </li>
                ))}
              </ul>
            </ScrollReveal>
            <ScrollReveal delay={150} className="flex-1 w-full">
              <div className="rounded-2xl overflow-hidden border border-border shadow-xl shadow-primary/5">
                <img src={financialImg} alt="Dashboard financeiro do Menu's" className="w-full h-auto" />
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ── Divider gradient ── */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* ═══ SEGMENTOS ═══ */}
      <section className="py-16 sm:py-24 bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-3">Segmentos</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">Versátil para diversos segmentos</h2>
            <p className="mt-3 text-lg text-muted-foreground font-light">O Menu's se adapta ao seu tipo de negócio.</p>
          </ScrollReveal>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {segments.map((s, i) => (
              <ScrollReveal key={s.name} delay={i * 60}>
                <Card className="border-border hover:border-primary/30 hover:shadow-md transition-all duration-300 group">
                  <CardContent className="p-5 text-center">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/15 group-hover:scale-110 transition-all duration-300">
                      <s.icon className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm font-semibold text-foreground">{s.name}</p>
                  </CardContent>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SOCIAL PROOF NUMBERS ═══ */}
      <section className="py-16 sm:py-20 text-foreground" style={{ backgroundColor: '#fff0e5' }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { end: 500, suffix: "+", label: "Restaurantes ativos" },
              { end: 50, suffix: ".000+", label: "Pedidos por mês" },
              { end: 4, suffix: "", label: "Avaliação dos clientes", display: "4.9/5" },
              { end: 0, suffix: "%", label: "Taxa sobre vendas", display: "0%" },
            ].map((s, i) => (
              <ScrollReveal key={s.label} delay={i * 100}>
                <div className="text-3xl sm:text-4xl font-extrabold">
                  {s.display ? s.display : <AnimatedCounter end={s.end} suffix={s.suffix} />}
                </div>
                <p className="text-sm mt-1 opacity-70 font-medium">{s.label}</p>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Divider gradient ── */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      {/* ═══ PRICING ═══ */}
      <section id="pricing" className="py-16 sm:py-24 bg-background relative overflow-hidden">
        <div className="absolute top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.03] blur-[120px] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <ScrollReveal className="text-center mb-14">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-3">Planos & Preços</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-[-0.025em]">Escolha o plano ideal</h2>
            <p className="mt-3 text-lg text-muted-foreground max-w-xl mx-auto font-light">Sem fidelidade, sem multa. Comece agora e mude quando quiser.</p>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
            {plans.map((plan, i) => (
              <ScrollReveal key={plan.name} delay={i * 120}>
                <Card className={`relative flex flex-col h-full transition-all duration-300 hover:shadow-xl ${plan.highlighted ? "border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/20 md:scale-[1.05] md:-my-4" : "border-border hover:border-primary/20"}`}>
                  {plan.highlighted && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full shadow-lg shadow-primary/25">
                      ⭐ Mais Escolhido
                    </div>
                  )}
                  <div className="p-6 pb-0 text-center">
                    <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                    <div className="mt-5 mb-2">
                      <span className="text-sm text-muted-foreground">R$ </span>
                      <span className="text-5xl font-extrabold text-foreground">{plan.price}</span>
                      <span className="text-muted-foreground font-medium">/mês</span>
                    </div>
                    <p className="text-xs text-primary font-semibold mb-6">{plan.daily}</p>
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
                    <Button className={`w-full mt-8 h-11 font-semibold ${plan.highlighted ? "shadow-lg shadow-primary/25" : ""}`} variant={plan.highlighted ? "default" : "outline"}>
                      {plan.cta}
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Divider gradient ── */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* ═══ COMO COMEÇAR ═══ */}
      <section className="py-16 sm:py-24 bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-14">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-3">Passo a passo</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">Como começar?</h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <ScrollReveal key={s.num} delay={i * 120}>
                <div className="text-center space-y-4">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                    <span className="text-2xl font-extrabold text-primary">{s.num}</span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed font-light">{s.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Divider gradient ── */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      {/* ═══ FAQ ═══ */}
      <section id="faq" className="py-16 sm:py-24 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-3">FAQ</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">Perguntas frequentes</h2>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-xl px-5 bg-card data-[state=open]:shadow-md transition-shadow">
                  <AccordionTrigger className="text-left text-sm font-semibold text-foreground hover:no-underline py-4">{faq.q}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ScrollReveal>
        </div>
      </section>

      {/* ── Divider gradient ── */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* ═══ CTA FINAL ═══ */}
      <section className="py-16 sm:py-24 bg-card relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/[0.02] to-transparent pointer-events-none" />
        <ScrollReveal>
          <div className="max-w-4xl mx-auto px-4 text-center relative">
            <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/15 p-10 sm:p-16">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-4 tracking-[-0.025em]">
                Pronto para transformar seu restaurante?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto font-light">
                Comece hoje mesmo. Setup em menos de 2 minutos.
              </p>
              <Button size="lg" className="text-base px-10 h-13 font-bold shadow-lg shadow-primary/25" onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}>
                Ver planos e começar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-border bg-card py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <img src={menusLogo} alt="Menu's" className="h-7 w-7" />
              <span className="font-bold text-foreground tracking-tight">Menu's</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#funcoes" className="hover:text-foreground transition-colors">Funções</a>
              <a href="#features" className="hover:text-foreground transition-colors">Funcionalidades</a>
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

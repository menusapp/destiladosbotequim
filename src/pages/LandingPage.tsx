import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { TypingEffect } from "@/components/landing/TypingEffect";
import menusLogo from "@/assets/menus-logo.png";
import heroDashboard from "@/assets/landing-hero-dashboard.jpg";
import {
  ArrowRight, Check, ChevronRight, Zap, Star,
  QrCode, ShoppingCart, Utensils, Package,
  BarChart3, MessageSquare, Truck,
  Smartphone, TrendingUp, Megaphone, CreditCard,
  Shield, Clock, Printer, Bot,
  BadgePercent,
  AlertTriangle, DollarSign,
  Receipt, CalendarCheck,
  Pizza, Coffee, Beer, Sandwich, ChefHat,
  CheckCircle2,
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
  { q: "Preciso instalar algum aplicativo?", a: "Não! O Menus App funciona 100% no navegador. Seus clientes acessam o cardápio pelo link ou QR Code sem baixar nada. Funciona em qualquer dispositivo." },
  { q: "Posso cancelar a qualquer momento?", a: "Sim, sem fidelidade e sem multa. Cancele quando quiser." },
  { q: "Como funciona o delivery?", a: "Você tem seu próprio sistema de delivery com zonas de entrega, taxas configuráveis e acompanhamento de pedidos. Zero comissão." },
  { q: "O sistema emite nota fiscal?", a: "Sim! No plano Avançado você tem emissão de NFC-e integrada diretamente ao SEFAZ." },
  { q: "Como funciona o Robô IA?", a: "O Robô IA conversa com seus clientes pelo WhatsApp, sugere produtos, tira dúvidas e finaliza pedidos automaticamente." },
  { q: "Como funciona o marketing por WhatsApp?", a: "Crie campanhas automáticas de remarketing. Cliente inativo recebe cupom, pedido confirmado dispara notificação — tudo sem você levantar um dedo." },
];

/* ── Pain Points ── */
const painPoints = [
  {
    icon: BarChart3,
    pain: "Você não sabe quanto realmente lucra no final do mês",
    solution: "DRE automático e fluxo de caixa em tempo real",
  },
  {
    icon: AlertTriangle,
    pain: "Pedidos se perdem entre WhatsApp, telefone e balcão",
    solution: "Todos os pedidos centralizados num único painel",
  },
  {
    icon: DollarSign,
    pain: "Comissões de apps de delivery corroem seu lucro",
    solution: "Delivery próprio com zero comissão por pedido",
  },
  {
    icon: Package,
    pain: "Falta de controle gera desperdício de estoque",
    solution: "Estoque com baixa automática e alertas",
  },
];

/* ── All Features (grid) ── */
const allFeatures = [
  { icon: QrCode, title: "Cardápio digital", desc: "QR Code, sua marca e fotos." },
  { icon: Truck, title: "Delivery sem comissão", desc: "Zonas, taxas e zero comissão." },
  { icon: ShoppingCart, title: "PDV completo", desc: "Atalhos, busca e split." },
  { icon: Bot, title: "Robô IA Vendedor", desc: "Vende no WhatsApp 24h." },
  { icon: Package, title: "Estoque automático", desc: "Baixa automática e alertas." },
  { icon: BarChart3, title: "Relatórios e DRE", desc: "Vendas, fluxo e margens." },
  { icon: Receipt, title: "NFC-e integrada", desc: "Nota fiscal direto ao SEFAZ." },
  { icon: BadgePercent, title: "Fidelidade e CRM", desc: "Pontos, cupons e recompensas." },
  { icon: Megaphone, title: "Marketing WhatsApp", desc: "Campanhas e remarketing." },
  { icon: CreditCard, title: "Pagamento online", desc: "Pix e cartão integrados." },
  { icon: Printer, title: "Impressão automática", desc: "Pedidos direto na cozinha." },
  { icon: CalendarCheck, title: "Reservas de mesas", desc: "Reservas online e visual." },
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
            <img src={menusLogo} alt="Menus App" className="h-9 w-9" />
            <span className="text-2xl font-bold text-foreground tracking-tight">Menu's</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            {[
              { href: "#funcoes", label: "Funções" },
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
              Começar agora
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
              <Star className="h-4 w-4 fill-primary" />
              Usado por mais de 500 restaurantes
            </div>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground tracking-[-0.03em] leading-[1.1]">
              O sistema completo para
              <br />
              <span className="inline-block min-h-[1.2em]">
                <TypingEffect />
              </span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Cardápio digital, pedidos online, delivery, estoque automático, financeiro, marketing e muito mais.{" "}
              <strong className="text-foreground">Tudo em uma só plataforma.</strong>
            </p>
          </ScrollReveal>

          <ScrollReveal delay={300}>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="text-lg px-10 h-14 font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] transition-all" onClick={() => navigate("/register")}>
                Começar agora
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8 h-14 font-semibold" onClick={() => document.getElementById("vantagens")?.scrollIntoView({ behavior: "smooth" })}>
                Ver vantagens
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              7 dias grátis • Sem cartão • Setup em 2 minutos
            </p>
          </ScrollReveal>

          <ScrollReveal delay={400}>
            <div className="mt-12 mx-auto max-w-4xl">
              <div className="rounded-2xl border border-border shadow-2xl shadow-primary/10 overflow-hidden">
                <img src={heroDashboard} alt="Dashboard do Menus App — sistema de gestão para restaurantes" className="w-full h-auto" />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ 1. SEÇÃO DE DOR → SOLUÇÃO ═══ */}
      <section className="py-16 sm:py-20 bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">
              Você pode estar <span className="text-destructive">perdendo dinheiro</span> todos os dias
            </h2>
            <p className="mt-3 text-lg text-muted-foreground max-w-xl mx-auto">
              Essas dores são comuns — e nós resolvemos cada uma delas.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {painPoints.map((item, i) => (
              <ScrollReveal key={i} delay={i * 80}>
                <div className="p-5 rounded-xl border border-border bg-card hover:shadow-md transition-shadow h-full">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                      <item.icon className="h-5 w-5 text-destructive" />
                    </div>
                    <p className="text-base font-semibold text-foreground leading-snug">{item.pain}</p>
                  </div>
                  <div className="flex items-start gap-3 pl-1">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm text-primary font-medium leading-snug">{item.solution}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 2. COMO FUNCIONA (3 PASSOS) ═══ */}
      <section className="py-16 sm:py-20 bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">Passo a passo</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">Como começar?</h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { num: "01", icon: Smartphone, title: "Crie sua conta", desc: "Cadastro rápido em poucos minutos. Sem complicação." },
              { num: "02", icon: QrCode, title: "Configure seu cardápio", desc: "Adicione produtos, fotos, preços e complementos." },
              { num: "03", icon: ShoppingCart, title: "Comece a vender", desc: "Compartilhe o QR Code e receba pedidos na hora." },
            ].map((s, i) => (
              <ScrollReveal key={s.num} delay={i * 120}>
                <div className="text-center space-y-4 p-6 rounded-2xl border border-border bg-background hover:shadow-lg hover:border-primary/20 transition-all">
                  <div className="text-4xl font-extrabold text-primary/20">{s.num}</div>
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                    <s.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{s.title}</h3>
                  <p className="text-base text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={400}>
            <p className="text-center mt-8 text-base font-semibold text-muted-foreground">
              Sem instalação. Sem complicação. Funciona em qualquer dispositivo.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ 3. OPERAÇÃO — GESTOR DE PEDIDOS ═══ */}
      <section className="py-16 sm:py-20 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <ScrollReveal>
              <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-4">Operação</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em] leading-tight">
                Gestor de pedidos <span className="text-primary">completo</span>
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                PDV integrado, comandas digitais, gestão visual de mesas e confirmação automática de pedidos. Do balcão ao delivery num só lugar.
              </p>
              <ul className="mt-6 space-y-3">
                {["PDV completo com atalhos", "Comandas digitais por mesa", "Gestão visual de mesas", "Confirmação automática de pedidos", "Totem de autoatendimento"].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-base text-foreground font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </ScrollReveal>
            <ScrollReveal delay={200}>
              <div className="rounded-2xl border border-border shadow-xl overflow-hidden bg-card">
                <div className="p-6 space-y-4">
                  {[
                    { label: "Pedido #1042", status: "Preparando", color: "bg-warning" },
                    { label: "Pedido #1043", status: "Novo", color: "bg-primary" },
                    { label: "Pedido #1041", status: "Pronto", color: "bg-[hsl(var(--success))]" },
                  ].map((o) => (
                    <div key={o.label} className="flex items-center justify-between p-4 rounded-xl border border-border bg-background">
                      <div>
                        <p className="font-bold text-foreground">{o.label}</p>
                        <p className="text-sm text-muted-foreground">2x Hambúrguer, 1x Batata</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold text-primary-foreground ${o.color}`}>{o.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ═══ 4. FINANCEIRO ═══ */}
      <section className="py-16 sm:py-20 bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <ScrollReveal delay={200} className="order-2 lg:order-1">
              <div className="rounded-2xl border border-border shadow-xl overflow-hidden bg-background p-6">
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-foreground">DRE — Maio/2025</h4>
                    <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">Automático</span>
                  </div>
                  {[
                    { label: "Receita Bruta", value: "R$ 48.500", positive: true },
                    { label: "CMV", value: "- R$ 14.550", positive: false },
                    { label: "Custos Fixos", value: "- R$ 8.200", positive: false },
                    { label: "Lucro Líquido", value: "R$ 25.750", positive: true, bold: true },
                  ].map((row) => (
                    <div key={row.label} className={`flex items-center justify-between py-2 ${row.bold ? "border-t border-border pt-3" : ""}`}>
                      <span className={`text-sm ${row.bold ? "font-bold text-foreground" : "text-muted-foreground"}`}>{row.label}</span>
                      <span className={`text-sm font-bold ${row.positive ? "text-[hsl(var(--success))]" : "text-destructive"}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollReveal>
            <ScrollReveal className="order-1 lg:order-2">
              <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-4">Financeiro</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em] leading-tight">
                Visão completa do <span className="text-primary">seu negócio</span>
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                DRE automático, fluxo de caixa diário, CMV por produto, custos fixos e variáveis — tudo calculado a partir das suas vendas reais. Pare de usar planilha.
              </p>
              <ul className="mt-6 space-y-3">
                {["DRE automático mensal", "Fluxo de caixa em tempo real", "CMV por produto", "Margens e lucratividade"].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-base text-foreground font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ═══ 5. TUDO QUE SEU RESTAURANTE PRECISA — GRID ═══ */}
      <section id="funcoes" className="py-16 sm:py-20 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">Funções</span>
            <h2 id="vantagens" className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">Tudo que seu restaurante precisa</h2>
            <p className="mt-3 text-lg text-muted-foreground max-w-xl mx-auto">
              Um sistema completo que substitui dezenas de ferramentas.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {allFeatures.map((f, i) => (
              <ScrollReveal key={i} delay={i * 50}>
                <div className="p-4 rounded-xl border border-border bg-card hover:shadow-md hover:border-primary/20 transition-all h-full">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground mb-1">{f.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ 6. PROVA SOCIAL ═══ */}
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

          <ScrollReveal delay={300}>
            <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center max-w-3xl mx-auto">
              {[
                { value: "500+", label: "Restaurantes ativos" },
                { value: "50k+", label: "Pedidos por mês" },
                { value: "4.9/5", label: "Avaliação dos clientes" },
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

      {/* ═══ 7. SEGMENTOS ═══ */}
      <section className="py-16 sm:py-20 bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">Segmentos</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">
              Versátil para diversos segmentos
            </h2>
            <p className="mt-3 text-lg text-muted-foreground">O Menu's se adapta ao seu tipo de negócio.</p>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              {[
                { icon: Utensils, label: "Restaurante" },
                { icon: Sandwich, label: "Hamburgueria" },
                { icon: Pizza, label: "Pizzaria" },
                { icon: Beer, label: "Bar" },
                { icon: Coffee, label: "Cafeteria" },
                { icon: ChefHat, label: "E muito mais!" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2.5 px-5 py-3 rounded-full border border-border bg-card text-sm font-semibold text-foreground hover:border-primary/30 hover:shadow-sm transition-all">
                  <s.icon className="h-5 w-5 text-primary" />
                  {s.label}
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ 8. OFERTA / TESTE GRÁTIS ═══ */}
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

      {/* ═══ 9. PRICING ═══ */}
      <section id="pricing" className="py-16 sm:py-20 bg-card relative overflow-hidden">
        <div className="absolute top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.04] blur-[120px] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <ScrollReveal className="text-center mb-14">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">Planos & Preços</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-[-0.025em]">Escolha o plano ideal</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">Sem fidelidade, sem multa. Comece agora e mude quando quiser.</p>
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

      {/* ═══ 10. FAQ ═══ */}
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


      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-border bg-card py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <img src={menusLogo} alt="Menus App" className="h-8 w-8" />
              <span className="text-lg font-bold text-foreground tracking-tight">Menu's</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#funcoes" className="hover:text-foreground transition-colors">Funções</a>
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

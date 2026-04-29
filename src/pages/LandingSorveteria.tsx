import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getActiveAdminRedirectPath } from "@/lib/sessionExpiry";
import { trackEvent } from "@/lib/metaPixel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { TypingEffect } from "@/components/landing/TypingEffect";
import PhoneMockup from "@/components/landing/PhoneMockup";
import SavingsSimulator from "@/components/landing/SavingsSimulator";
import { NicheHeroDecor, NicheBadge } from "@/components/landing/NicheHeroDecor";
import { NicheExtraSection } from "@/components/landing/NicheExtraSection";
import menusLogo from "@/assets/menus-logo.png";
import landingPdv from "@/assets/landing-pdv.jpg";
import landingDre from "@/assets/landing-dre.png";
import landingWhatsapp from "@/assets/landing-whatsapp.png";
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
  CheckCircle2, Store, Users,
} from "lucide-react";

/* ── Niche-specific copy ── */
const TYPING_WORDS: string[] = ["sua sorveteria", "seu delivery de sorvetes", "sua gelateria"];
const HERO_BADGE = "Usado por mais de 60 sorveterias";
const HERO_METRICS = [
  { value: "Até 40%", label: "mais pedidos em dias quentes" },
  { value: "Cardápio visual", label: "de sabores que conquista" },
  { value: "Fidelização", label: "de clientes recorrentes" },
];
const CTA_FINAL_TITLE = "Pronto para sua sorveteria vender mais o ano todo?";
const PIXEL_CONTENT_NAME = "Landing Sorveteria";

/* ── Plans ── */
const plans = [
  {
    name: "Básico", price: "69,90", daily: "R$ 2,33/dia", description: "Para começar a digitalizar", highlighted: false,
    features: ["Cardápio digital ilimitado", "QR Code para mesas", "Pedidos em tempo real", "1 usuário administrador", "Suporte por email"],
    cta: "Escolher este plano", planSlug: "basico",
  },
  {
    name: "Intermediário", price: "149,90", daily: "R$ 5,00/dia", description: "Para crescer com eficiência", highlighted: false,
    features: ["Tudo do Básico", "Delivery completo", "Gestão de estoque & CMV", "Relatórios e DRE", "Programa de fidelidade", "Até 5 usuários", "Suporte prioritário"],
    cta: "Escolher este plano", planSlug: "intermediario",
  },
  {
    name: "Avançado", price: "249,90", daily: "R$ 8,33/dia", description: "Solução completa", highlighted: true,
    features: ["Tudo do Intermediário", "Robô IA Vendedor", "Marketing WhatsApp", "Remarketing automático", "Nota fiscal eletrônica", "Fluxo de caixa & DRE", "Reservas online", "Usuários ilimitados", "Suporte VIP"],
    cta: "Escolher este plano", planSlug: "avancado",
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

/* ── Pain Points (niche-specific) ── */
const painPoints = [
  { icon: QrCode, pain: "Cardápio de sabores em papel fica desatualizado toda semana", solution: "Cardápio digital atualizado em segundos com foto de cada sabor" },
  { icon: Smartphone, pain: "Em dias quentes o atendimento não dá conta da demanda", solution: "Totem de autoatendimento e QR Code para pedidos sem fila" },
  { icon: BarChart3, pain: "Você não sabe quais sabores vendem mais e quais geram desperdício", solution: "Relatório de vendas por produto com estoque automático" },
  { icon: Megaphone, pain: "Clientes somem no inverno e você perde receita", solution: "Remarketing automático no WhatsApp reativa clientes inativos" },
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

/* ── Selling modes (niche-specific) ── */
const sellingModes = [
  { icon: QrCode, title: "QR Code na loja", desc: "Cliente vê os sabores com fotos no celular e pede sem fila.", cta: "Começar agora" },
  { icon: Smartphone, title: "Totem de autoatendimento", desc: "Totem para dias quentes: pedido sem fila, caixa liberado.", cta: "Experimentar" },
  { icon: Truck, title: "Delivery de sorvetes", desc: "Entrega própria com taxa zero. Cardápio com fotos de cada sabor.", cta: "Criar cardápio grátis" },
  { icon: Store, title: "Retirada no balcão", desc: "Pedido antecipado para retirada. Acabe com a fila.", cta: "Ver demonstração" },
];

/* ── Tabs do Painel Admin ── */
const adminTabs = [
  {
    id: "pedidos", label: "Pedidos", image: landingPdv,
    title: "Gestor de pedidos completo",
    desc: "PDV integrado, comandas digitais, gestão visual de mesas e confirmação automática de pedidos. Do balcão ao delivery num só lugar.",
    bullets: ["PDV completo com atalhos", "Comandas digitais por mesa", "Gestão visual de mesas", "Confirmação automática", "Totem de autoatendimento"],
  },
  {
    id: "financeiro", label: "Financeiro", image: landingDre,
    title: "Visão completa do seu negócio",
    desc: "DRE automático, fluxo de caixa diário, CMV por produto, custos fixos e variáveis — tudo calculado a partir das vendas reais. Pare de usar planilha.",
    bullets: ["DRE automático mensal", "Fluxo de caixa em tempo real", "CMV por produto", "Margens e lucratividade"],
  },
  {
    id: "whatsapp", label: "WhatsApp", image: landingWhatsapp,
    title: "Marketing automático no WhatsApp",
    desc: "Campanhas de remarketing que disparam sozinhas. Cliente inativo recebe cupom, pedido confirmado vira notificação — sem você levantar um dedo.",
    bullets: ["Remarketing automático", "Cupons personalizados", "Notificações de pedido", "Segmentação inteligente"],
  },
];

const adminTabChips = ["Cardápio", "Pedidos", "Clientes", "Pagamentos", "Entregas", "Relatórios", "WhatsApp", "QR Codes"];

/* ── Testimonials (niche-specific) ── */
const testimonials = [
  { name: "Letícia A.", role: "Gelateria Bella", text: "O cardápio digital com fotos dos sabores aumentou o ticket em 45%. Cliente pede mais quando vê a foto." },
  { name: "Rodrigo M.", role: "Sorveteria do Parque", text: "No verão o totem eliminou a fila. Vendi 3x mais sem contratar mais funcionário." },
  { name: "Sandra P.", role: "Sorvetes Artesanais", text: "No inverno o remarketing do WhatsApp traz clientes de volta. Mantive o faturamento o ano todo." },
];

/* ── Component ── */
const LandingSorveteria = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(adminTabs[0].id);

  useEffect(() => {
    const path = getActiveAdminRedirectPath();
    if (path) navigate(path, { replace: true });
  }, [navigate]);

  useEffect(() => {
    trackEvent("ViewContent", {
      content_name: PIXEL_CONTENT_NAME,
      content_category: "landing",
    });
  }, []);

  const currentTab = adminTabs.find((t) => t.id === activeTab) ?? adminTabs[0];

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
              { href: "#solucoes", label: "Soluções" },
              { href: "#vantagens", label: "Vantagens" },
              { href: "#funcoes", label: "Recursos" },
              { href: "#pricing", label: "Preços" },
            ].map((l) => (
              <a key={l.href} href={l.href} className="text-base font-medium text-muted-foreground hover:text-foreground transition-colors">{l.label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="text-sm sm:text-base font-medium px-2 sm:px-3" onClick={() => navigate("/login")}>
              Entrar
            </Button>
            <Button size="sm" className="font-semibold text-sm sm:text-base shadow-md shadow-primary/20 px-3 sm:px-4 rounded-full" onClick={() => navigate("/registro/trial")}>
              Começar grátis
            </Button>
          </div>
        </div>
      </header>

      {/* ═══ HERO ═══ */}
      <section className="relative overflow-hidden bg-card">
        <div className="absolute inset-0 bg-gradient-to-b from-pink-500/[0.08] via-purple-500/[0.04] to-transparent" />
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full bg-purple-500/[0.10] blur-[120px] pointer-events-none" />

        <NicheHeroDecor
          bgPatternEmoji="🍦"
          keyframes={`
            @keyframes drip { 0%,100%{transform:translateY(0) rotate(-5deg)} 50%{transform:translateY(-18px) rotate(5deg)} } @keyframes scoop-bounce { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-15px) scale(1.1)} }
          `}
          emojis={[
            { emoji: "🍦", className: "top-[8%] left-[6%] text-6xl sm:text-7xl [animation:drip_5s_ease-in-out_infinite]" },
            { emoji: "🍨", className: "top-[16%] right-[7%] text-5xl sm:text-6xl [animation:scoop-bounce_6s_ease-in-out_infinite]" },
            { emoji: "🍧", className: "bottom-[26%] left-[5%] hidden md:block text-5xl sm:text-6xl [animation:drip_7s_ease-in-out_infinite]" },
            { emoji: "🎂", className: "bottom-[14%] right-[6%] text-5xl sm:text-6xl [animation:scoop-bounce_5.5s_ease-in-out_infinite]" },
            { emoji: "⭐", className: "top-[40%] left-[3%] hidden lg:block text-4xl sm:text-5xl [animation:drip_8s_ease-in-out_infinite]" },
          ]}
        />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 sm:pt-24 sm:pb-16 text-center">
          <ScrollReveal>
            <NicheBadge bgClass="bg-pink-500/15 text-pink-700 border-pink-500/30">
              🍦 {HERO_BADGE}
            </NicheBadge>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground tracking-[-0.03em] leading-[1.05]">
              A solução completa para
              <br />
              <span className="inline-block min-h-[1.2em] text-primary">
                <TypingEffect words={TYPING_WORDS} />
              </span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <div className="mt-10 flex flex-wrap items-start justify-center gap-x-12 gap-y-4">
              {HERO_METRICS.map((m) => (
                <div key={m.label} className="text-center">
                  <p className="text-lg sm:text-xl font-extrabold text-foreground">{m.value}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={300}>
            <div className="mt-10 flex flex-col items-center gap-3">
              <Button
                size="lg"
                className="text-base sm:text-lg px-10 h-14 font-bold rounded-full shadow-xl shadow-primary/25 hover:shadow-2xl hover:shadow-primary/30 hover:scale-[1.02] transition-all"
                onClick={() => navigate("/registro/trial")}
              >
                Começar grátis agora
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <p className="text-sm text-muted-foreground">7 dias grátis • Sem cartão • Setup em 2 minutos</p>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={400}>
            <div className="mt-14 mx-auto max-w-md">
              <PhoneMockup />
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ STATS ═══ */}
      <section className="py-16 sm:py-20 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">
              Por que escolher o <span className="text-primary">Menu's</span>?
            </h2>
          </ScrollReveal>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {[
              { value: "+500", label: "restaurantes atendidos" },
              { value: "+50k", label: "pedidos por mês" },
              { value: "4.9/5", label: "avaliação dos clientes" },
              { value: "0%", label: "taxa sobre vendas" },
            ].map((s, i) => (
              <ScrollReveal key={s.label} delay={i * 100}>
                <div className="text-center">
                  <div className="text-4xl sm:text-5xl font-extrabold text-primary tracking-tight">{s.value}</div>
                  <p className="text-sm text-muted-foreground mt-2 font-medium">{s.label}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SOLUÇÕES ═══ */}
      <section id="solucoes" className="py-16 sm:py-20 bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">Soluções</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">
              Autoatendimento para delivery, mesa e balcão
            </h2>
            <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
              Em um só lugar, tudo que você precisa para resolver os desafios de atendimento do seu restaurante.
            </p>
          </ScrollReveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {sellingModes.map((m, i) => (
              <ScrollReveal key={m.title} delay={i * 100}>
                <div className="group p-6 rounded-2xl border border-border bg-background hover:shadow-xl hover:border-primary/30 hover:-translate-y-1 transition-all h-full flex flex-col">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                    <m.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">{m.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">{m.desc}</p>
                  <button onClick={() => navigate("/registro/trial")} className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:gap-2 transition-all">
                    {m.cta}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ DORES → SOLUÇÃO ═══ */}
      <section id="vantagens" className="py-16 sm:py-20 bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">Vantagens</span>
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

      {/* ═══ PAINEL ADMIN ═══ */}
      <section className="py-16 sm:py-20 bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">Painel</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">
              Painel Administrativo Completo
            </h2>
            <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
              Gerencie cardápio, pedidos, clientes e muito mais em um só lugar.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
              {adminTabChips.map((c) => (
                <span key={c} className="px-3.5 py-1.5 rounded-full border border-border bg-background text-xs font-semibold text-muted-foreground">
                  {c}
                </span>
              ))}
            </div>
          </ScrollReveal>
          <ScrollReveal delay={150}>
            <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
              {adminTabs.map((t) => (
                <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${activeTab === t.id ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" : "bg-background text-muted-foreground hover:text-foreground border border-border"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </ScrollReveal>
          <ScrollReveal delay={200}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div className="rounded-2xl border border-border shadow-xl overflow-hidden bg-background">
                <img src={currentTab.image} alt={currentTab.title} className="w-full h-auto" />
              </div>
              <div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-[-0.025em] leading-tight">
                  {currentTab.title}
                </h3>
                <p className="mt-4 text-lg text-muted-foreground leading-relaxed">{currentTab.desc}</p>
                <ul className="mt-6 space-y-3">
                  {currentTab.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-3">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Check className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-base text-foreground font-medium">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ COMO COMEÇAR ═══ */}
      <section className="py-16 sm:py-20 bg-background">
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
                <div className="text-center space-y-4 p-6 rounded-2xl border border-border bg-card hover:shadow-lg hover:border-primary/20 transition-all">
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
        </div>
      </section>

      {/* ═══ FUNÇÕES ═══ */}
      <section id="funcoes" className="py-16 sm:py-20 bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">Recursos</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">Tudo que seu restaurante precisa</h2>
            <p className="mt-3 text-lg text-muted-foreground max-w-xl mx-auto">
              Um sistema completo que substitui dezenas de ferramentas.
            </p>
          </ScrollReveal>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {allFeatures.map((f, i) => (
              <ScrollReveal key={i} delay={i * 50}>
                <div className="p-4 rounded-xl border border-border bg-background hover:shadow-md hover:border-primary/20 transition-all h-full">
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

      {/* ═══ DEPOIMENTOS ═══ */}
      <section className="py-16 sm:py-20 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">Depoimentos</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">Quem usa, recomenda</h2>
          </ScrollReveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
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
        </div>
      </section>

      {/* ═══ SEGMENTOS ═══ */}
      <section className="py-16 sm:py-20 bg-card">
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
                <div key={s.label} className="flex items-center gap-2.5 px-5 py-3 rounded-full border border-border bg-background text-sm font-semibold text-foreground hover:border-primary/30 hover:shadow-sm transition-all">
                  <s.icon className="h-5 w-5 text-primary" />
                  {s.label}
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ NICHE EXCLUSIVE ═══ */}
      <NicheExtraSection
        eyebrow="Sorveteria"
        title={<>Sabores que conquistam o <span class="text-pink-200">ano todo</span></>}
        subtitle="Cardápio visual cheio de cor, fidelidade automática e sabor para cada estação do ano."
        bgStyle="linear-gradient(135deg, #DB2777 0%, #9333EA 100%)"
        cardClass="bg-white/15 border-white/30 backdrop-blur-sm"
        titleClass="text-white"
        textClass="text-white/90"
        cards={[
          { emoji: "☀️", title: "Verão de sorvete", desc: "Vitrine digital com fotos lindas de cada sabor. Ticket médio sobe quando o cliente vê." },
          { emoji: "☕", title: "Inverno do chocolate quente", desc: "Cardápio sazonal em 1 clique. Mude a vitrine entre estações sem refazer nada." },
          { emoji: "🎉", title: "Festas e fidelidade", desc: "Programa de pontos automático: 10 sorvetes = 1 grátis. Cliente volta toda semana." },
        ]}
      />

      {/* ═══ SIMULADOR ═══ */}
      <section className="py-16 sm:py-20 bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">Calculadora</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-[-0.025em]">
              Quanto seu restaurante pode faturar a mais?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Mexa nos sliders e veja sua projeção de receita com Menu's.
            </p>
          </ScrollReveal>
          <ScrollReveal delay={150}>
            <SavingsSimulator registerUrl="/registro/trial" />
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section id="pricing" className="py-16 sm:py-20 bg-background relative overflow-hidden">
        <div className="absolute top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.04] blur-[120px] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <ScrollReveal className="text-center mb-14">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">Planos & Preços</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-[-0.025em]">
              Planos para cada momento do seu restaurante
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
              Sem fidelidade, sem multa. Comece agora e mude quando quiser.
            </p>
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
                      className={`w-full mt-8 h-12 font-bold text-base hover:scale-[1.02] transition-all rounded-full ${plan.highlighted ? "shadow-lg shadow-primary/25" : ""}`}
                      variant={plan.highlighted ? "default" : "outline"}
                      onClick={() => {
                        const value = parseFloat(plan.price.replace(",", "."));
                        trackEvent("AddToCart", {
                          content_name: `Plano ${plan.name}`,
                          content_ids: [plan.planSlug],
                          content_type: "subscription_plan",
                          value,
                          currency: "BRL",
                        });
                        navigate(`/registro/${plan.planSlug}`);
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
          <ScrollReveal delay={400}>
            <p className="text-center mt-8 text-sm text-muted-foreground">
              Cancele a qualquer momento • Sem taxas por pedido • Pagamento seguro
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section id="faq" className="py-16 sm:py-20 bg-card">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">FAQ</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">Perguntas frequentes</h2>
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-xl px-6 bg-background data-[state=open]:shadow-md transition-shadow">
                  <AccordionTrigger className="text-left text-base font-semibold text-foreground hover:no-underline py-5">{faq.q}</AccordionTrigger>
                  <AccordionContent className="text-base text-muted-foreground leading-relaxed pb-5">{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ CTA FINAL ═══ */}
      <section className="py-16 sm:py-20 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #DB2777 0%, #9333EA 100%)' }}>
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-10 select-none text-[8rem] flex items-center justify-around">
          <span>🍦</span><span className="hidden sm:inline">🍨</span><span>🎂</span>
        </div>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-[-0.025em]">
              {CTA_FINAL_TITLE}
            </h2>
            <p className="mt-4 text-lg text-white/85 max-w-xl mx-auto leading-relaxed">
              Comece agora mesmo, é grátis. Sem cartão de crédito.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm font-semibold text-white/90">
              <span className="flex items-center gap-1.5"><Shield className="h-4 w-4" /> Sem cartão</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4" /> Sem risco</span>
              <span className="flex items-center gap-1.5"><Zap className="h-4 w-4" /> Setup em 2 min</span>
            </div>
            <div className="mt-8">
              <Button
                size="lg"
                className="text-lg px-10 h-14 font-bold rounded-full bg-white text-primary hover:bg-white/90 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all"
                onClick={() => navigate("/registro/trial")}
              >
                Começar grátis agora
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
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
              <a href="#solucoes" className="hover:text-foreground transition-colors">Soluções</a>
              <a href="#vantagens" className="hover:text-foreground transition-colors">Vantagens</a>
              <a href="#funcoes" className="hover:text-foreground transition-colors">Recursos</a>
              <a href="#pricing" className="hover:text-foreground transition-colors">Preços</a>
            </div>
            <div className="flex flex-col items-center md:items-end gap-1">
              <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} Menu's. Todos os direitos reservados.</p>
              <p className="text-xs text-muted-foreground/60">Parceiro de integração iFood</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingSorveteria;

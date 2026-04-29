import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getActiveAdminRedirectPath } from "@/lib/sessionExpiry";
import { trackEvent } from "@/lib/metaPixel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import menusLogo from "@/assets/menus-logo.png";
import dashboardMockup from "@/assets/landing-dashboard-mockup.png";
import landingPdv from "@/assets/landing-pdv.jpg";
import landingPedidos from "@/assets/landing-pedidos.png";
import landingClientes from "@/assets/landing-clientes.png";
import landingPagamentos from "@/assets/landing-pagamentos.png";
import landingQrcodes from "@/assets/landing-qrcodes.png";
import landingDre from "@/assets/landing-dre.png";
import landingWhatsapp from "@/assets/landing-whatsapp.png";
import landingTotem from "@/assets/landing-totem.png";
import landingGarcom from "@/assets/landing-garcom.png";
import {
  ArrowRight, Check, Star,
  QrCode, ShoppingCart, Utensils, Package,
  BarChart3, Truck,
  Smartphone, Megaphone, CreditCard,
  Printer, Bot,
  BadgePercent,
  TrendingDown, DollarSign,
  Receipt, CalendarCheck,
  Pizza, Coffee, Beer, Sandwich, ChefHat,
  Store, Rocket, MessageCircle, Sparkles,
  Tablet, Hand, Zap, Users,
} from "lucide-react";

const WHATSAPP_URL = `https://wa.me/5514999001166?text=${encodeURIComponent("Olá! Vim pelo site e tenho interesse no sistema. Tenho um restaurante e quero aumentar meus pedidos e automatizar meu atendimento. Pode me explicar como funciona?")}`;
const REGISTER_URL = "https://menusapp.com.br/registro/avancado";

/* ── Plans (V2) ── */
const plans = [
  {
    name: "BÁSICO", price: "69,90", perDay: "≈ R$ 2,33/dia", featured: false,
    planSlug: "basico",
    features: ["Cardápio digital ilimitado", "QR Code para mesas", "Pedidos em tempo real", "1 usuário administrador", "Suporte por email"],
  },
  {
    name: "INTERMEDIÁRIO", price: "149,90", perDay: "≈ R$ 5,00/dia", featured: true,
    planSlug: "intermediario",
    features: ["Tudo do Básico", "Delivery completo (0% taxa)", "Gestão de estoque e CMV", "Relatórios e DRE", "Programa de fidelidade", "Até 5 usuários", "Suporte prioritário"],
  },
  {
    name: "AVANÇADO", price: "249,90", perDay: "≈ R$ 8,33/dia", featured: false,
    planSlug: "avancado",
    features: ["Tudo do Intermediário", "Robô IA Vendedor", "Marketing WhatsApp", "Remarketing automático", "Nota fiscal eletrônica", "Usuários ilimitados", "Suporte VIP"],
  },
];

/* ── FAQs ── */
const faqs = [
  { q: "Preciso instalar algum aplicativo?", a: "Não! O Menu's App funciona 100% no navegador. Seus clientes acessam o cardápio pelo link ou QR Code sem baixar nada." },
  { q: "Posso cancelar a qualquer momento?", a: "Sim, sem fidelidade e sem multa. Cancele quando quiser." },
  { q: "Como funciona o delivery?", a: "Você tem seu próprio sistema de delivery com zonas de entrega, taxas configuráveis e acompanhamento de pedidos. Zero comissão." },
  { q: "O sistema emite nota fiscal?", a: "Sim! No plano Avançado você tem emissão de NFC-e integrada diretamente ao SEFAZ." },
  { q: "Como funciona o Robô IA?", a: "O Robô IA conversa com seus clientes pelo WhatsApp, sugere produtos, tira dúvidas e finaliza pedidos automaticamente." },
  { q: "Como funciona o marketing por WhatsApp?", a: "Crie campanhas automáticas de remarketing. Cliente inativo recebe cupom, pedido confirmado dispara notificação — tudo sem você levantar um dedo." },
];

/* ── Vantagens (V2 Pain Points) ── */
const painPointsV2 = [
  { icon: TrendingDown, title: "Não sabe quanto lucra de verdade", text: "Sem DRE e fluxo de caixa em tempo real fica impossível tomar decisões certas." },
  { icon: Smartphone, title: "Pedidos se perdem no WhatsApp", text: "Sem centralização, erros de pedido e atraso na entrega viram rotina." },
  { icon: DollarSign, title: "Apps de delivery comem sua margem", text: "30% de comissão por pedido é dinheiro que poderia ficar no seu bolso." },
  { icon: Package, title: "Estoque descontrolado vira prejuízo", text: "Sem controle automático, falta de produto na hora errada custa caro." },
];

/* ── Soluções (original) ── */
const sellingModes = [
  { icon: Truck, title: "Delivery", desc: "Pedidos no seu próprio link, sem comissão e com Robô IA atendendo no WhatsApp.", cta: "Criar cardápio grátis" },
  { icon: QrCode, title: "QR Code na Mesa", desc: "Cardápio interativo: o cliente abre no celular, escolhe e pede sem chamar o garçom.", cta: "Começar agora" },
  { icon: Store, title: "Retirada no Balcão", desc: "Pedido rápido para quem prefere buscar. Tempo de retirada e fila integrados.", cta: "Ver demonstração" },
  { icon: Utensils, title: "Comanda na Mesa", desc: "Comanda digital para restaurantes e bares. Fechamento de conta por mesa em segundos.", cta: "Experimentar" },
];

/* ── All Features (original) ── */
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

/* ── Tabs do Painel ── */
const adminTabs = [
  {
    id: "cardapio", label: "Cardápio", image: landingPdv,
    title: "Cardápio digital completo",
    desc: "Monte seu cardápio com fotos, categorias, complementos e variações. Atualize preços em tempo real e publique para todos os canais com um clique.",
    bullets: ["Fotos e descrições ilimitadas", "Categorias e complementos", "Atualização em tempo real", "Publicação multicanal"],
  },
  {
    id: "pedidos", label: "Pedidos", image: landingPedidos,
    title: "Gestor de pedidos completo",
    desc: "PDV integrado, comandas digitais, gestão visual de mesas e confirmação automática de pedidos. Do balcão ao delivery num só lugar.",
    bullets: ["PDV completo com atalhos", "Comandas digitais por mesa", "Gestão visual de mesas", "Confirmação automática", "Totem de autoatendimento"],
  },
  {
    id: "clientes", label: "Clientes", image: landingClientes,
    title: "Base de clientes inteligente",
    desc: "Conheça quem compra de você. Histórico de pedidos, ticket médio, frequência e segmentação automática para campanhas certeiras.",
    bullets: ["Histórico completo de compras", "Segmentação automática", "Programa de fidelidade", "Aniversariantes do mês"],
  },
  {
    id: "pagamentos", label: "Pagamentos", image: landingPagamentos,
    title: "Pagamentos integrados e seguros",
    desc: "Aceite Pix, cartão e dinheiro com conciliação automática. Split de pagamento, troco e taxas controladas no painel.",
    bullets: ["Pix e cartão integrados", "Split de pagamento", "Conciliação automática", "Controle de taxas"],
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
  {
    id: "qrcodes", label: "QR Codes", image: landingQrcodes,
    title: "QR Codes para mesas e divulgação",
    desc: "Gere QR Codes ilimitados para mesas, balcão, totem e materiais impressos. Cada código rastreia origem dos pedidos para você medir o que funciona.",
    bullets: ["QR Codes ilimitados", "Rastreamento por origem", "Personalização visual", "Impressão fácil em qualquer formato"],
  },
];

const goRegister = () => { window.location.href = REGISTER_URL; };
const openWhatsApp = () => { window.open(WHATSAPP_URL, "_blank", "noopener"); };

/* ── Floating WhatsApp ── */
const WhatsAppFloat = () => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 300);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener"
      className={`fixed bottom-6 right-6 z-50 inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1FB959] text-white font-bold px-5 py-3.5 rounded-full shadow-2xl shadow-green-500/30 transition-all duration-300 ${
        show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      <MessageCircle className="h-5 w-5" />
      <span className="hidden sm:inline">Falar no WhatsApp</span>
    </a>
  );
};

const LandingPageV3 = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(adminTabs[0].id);

  useEffect(() => {
    const path = getActiveAdminRedirectPath();
    if (path) navigate(path, { replace: true });
  }, [navigate]);

  useEffect(() => {
    trackEvent("ViewContent", {
      content_name: "Landing Page MenusApp V3",
      content_category: "landing",
    });
  }, []);

  const currentTab = adminTabs.find((t) => t.id === activeTab) ?? adminTabs[0];

  return (
    <div className="min-h-screen bg-card overflow-x-hidden font-sans">
      {/* ═══ HEADER (original) ═══ */}
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
            <Button size="sm" className="font-semibold text-sm sm:text-base shadow-md shadow-primary/20 px-3 sm:px-4 rounded-full" onClick={goRegister}>
              Testar grátis
            </Button>
          </div>
        </div>
      </header>

      {/* ═══ HERO (V2) ═══ */}
      <section
        id="top"
        className="relative overflow-hidden pt-16 pb-16 sm:pt-24 sm:pb-20 px-4 sm:px-6 lg:px-8"
        style={{ background: "linear-gradient(180deg, hsl(var(--primary) / 0.06) 0%, hsl(var(--card)) 75%)" }}
      >
        <div className="max-w-5xl mx-auto text-center relative">
          <ScrollReveal>
            <div className="inline-flex items-center gap-2 bg-card border border-primary/20 text-primary text-xs sm:text-sm font-semibold px-4 py-1.5 rounded-full shadow-sm">
              <Star className="h-3.5 w-3.5 fill-primary" /> Usado por mais de 500 restaurantes
            </div>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <h1 className="mt-6 text-[34px] md:text-[58px] leading-[1.05] font-extrabold tracking-tight text-foreground">
              Seu restaurante vendendo mais —
              <br className="hidden md:block" />
              <span className="text-primary"> sem taxa por pedido</span>, sem complicação
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Cardápio digital, delivery próprio, robô no WhatsApp e gestão completa — tudo num só lugar. Comece hoje e veja a diferença.
            </p>
          </ScrollReveal>

          <ScrollReveal delay={300}>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={REGISTER_URL}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover active:scale-[0.97] text-primary-foreground font-bold text-base px-7 py-4 rounded-xl shadow-lg shadow-primary/25 transition-all"
              >
                <Rocket className="h-5 w-5" /> Testar grátis por 7 dias
              </a>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-card border-2 border-[#25D366] text-[#15803D] hover:bg-[#F0FDF4] active:scale-[0.97] font-bold text-base px-7 py-4 rounded-xl transition-all"
              >
                <MessageCircle className="h-5 w-5" /> Falar no WhatsApp
              </a>
            </div>
            <p className="mt-5 text-xs md:text-sm text-muted-foreground">
              ✓ Sem cartão de crédito  ·  ✓ Setup em 2 minutos  ·  ✓ Cancele quando quiser
            </p>
          </ScrollReveal>

          <ScrollReveal delay={400}>
            <div className="mt-14 relative">
              <div className="absolute inset-x-10 -bottom-6 h-12 bg-primary/20 blur-3xl rounded-full" />
              <img
                src={dashboardMockup}
                alt="Dashboard do MenusApp mostrando pedidos, faturamento e cardápio digital"
                className="relative rounded-2xl shadow-2xl border border-border mx-auto w-full max-w-5xl"
              />
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ VANTAGENS (V2 Pain Points) ═══ */}
      <section id="vantagens" className="py-16 sm:py-20 bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <span className="text-xs font-bold tracking-[0.2em] text-primary">VANTAGENS</span>
            <h2 className="mt-3 text-3xl md:text-5xl font-extrabold text-foreground tracking-tight">
              Você pode estar <span className="text-destructive">perdendo dinheiro</span> todos os dias
            </h2>
            <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
              Esses problemas são comuns — e nós resolvemos cada um deles.
            </p>
          </ScrollReveal>

          <div className="mt-12 grid md:grid-cols-2 gap-5 text-left">
            {painPointsV2.map(({ icon: Icon, title, text }, i) => (
              <ScrollReveal key={title} delay={i * 80}>
                <div className="bg-[#FEF2F2] border border-[#FECACA]/60 rounded-2xl p-6 hover:border-[#FCA5A5] transition h-full">
                  <div className="h-11 w-11 rounded-xl bg-card border border-[#FECACA] flex items-center justify-center text-destructive">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-bold text-lg text-foreground">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{text}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <a
            href={REGISTER_URL}
            className="mt-12 inline-flex items-center gap-2 bg-primary hover:bg-primary-hover active:scale-[0.97] text-primary-foreground font-bold px-7 py-4 rounded-xl shadow-lg shadow-primary/25 transition-all"
          >
            Resolver isso agora — 7 dias grátis <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* ═══ SOLUÇÕES (original) ═══ */}
      <section id="solucoes" className="py-16 sm:py-20 bg-card">
        <div className={`mx-auto px-4 sm:px-6 lg:px-8 ${["cardapio","whatsapp"].includes(currentTab.id) ? "max-w-6xl" : "max-w-[92rem]"}`}>
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
                  <button
                    onClick={goRegister}
                    className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:gap-2 transition-all"
                  >
                    {m.cta}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PAINEL ADMINISTRATIVO (original) ═══ */}
      <section className="py-16 sm:py-20 bg-background">
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

          <ScrollReveal delay={150}>
            <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
              {adminTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                    activeTab === t.id
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                      : "bg-card text-muted-foreground hover:text-foreground border border-border"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </ScrollReveal>

          <div className={`grid grid-cols-1 items-center ${["cardapio","whatsapp"].includes(currentTab.id) ? "gap-10 lg:grid-cols-2" : "gap-10 lg:grid-cols-[minmax(0,1fr)_30rem]"}`}>
            <div>
              <div className={`mx-auto w-full rounded-xl border border-border shadow-lg overflow-hidden bg-card ${["cardapio","whatsapp"].includes(currentTab.id) ? "max-w-[294px]" : ""}`}>
                <img key={currentTab.id} src={currentTab.image} alt={currentTab.title} className="w-full h-auto block" />
              </div>
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
                <div className="mt-8 flex flex-col sm:flex-row gap-4">
                  <a
                    href={REGISTER_URL}
                    className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover active:scale-[0.97] text-primary-foreground font-bold text-base px-7 py-4 rounded-2xl shadow-md shadow-primary/20 transition-all"
                  >
                    <Rocket className="h-5 w-5" /> Testar grátis
                  </a>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center justify-center gap-2 bg-card border-2 border-[#25D366] text-[#15803D] hover:bg-[#F0FDF4] active:scale-[0.97] font-bold text-base px-7 py-4 rounded-2xl transition-all"
                  >
                    <MessageCircle className="h-5 w-5" /> Falar com especialista
                  </a>
                </div>
              </div>
            </div>
          </div>
      </section>

      {/* ═══ COMO COMEÇAR (original — passo 02 com IA) ═══ */}
      <section className="py-16 sm:py-20 bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">Passo a passo</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">Como começar?</h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { num: "01", icon: Smartphone, title: "Crie sua conta", desc: "Cadastro rápido em poucos minutos. Sem complicação.", highlight: false },
              {
                num: "02",
                icon: Sparkles,
                title: "Configure seu cardápio",
                desc: "Adicione produtos, fotos, preços e complementos por IA — basta tirar uma foto do seu cardápio ou importar com link.",
                highlight: true,
              },
              { num: "03", icon: ShoppingCart, title: "Comece a vender", desc: "Compartilhe o QR Code e receba pedidos na hora.", highlight: false },
            ].map((s, i) => (
              <ScrollReveal key={s.num} delay={i * 120}>
                <div className={`text-center space-y-4 p-6 rounded-2xl border bg-background hover:shadow-lg transition-all ${s.highlight ? "border-primary/40 shadow-md shadow-primary/10" : "border-border hover:border-primary/20"}`}>
                  <div className="text-4xl font-extrabold text-primary/20">{s.num}</div>
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                    <s.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">{s.title}</h3>
                  <p className="text-base text-muted-foreground leading-relaxed">{s.desc}</p>
                  {s.highlight && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                      <Sparkles className="h-3 w-3" /> Powered by IA
                    </span>
                  )}
                </div>
              </ScrollReveal>
            ))}
          </div>

          <div className="mt-12 text-center">
            <a
              href={REGISTER_URL}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover active:scale-[0.97] text-primary-foreground font-bold px-7 py-4 rounded-xl shadow-lg shadow-primary/25 transition-all"
            >
              <Rocket className="h-4 w-4" /> Testar grátis por 7 dias
            </a>
          </div>
        </div>
      </section>

      {/* ═══ RECURSOS (original) ═══ */}
      <section id="funcoes" className="py-16 sm:py-20 bg-background">
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

      {/* ═══ TOTEM + GARÇOM MOBILE ═══ */}
      <section id="atendimento" className="py-16 sm:py-20 bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">Atendimento sem fricção</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">
              Mais pedidos, menos espera
            </h2>
            <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
              Liberte seu time da papelada. Totem de autoatendimento e PDV no bolso do garçom — pedidos voam direto para a cozinha, sem retrabalho.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* TOTEM */}
            <ScrollReveal>
              <div className="rounded-2xl border border-border bg-background overflow-hidden shadow-md hover:shadow-xl transition-shadow h-full flex flex-col">
                <div className="aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
                  <img
                    src={landingTotem}
                    alt="Totem de autoatendimento Menus"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="p-6 flex flex-col gap-4 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Tablet className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">Totem de autoatendimento</h3>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Diminua filas e aumente o ticket médio. O cliente monta o pedido no totem, paga na hora e a cozinha já começa a produzir — sem intermediários, sem erro de digitação.
                  </p>
                  <ul className="space-y-2 mt-auto">
                    {["Pagamento integrado no terminal", "Sugestões inteligentes de combo", "Reduz erros e tempo de espera"].map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </ScrollReveal>

            {/* PDV MOBILE GARÇOM */}
            <ScrollReveal delay={100}>
              <div className="rounded-2xl border border-border bg-background overflow-hidden shadow-md hover:shadow-xl transition-shadow h-full flex flex-col">
                <div className="aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
                  <img
                    src={landingGarcom}
                    alt="PDV no celular do garçom"
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="p-6 flex flex-col gap-4 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Smartphone className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold text-foreground">PDV no celular do garçom</h3>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Seu garçom vira um caixa móvel. Abre comanda na mesa, lança pedidos na hora, envia para cozinha e bar em segundos e fecha a conta sem sair do salão.
                  </p>
                  <ul className="space-y-2 mt-auto">
                    {["Abre e fecha comanda na mesa", "Envio instantâneo para cozinha", "Funciona em qualquer Android ou iPhone"].map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ═══ DEPOIMENTOS (original) ═══ */}
      <section className="py-16 sm:py-20 bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">Depoimentos</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">Quem usa, recomenda</h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { name: "Carlos M.", role: "Dono de hamburgueria", text: "Saí de 15 para 45 pedidos por dia no primeiro mês. Nunca imaginei que seria tão rápido." },
              { name: "Ana P.", role: "Dona de restaurante", text: "O robô do WhatsApp atende meus clientes de madrugada. Acordo com pedidos prontos e faturamento garantido!" },
              { name: "Roberto S.", role: "Dono de pizzaria", text: "Larguei o iFood e economizo mais de R$ 3.000/mês em comissões. O delivery próprio se pagou no primeiro dia." },
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

          <div className="mt-10 text-center">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 bg-card border-2 border-[#25D366] text-[#15803D] hover:bg-[#F0FDF4] active:scale-[0.97] font-bold px-7 py-4 rounded-xl transition-all"
            >
              <MessageCircle className="h-5 w-5" /> Quero falar com especialista no WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* ═══ SEGMENTOS (original) ═══ */}
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

      {/* ═══ PLANOS (V2) ═══ */}
      <section id="pricing" className="py-20 px-5 lg:px-8 bg-[#F5F5F0]">
        <div className="max-w-6xl mx-auto text-center">
          <ScrollReveal>
            <span className="text-xs font-bold tracking-[0.2em] text-primary">PLANOS E PREÇOS</span>
            <h2 className="mt-3 text-3xl md:text-5xl font-extrabold text-foreground tracking-tight">
              7 dias grátis em qualquer plano
            </h2>
            <p className="mt-4 text-muted-foreground">Sem fidelidade, sem multa. Comece agora e mude quando quiser.</p>
          </ScrollReveal>

          <div className="mt-12 grid md:grid-cols-3 gap-5 text-left items-start">
            {plans.map((p, i) => (
              <ScrollReveal key={p.name} delay={i * 120}>
                <div
                  className={`relative bg-card rounded-2xl p-7 border transition-all hover:-translate-y-1 hover:shadow-xl h-full flex flex-col ${
                    p.featured ? "border-primary border-2 shadow-lg md:scale-105" : "border-border"
                  }`}
                >
                  {p.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap">
                      ⭐ Mais escolhido
                    </div>
                  )}
                  <div className="text-xs font-bold tracking-[0.18em] text-muted-foreground">{p.name}</div>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-sm text-muted-foreground">R$</span>
                    <span className="text-4xl font-extrabold text-foreground">{p.price}</span>
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </div>
                  <div className="text-xs text-muted-foreground/80">{p.perDay}</div>

                  <button
                    onClick={() => {
                      const value = parseFloat(p.price.replace(",", "."));
                      trackEvent("AddToCart", {
                        content_name: `Plano ${p.name}`,
                        content_ids: [p.planSlug],
                        content_type: "subscription_plan",
                        value,
                        currency: "BRL",
                      });
                      goRegister();
                    }}
                    className={`mt-6 w-full inline-flex items-center justify-center gap-2 font-bold py-3 rounded-xl transition-all active:scale-[0.97] ${
                      p.featured
                        ? "bg-primary hover:bg-primary-hover text-primary-foreground shadow-md"
                        : "bg-card border-2 border-foreground/10 hover:border-primary text-foreground"
                    }`}
                  >
                    {p.featured ? "Experimentar grátis por 7 dias" : "Experimentar grátis"} <ArrowRight className="h-4 w-4" />
                  </button>

                  <div className="mt-6 border-t border-border pt-5 space-y-3 flex-1">
                    {p.features.map((f) => (
                      <div key={f} className="flex items-start gap-2.5 text-sm text-foreground">
                        <div className="h-5 w-5 rounded-full bg-[#FED7AA] flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="h-3 w-3 text-[#9A3412]" strokeWidth={3} />
                        </div>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <div className="mt-10 max-w-2xl mx-auto bg-card border border-border rounded-2xl p-6 flex flex-col md:flex-row items-center gap-4 text-left">
            <div className="flex-1">
              <p className="text-foreground font-semibold">Não sabe qual plano escolher?</p>
              <p className="text-sm text-muted-foreground mt-1">
                Fale com nosso time no WhatsApp — em 5 minutos te indicamos o ideal para o seu restaurante.
              </p>
            </div>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#1FB959] active:scale-[0.97] text-white font-bold px-5 py-3 rounded-xl whitespace-nowrap transition-all"
            >
              <MessageCircle className="h-5 w-5" /> Falar com especialista
            </a>
          </div>

          <p className="mt-8 text-xs text-muted-foreground">
            Cancele a qualquer momento  ·  Sem taxas por pedido  ·  Pagamento seguro
          </p>
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
      <section className="py-20 px-5 lg:px-8 bg-primary">
        <div className="max-w-4xl mx-auto text-center">
          <ScrollReveal>
            <h2 className="text-3xl md:text-5xl font-extrabold text-primary-foreground tracking-tight">
              Pronto para seu restaurante vender mais?
            </h2>
            <p className="mt-4 text-primary-foreground/90 text-lg">
              Comece agora mesmo, é grátis. Sem cartão de crédito.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={REGISTER_URL}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-card text-primary hover:bg-card/95 active:scale-[0.97] font-bold text-base px-7 py-4 rounded-xl shadow-lg transition-all"
              >
                <Rocket className="h-5 w-5" /> Testar grátis por 7 dias
              </a>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-transparent border-2 border-primary-foreground/70 text-primary-foreground hover:bg-primary-foreground/10 active:scale-[0.97] font-bold text-base px-7 py-4 rounded-xl transition-all"
              >
                <MessageCircle className="h-5 w-5" /> Falar no WhatsApp
              </a>
            </div>
            <p className="mt-5 text-xs text-primary-foreground/85">
              ✓ Sem cartão  ·  ✓ Setup em 2 min  ·  ✓ Cancele quando quiser
            </p>
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

      <WhatsAppFloat />
    </div>
  );
};

export default LandingPageV3;

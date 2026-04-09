import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import menusLogo from "@/assets/menus-logo.png";
import heroDashboard from "@/assets/landing-hero-dashboard.jpg";
import {
  ArrowRight, Check, ChevronRight, Zap, Star,
  QrCode, ShoppingCart, Utensils, Package,
  BarChart3, Receipt, Users, MessageSquare, Truck,
  Smartphone, TrendingUp, Megaphone, CreditCard,
  Shield, Clock, Headphones, MapPin, Printer, Bot,
  Wallet, BadgePercent,
  AlertTriangle, Rocket, DollarSign, LayoutGrid,
  Timer, Award, Heart, MonitorSmartphone, BrainCircuit,
  Bell, Send, FileText, CalendarCheck, Sparkles,
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
  { q: "É difícil de usar?", a: "Não! Interface simples e intuitiva. Qualquer pessoa consegue usar em minutos, sem treinamento." },
  { q: "Preciso instalar algum aplicativo?", a: "Não. Funciona 100% no navegador. Seus clientes acessam o cardápio pelo link ou QR Code sem baixar nada." },
  { q: "Serve para meu restaurante?", a: "Sim. Feito para delivery, balcão, mesa e qualquer tipo de operação de food service." },
  { q: "Tem suporte?", a: "Sim! Atendimento rápido e humano. Estamos sempre prontos para ajudar." },
  { q: "Posso cancelar a qualquer momento?", a: "Sim, sem fidelidade e sem multa. Cancele quando quiser." },
  { q: "Como funciona o delivery?", a: "Você tem seu próprio sistema de delivery com zonas de entrega, taxas configuráveis e acompanhamento de pedidos. Zero comissão." },
  { q: "O sistema emite nota fiscal?", a: "Sim! No plano Avançado você tem emissão de NFC-e integrada diretamente ao SEFAZ." },
  { q: "Como funciona o Robô IA?", a: "O Robô IA conversa com seus clientes pelo WhatsApp, sugere produtos, tira dúvidas e finaliza pedidos automaticamente." },
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
              Começar teste grátis
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
              <Sparkles className="h-4 w-4" />
              Primeiro mês grátis • Sem compromisso
            </div>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-foreground tracking-[-0.03em] leading-[1.1]">
              Venda sem taxas. Automatize seu restaurante.{" "}
              <span className="text-primary">Controle tudo em um só lugar.</span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={200}>
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Delivery, balcão, mesa e WhatsApp integrados em um único sistema com IA, automação e gestão completa.
            </p>
          </ScrollReveal>

          {/* Hero bullets */}
          <ScrollReveal delay={250}>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              {[
                "Sem comissão de marketplace",
                "Pedidos automáticos no WhatsApp",
                "Controle total da operação e financeiro",
              ].map((t) => (
                <div key={t} className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  {t}
                </div>
              ))}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={300}>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" className="text-lg px-10 h-14 font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] transition-all" onClick={() => navigate("/register")}>
                Começar teste grátis
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8 h-14 font-semibold" onClick={() => scrollTo("como-funciona")}>
                Ver como funciona
              </Button>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={350}>
            <p className="mt-4 text-sm text-muted-foreground">
              Sem contrato • Sem fidelidade • Cancele quando quiser
            </p>
          </ScrollReveal>

          {/* Hero mockup */}
          <ScrollReveal delay={400}>
            <div className="mt-12 mx-auto max-w-4xl">
              <div className="rounded-2xl border border-border shadow-2xl shadow-primary/10 overflow-hidden">
                <img src={heroDashboard} alt="Dashboard do sistema de gestão para restaurantes" className="w-full h-auto" />
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ BENEFÍCIO PRINCIPAL ═══ */}
      <section id="vantagens" className="py-16 sm:py-24 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-14">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">Tudo em um</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-[-0.025em]">
              Tudo que seu restaurante precisa para{" "}
              <span className="text-primary">vender mais</span> e operar melhor
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Do pedido ao financeiro, tudo centralizado em um único sistema.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: DollarSign, title: "Venda sem taxas", desc: "Delivery, retirada, balcão e mesa — sem comissão." },
              { icon: Zap, title: "Fácil e personalizado", desc: "Seu cardápio com sua marca. Setup em menos de 2 minutos." },
              { icon: ShoppingCart, title: "Pedidos automáticos", desc: "Receba pedidos direto no sistema e no WhatsApp automaticamente." },
              { icon: Printer, title: "Impressão automática", desc: "Pedidos vão direto para a cozinha sem atraso." },
              { icon: Package, title: "Estoque e CMV", desc: "Controle automático com ficha técnica e lucro em tempo real." },
              { icon: MapPin, title: "Áreas de entrega", desc: "Defina taxas, zonas e raio no mapa." },
            ].map((f, i) => (
              <ScrollReveal key={f.title} delay={i * 60}>
                <div className="flex items-start gap-4 p-5 rounded-xl border border-border bg-card hover:shadow-md hover:border-primary/20 transition-all">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground mb-1">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={400}>
            <div className="mt-10 text-center">
              <Button size="lg" className="text-base px-8 h-12 font-bold shadow-md shadow-primary/20 hover:scale-[1.02] transition-all" onClick={() => navigate("/register")}>
                Testar grátis agora
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ OPERAÇÃO ═══ */}
      <section className="py-16 sm:py-24 bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <ScrollReveal>
              <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-4">Operação</span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em] leading-tight">
                Controle total da operação do seu restaurante
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Do balcão ao delivery, tudo funcionando junto. PDV integrado, comandas digitais, app de garçom e confirmação automática de pedidos.
              </p>
              <div className="mt-6 space-y-3">
                {[
                  "PDV completo com atalhos",
                  "Comandas digitais por mesa",
                  "Gestão visual de mesas",
                  "Confirmação automática",
                ].map((t) => (
                  <div key={t} className="flex items-center gap-3">
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-base font-medium text-foreground">{t}</span>
                  </div>
                ))}
              </div>
            </ScrollReveal>
            <ScrollReveal delay={200}>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: MonitorSmartphone, label: "PDV" },
                  { icon: Receipt, label: "Comandas" },
                  { icon: Utensils, label: "Mesas" },
                  { icon: Truck, label: "Delivery" },
                ].map((item) => (
                  <div key={item.label} className="p-6 rounded-xl border border-border bg-background text-center hover:shadow-md hover:border-primary/20 transition-all">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <item.icon className="h-6 w-6 text-primary" />
                    </div>
                    <span className="text-sm font-bold text-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ═══ WHATSAPP + IA ═══ */}
      <section className="py-16 sm:py-24 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-14">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">WhatsApp + IA</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-[-0.025em]">
              Um sistema que <span className="text-primary">vende por você</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Automação, WhatsApp e inteligência artificial trabalhando 24h.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              { icon: Bot, title: "Robô WhatsApp", desc: "Recebe pedidos automaticamente com chatbot integrado." },
              { icon: BrainCircuit, title: "IA Vendedora", desc: "Conversa com o cliente, sugere produtos e fecha pedidos." },
              { icon: Megaphone, title: "Marketing automático", desc: "Dispara campanhas sozinho e recupera clientes inativos." },
              { icon: Bell, title: "Notificações inteligentes", desc: "Confirmação de pedido, status e alertas automáticos." },
            ].map((f, i) => (
              <ScrollReveal key={f.title} delay={i * 80}>
                <div className="flex items-start gap-4 p-6 rounded-xl border border-border bg-card hover:shadow-md hover:border-primary/20 transition-all">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <f.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal delay={400}>
            <p className="text-center mt-8 text-base font-semibold text-muted-foreground max-w-xl mx-auto">
              Cliente inativo? Recebe cupom. Pedido feito? Notificação instantânea. <span className="text-primary">Tudo automático.</span>
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ SISTEMA COMPLETO ═══ */}
      <section className="py-16 sm:py-24 bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-14">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">Completo</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">
              Tudo em um único sistema
            </h2>
            <p className="mt-3 text-lg text-muted-foreground max-w-xl mx-auto">
              Substitua várias ferramentas por uma solução completa.
            </p>
          </ScrollReveal>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { icon: QrCode, label: "Cardápio com QR Code" },
              { icon: Users, label: "CRM e fidelidade" },
              { icon: CreditCard, label: "Pagamento online" },
              { icon: BarChart3, label: "Relatórios e DRE" },
              { icon: FileText, label: "Nota fiscal (SEFAZ)" },
              { icon: CalendarCheck, label: "Reservas de mesa" },
              { icon: MessageSquare, label: "Marketing WhatsApp" },
              { icon: Package, label: "Estoque e CMV" },
            ].map((item, i) => (
              <ScrollReveal key={item.label} delay={i * 50}>
                <div className="flex flex-col items-center gap-3 p-5 rounded-xl border border-border bg-background hover:shadow-md hover:border-primary/20 transition-all text-center">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-foreground leading-tight">{item.label}</span>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ COMO FUNCIONA (3 PASSOS) ═══ */}
      <section id="como-funciona" className="py-16 sm:py-24 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">Passo a passo</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">Comece em minutos</h2>
          </ScrollReveal>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { num: "1", icon: Rocket, title: "Crie sua conta", desc: "Cadastro rápido, sem burocracia." },
              { num: "2", icon: QrCode, title: "Monte seu cardápio", desc: "Adicione produtos com fotos e preços em minutos." },
              { num: "3", icon: ShoppingCart, title: "Comece a vender", desc: "Compartilhe o link e receba pedidos automaticamente." },
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
            <div className="mt-10 text-center">
              <Button size="lg" className="text-base px-8 h-12 font-bold shadow-md shadow-primary/20 hover:scale-[1.02] transition-all" onClick={() => navigate("/register")}>
                Começar teste grátis
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ PROVA SOCIAL ═══ */}
      <section className="py-16 sm:py-24 bg-card">
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

      {/* ═══ BENEFÍCIOS ═══ */}
      <section className="py-16 sm:py-20 bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-12">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">Resultados</span>
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

      {/* ═══ OFERTA / TESTE GRÁTIS ═══ */}
      <section className="py-16 sm:py-24" style={{ background: 'linear-gradient(135deg, hsl(25 100% 50%) 0%, hsl(25 100% 42%) 100%)' }}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-[-0.025em]">
              Teste sem risco
            </h2>
            <p className="mt-4 text-lg text-white/85 max-w-xl mx-auto leading-relaxed">
              Use por 30 dias. Se não gostar, não paga nada.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm font-semibold text-white/90">
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4" /> Sem contrato</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4" /> Sem fidelidade</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4" /> Cancelamento simples</span>
              <span className="flex items-center gap-1.5"><Check className="h-4 w-4" /> Só paga se gostar</span>
            </div>
            <div className="mt-8">
              <Button
                size="lg"
                className="text-lg px-10 h-14 font-bold bg-white text-primary hover:bg-white/90 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all"
                onClick={() => navigate("/register")}
              >
                Testar grátis agora
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section id="pricing" className="py-16 sm:py-24 bg-background relative overflow-hidden">
        <div className="absolute top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/[0.04] blur-[120px] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <ScrollReveal className="text-center mb-14">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">Planos & Preços</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-[-0.025em]">Escolha o plano ideal</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">Primeiro mês grátis em todos os planos. Sem fidelidade, sem multa.</p>
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
                    <p className="text-xs text-center text-muted-foreground mt-2">Primeiro mês grátis • Cancele quando quiser</p>
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
              Se você não tiver mais organização e mais pedidos, você simplesmente não paga. Teste sem risco.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section id="faq" className="py-16 sm:py-24 bg-background">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal className="text-center mb-10">
            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-semibold uppercase tracking-wider mb-3">Dúvidas</span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-[-0.025em]">Ficou com dúvida?</h2>
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
      <section className="py-16 sm:py-24 bg-card">
        <ScrollReveal>
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground mb-4 tracking-[-0.025em]">
              Comece hoje e veja seu restaurante mais organizado e <span className="text-primary">vendendo mais</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Sem risco. Sem contrato. Primeiro mês grátis.
            </p>
            <Button size="lg" className="text-lg px-10 h-14 font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:scale-[1.02] transition-all" onClick={() => navigate("/register")}>
              Começar teste grátis
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

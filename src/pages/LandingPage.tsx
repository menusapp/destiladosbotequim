import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useNavigate } from "react-router-dom";
import {
  Check,
  Smartphone,
  ShoppingCart,
  BarChart3,
  Users,
  Utensils,
  Truck,
  ArrowRight,
  QrCode,
  Receipt,
  Package,
  TrendingUp,
  MessageSquare,
  CalendarCheck,
  Shield,
  Zap,
  ChevronRight,
  Star,
  BookOpen,
  Calculator,
  PieChart,
  Megaphone,
} from "lucide-react";
import menusLogo from "@/assets/menus-logo.png";

/* ───────────── Intersection Observer hook ───────────── */
function useAnimateOnScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.unobserve(el); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return { ref, visible };
}

function AnimatedSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, visible } = useAnimateOnScroll();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ───────────── Data ───────────── */
const stats = [
  { value: "500+", label: "Restaurantes ativos" },
  { value: "1M+", label: "Pedidos processados" },
  { value: "99.9%", label: "Uptime garantido" },
  { value: "< 2min", label: "Tempo de setup" },
];

const features = [
  { icon: QrCode, title: "Cardápio Digital", desc: "QR Code na mesa, atualização em tempo real. Sem reimprimir nunca mais." },
  { icon: ShoppingCart, title: "Pedidos Online", desc: "Delivery e retirada direto no seu painel. Zero comissão de marketplace." },
  { icon: Utensils, title: "PDV & Balcão", desc: "Ponto de venda completo com controle de comandas e contas." },
  { icon: CalendarCheck, title: "Mesas & Reservas", desc: "Gestão visual de mesas, comandas digitais e sistema de reservas online." },
  { icon: Package, title: "Estoque Automático", desc: "Baixa automática a cada venda. CMV calculado em tempo real." },
  { icon: BarChart3, title: "Relatórios & DRE", desc: "Dashboard completo: vendas, DRE, fluxo de caixa e margens." },
  { icon: Receipt, title: "Nota Fiscal", desc: "Emissão de NFC-e integrada. Compliance fiscal sem complicação." },
  { icon: Users, title: "CRM & Fidelidade", desc: "Cadastro de clientes, programa de pontos, cupons e recompensas." },
  { icon: MessageSquare, title: "Marketing WhatsApp", desc: "Campanhas automáticas, remarketing para inativos, cupons por WhatsApp." },
];

const showcases = [
  {
    badge: "Cardápio Digital",
    title: "Seu cardápio na palma da mão do cliente",
    desc: "Design responsivo e moderno. O cliente escaneia o QR Code na mesa e faz o pedido direto do celular. Sem app, sem download, sem fricção. Atualize preços, fotos e disponibilidade em tempo real.",
    highlights: ["QR Code por mesa", "Complementos e extras", "Fotos em alta resolução", "Disponibilidade em tempo real"],
    icon: Smartphone,
  },
  {
    badge: "Gestão Financeira",
    title: "Controle total das suas finanças",
    desc: "DRE automático, fluxo de caixa, custos fixos e variáveis, taxas de cartão, CMV — tudo calculado automaticamente a partir das suas vendas reais. Pare de usar planilha.",
    highlights: ["DRE automático mensal", "CMV em tempo real", "Fluxo de caixa diário", "Margens por produto"],
    icon: TrendingUp,
  },
  {
    badge: "Marketing Inteligente",
    title: "Seus clientes voltando sem você pedir",
    desc: "Crie campanhas de remarketing que disparam automaticamente via WhatsApp. Cliente não veio em 30 dias? Ele recebe um cupom. Comprou pizza? Ofereça a sobremesa. Tudo no automático.",
    highlights: ["WhatsApp automatizado", "Remarketing por inatividade", "Cupons personalizados", "Segmentação por compra"],
    icon: Megaphone,
  },
  {
    badge: "Estoque & CMV",
    title: "Estoque que se controla sozinho",
    desc: "Cadastre as fichas técnicas dos seus produtos e o sistema dá baixa automaticamente a cada venda. Veja seu CMV real, receba alertas de estoque baixo e nunca mais perca dinheiro com desperdício.",
    highlights: ["Baixa automática", "Fichas técnicas", "Alertas de estoque", "CMV por produto"],
    icon: Calculator,
  },
];

const plans = [
  {
    name: "Básico",
    price: "R$ 99",
    period: "/mês",
    description: "Para começar a digitalizar",
    features: [
      "Cardápio digital ilimitado",
      "QR Code para mesas",
      "Pedidos em tempo real",
      "1 usuário administrador",
      "Suporte por email",
    ],
    cta: "Começar Agora",
    highlighted: false,
  },
  {
    name: "Profissional",
    price: "R$ 199",
    period: "/mês",
    description: "O mais escolhido",
    features: [
      "Tudo do Básico",
      "Delivery completo",
      "Gestão de estoque & CMV",
      "Relatórios e DRE",
      "Programa de fidelidade",
      "Até 5 usuários",
      "Suporte prioritário",
    ],
    cta: "Escolher Profissional",
    highlighted: true,
  },
  {
    name: "Completo",
    price: "R$ 349",
    period: "/mês",
    description: "Para operações sérias",
    features: [
      "Tudo do Profissional",
      "Marketing WhatsApp",
      "Remarketing automático",
      "Nota fiscal eletrônica",
      "Fluxo de caixa & DRE",
      "Reservas online",
      "Usuários ilimitados",
      "Suporte VIP",
    ],
    cta: "Falar com Vendas",
    highlighted: false,
  },
];

const faqs = [
  { q: "Preciso instalar algum aplicativo?", a: "Não! O Menu's funciona 100% no navegador. Seus clientes acessam o cardápio pelo QR Code sem baixar nada. Você gerencia tudo pelo painel web." },
  { q: "Posso cancelar a qualquer momento?", a: "Sim, sem fidelidade e sem multa. Você pode fazer upgrade, downgrade ou cancelar quando quiser." },
  { q: "Como funciona o delivery?", a: "Você tem seu próprio sistema de delivery com zonas de entrega, taxas configuráveis e acompanhamento de pedidos. Sem comissão de marketplace." },
  { q: "O sistema emite nota fiscal?", a: "Sim! No plano Completo você tem emissão de NFC-e integrada diretamente ao sistema, com envio automático ao SEFAZ." },
  { q: "Como funciona o marketing por WhatsApp?", a: "Você configura campanhas automáticas que disparam mensagens via WhatsApp baseadas em comportamento do cliente: inatividade, compras específicas, aniversário e mais." },
  { q: "Preciso de equipamentos especiais?", a: "Não. Qualquer computador, tablet ou celular com navegador funciona. Para impressão, qualquer impressora térmica USB ou de rede é compatível." },
];

/* ───────────── Component ───────────── */
const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <img src={menusLogo} alt="Menu's" className="h-8 w-8" />
            <span className="text-xl font-bold text-foreground tracking-tight">Menu's</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#showcase" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Como funciona</a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Planos</a>
            <a href="#faq" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
          </nav>
          <Button onClick={() => navigate("/login")} variant="outline" size="sm" className="font-medium">
            Entrar no Painel
          </Button>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.04] via-transparent to-transparent" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-primary/[0.03] blur-3xl pointer-events-none" />
        
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32 text-center">
          <AnimatedSection>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-8 border border-primary/20">
              <Zap className="h-3.5 w-3.5" />
              Sistema completo para restaurantes
            </div>
          </AnimatedSection>

          <AnimatedSection delay={100}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-foreground tracking-tight leading-[1.1] max-w-4xl mx-auto">
              Seu restaurante
              <span className="block text-primary">100% digital</span>
            </h1>
          </AnimatedSection>

          <AnimatedSection delay={200}>
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Cardápio digital, pedidos online, delivery, estoque, financeiro, marketing e muito mais.
              <span className="font-medium text-foreground"> Tudo numa plataforma só.</span>
            </p>
          </AnimatedSection>

          <AnimatedSection delay={300}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                size="lg"
                className="text-base px-8 h-12 font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
                onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
              >
                Começar gratuitamente
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-base px-8 h-12 font-medium"
                onClick={() => document.getElementById("showcase")?.scrollIntoView({ behavior: "smooth" })}
              >
                Ver como funciona
              </Button>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ─── Social proof stats ─── */}
      <section className="border-y border-border/50 bg-card/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <AnimatedSection key={stat.label} delay={i * 100} className="text-center">
                <div className="text-3xl sm:text-4xl font-extrabold text-foreground">{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1 font-medium">{stat.label}</div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features grid ─── */}
      <section id="features" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 uppercase tracking-wider">
              Funcionalidades
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight">
              Tudo que seu restaurante precisa
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Um sistema completo que substitui dezenas de ferramentas fragmentadas.
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <AnimatedSection key={feature.title} delay={i * 80}>
                <Card className="group border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 h-full">
                  <CardContent className="pt-6 pb-6">
                    <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 group-hover:scale-110 transition-all duration-300">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-base font-bold text-foreground mb-1.5">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Showcase ─── */}
      <section id="showcase" className="py-20 sm:py-28 bg-card/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-20">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 uppercase tracking-wider">
              Como funciona
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight">
              Conheça o que o Menu's faz por você
            </h2>
          </AnimatedSection>

          <div className="space-y-24">
            {showcases.map((item, i) => (
              <AnimatedSection key={item.title} delay={100}>
                <div className={`flex flex-col ${i % 2 === 1 ? "lg:flex-row-reverse" : "lg:flex-row"} gap-12 lg:gap-16 items-center`}>
                  {/* Text */}
                  <div className="flex-1 space-y-5">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
                      {item.badge}
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground leading-tight">
                      {item.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed text-base">
                      {item.desc}
                    </p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {item.highlights.map((h) => (
                        <li key={h} className="flex items-center gap-2.5 text-sm font-medium text-foreground">
                          <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Check className="h-3 w-3 text-primary" />
                          </div>
                          {h}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Visual placeholder */}
                  <div className="flex-1 w-full">
                    <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-primary/[0.08] to-primary/[0.02] border border-primary/10 flex items-center justify-center">
                      <item.icon className="h-20 w-20 text-primary/30" />
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 uppercase tracking-wider">
              Planos & Preços
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight">
              Escolha o plano ideal
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Sem fidelidade, sem multa. Comece agora e mude quando quiser.
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <AnimatedSection key={plan.name} delay={i * 120}>
                <Card
                  className={`relative flex flex-col h-full transition-all duration-300 hover:shadow-lg ${
                    plan.highlighted
                      ? "border-primary shadow-lg shadow-primary/10 ring-2 ring-primary/20 scale-[1.02]"
                      : "border-border/50 hover:border-primary/20"
                  }`}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full shadow-lg shadow-primary/25">
                      ⭐ Mais Escolhido
                    </div>
                  )}
                  <div className="p-6 pb-0 text-center">
                    <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                    <div className="mt-5 mb-6">
                      <span className="text-5xl font-extrabold text-foreground">{plan.price}</span>
                      <span className="text-muted-foreground font-medium">{plan.period}</span>
                    </div>
                  </div>
                  <CardContent className="flex-1 flex flex-col pt-0">
                    <ul className="space-y-3 flex-1">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2.5">
                          <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="h-3 w-3 text-primary" />
                          </div>
                          <span className="text-sm text-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={`w-full mt-8 h-11 font-semibold ${
                        plan.highlighted ? "shadow-lg shadow-primary/25" : ""
                      }`}
                      variant={plan.highlighted ? "default" : "outline"}
                      onClick={() => window.alert("Em breve! Entre em contato pelo WhatsApp.")}
                    >
                      {plan.cta}
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section id="faq" className="py-20 sm:py-28 bg-card/50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4 uppercase tracking-wider">
              FAQ
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              Perguntas frequentes
            </h2>
          </AnimatedSection>

          <AnimatedSection delay={100}>
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border border-border/50 rounded-xl px-5 bg-card data-[state=open]:shadow-md transition-shadow">
                  <AccordionTrigger className="text-left text-sm font-semibold text-foreground hover:no-underline py-4">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-4">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </AnimatedSection>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="py-20 sm:py-24">
        <AnimatedSection>
          <div className="max-w-4xl mx-auto px-4 text-center">
            <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/15 p-12 sm:p-16">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-4 tracking-tight">
                Pronto para transformar seu restaurante?
              </h2>
              <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
                Comece hoje mesmo. Setup em menos de 2 minutos, sem cartão de crédito.
              </p>
              <Button
                size="lg"
                className="text-base px-10 h-12 font-semibold shadow-lg shadow-primary/25"
                onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
              >
                Começar agora — é grátis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </AnimatedSection>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border bg-card py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <img src={menusLogo} alt="Menu's" className="h-7 w-7" />
              <span className="font-bold text-foreground tracking-tight">Menu's</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a href="#features" className="hover:text-foreground transition-colors">Funcionalidades</a>
              <a href="#pricing" className="hover:text-foreground transition-colors">Planos</a>
              <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Menu's. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

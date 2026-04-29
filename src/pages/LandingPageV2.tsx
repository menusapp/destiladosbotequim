import { useEffect, useState } from "react";
import { ChevronDown, Check, Star, MessageCircle, Rocket, TrendingDown, Smartphone, DollarSign, Package, ArrowRight } from "lucide-react";
import PhoneMockup from "@/components/landing/PhoneMockup";
import SavingsSimulator from "@/components/landing/SavingsSimulator";

const WHATSAPP_URL = "https://w.app/menusapp";
const REGISTER_URL = "https://menusapp.com.br/registro/avancado";

const jakarta = { fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" };

/* ───────── Navbar ───────── */
const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all ${
        scrolled ? "bg-white/90 backdrop-blur-md shadow-sm" : "bg-white/70 backdrop-blur-sm"
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 lg:px-8 h-16 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-[#F97316] text-white flex items-center justify-center font-extrabold text-lg">
            M
          </div>
          <span className="font-extrabold text-[#0F172A] text-lg tracking-tight">Menu's</span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          <a href="#solucoes" className="text-sm font-medium text-[#475569] hover:text-[#0F172A] transition">Soluções</a>
          <a href="#recursos" className="text-sm font-medium text-[#475569] hover:text-[#0F172A] transition">Recursos</a>
          <a href="#precos" className="text-sm font-medium text-[#475569] hover:text-[#0F172A] transition">Preços</a>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/login"
            className="hidden md:inline-flex text-sm font-semibold text-[#0F172A] hover:text-[#F97316] px-3 py-2 transition"
          >
            Entrar
          </a>
          <a
            href={REGISTER_URL}
            className="inline-flex items-center gap-1.5 bg-[#F97316] hover:bg-[#EA670B] active:scale-[0.97] text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all"
          >
            Testar grátis <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </nav>
  );
};

/* ───────── Hero ───────── */
const Hero = () => (
  <section
    id="top"
    className="pt-32 pb-20 px-5 lg:px-8"
    style={{ background: "linear-gradient(180deg, #FFF8F3 0%, #FFFFFF 75%)" }}
  >
    <div className="max-w-5xl mx-auto text-center">
      <div className="inline-flex items-center gap-2 bg-white border border-[#FED7AA] text-[#9A3412] text-xs font-semibold px-4 py-1.5 rounded-full shadow-sm">
        🔥 Usado por mais de 500 restaurantes
      </div>

      <h1 className="mt-6 text-[34px] md:text-[58px] leading-[1.05] font-extrabold tracking-tight text-[#0F172A]">
        Seu restaurante vendendo mais —
        <br className="hidden md:block" />
        <span className="text-[#F97316]"> sem taxa por pedido</span>, sem complicação
      </h1>

      <p className="mt-6 text-base md:text-lg text-[#475569] max-w-2xl mx-auto leading-relaxed">
        Cardápio digital, delivery próprio, robô no WhatsApp e gestão completa — tudo num só lugar. Comece hoje e veja a diferença.
      </p>

      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        <a
          href={REGISTER_URL}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#F97316] hover:bg-[#EA670B] active:scale-[0.97] text-white font-bold text-base px-7 py-4 rounded-xl shadow-lg shadow-orange-200 transition-all"
        >
          <Rocket className="h-5 w-5" /> Testar grátis por 7 dias
        </a>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white border-2 border-[#25D366] text-[#15803D] hover:bg-[#F0FDF4] active:scale-[0.97] font-bold text-base px-7 py-4 rounded-xl transition-all"
        >
          <MessageCircle className="h-5 w-5" /> Falar no WhatsApp
        </a>
      </div>

      <p className="mt-5 text-xs md:text-sm text-[#64748B]">
        ✓ Sem cartão de crédito  ·  ✓ Setup em 2 minutos  ·  ✓ Cancele quando quiser
      </p>

      <div className="mt-16 flex justify-center">
        <PhoneMockup primaryColor="#F97316" primaryColorEnd="#FB923C" />
      </div>
    </div>
  </section>
);

/* ───────── Credibilidade ───────── */
const Stats = () => (
  <section className="bg-[#0F172A] py-12 px-5 lg:px-8">
    <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
      {[
        ["+500", "restaurantes atendidos"],
        ["+50k", "pedidos por mês"],
        ["4.9/5", "avaliação dos clientes"],
        ["0%", "taxa sobre vendas"],
      ].map(([num, label]) => (
        <div key={label}>
          <div className="text-3xl md:text-4xl font-extrabold text-[#F97316]">{num}</div>
          <div className="mt-1 text-xs md:text-sm text-[#CBD5E1]">{label}</div>
        </div>
      ))}
    </div>
  </section>
);

/* ───────── Dor do Cliente ───────── */
const Pain = () => {
  const items = [
    { Icon: TrendingDown, title: "Não sabe quanto lucra de verdade", text: "Sem DRE e fluxo de caixa em tempo real fica impossível tomar decisões certas." },
    { Icon: Smartphone, title: "Pedidos se perdem no WhatsApp", text: "Sem centralização, erros de pedido e atraso na entrega viram rotina." },
    { Icon: DollarSign, title: "Apps de delivery comem sua margem", text: "30% de comissão por pedido é dinheiro que poderia ficar no seu bolso." },
    { Icon: Package, title: "Estoque descontrolado vira prejuízo", text: "Sem controle automático, falta de produto na hora errada custa caro." },
  ];
  return (
    <section id="solucoes" className="py-20 px-5 lg:px-8 bg-white">
      <div className="max-w-6xl mx-auto text-center">
        <span className="text-xs font-bold tracking-[0.2em] text-[#F97316]">VANTAGENS</span>
        <h2 className="mt-3 text-3xl md:text-5xl font-extrabold text-[#0F172A] tracking-tight">
          Você pode estar <span className="text-[#DC2626]">perdendo dinheiro</span> todos os dias
        </h2>
        <p className="mt-4 text-[#475569] max-w-2xl mx-auto">
          Esses problemas são comuns — e nós resolvemos cada um deles.
        </p>

        <div className="mt-12 grid md:grid-cols-2 gap-5 text-left">
          {items.map(({ Icon, title, text }) => (
            <div key={title} className="bg-[#FEF2F2] border border-[#FECACA]/60 rounded-2xl p-6 hover:border-[#FCA5A5] transition">
              <div className="h-11 w-11 rounded-xl bg-white border border-[#FECACA] flex items-center justify-center text-[#DC2626]">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-bold text-lg text-[#0F172A]">{title}</h3>
              <p className="mt-2 text-sm text-[#64748B] leading-relaxed">{text}</p>
            </div>
          ))}
        </div>

        <a
          href={REGISTER_URL}
          className="mt-12 inline-flex items-center gap-2 bg-[#F97316] hover:bg-[#EA670B] active:scale-[0.97] text-white font-bold px-7 py-4 rounded-xl shadow-lg shadow-orange-200 transition-all"
        >
          Resolver isso agora — 7 dias grátis <ArrowRight className="h-4 w-4" />
        </a>
      </div>
    </section>
  );
};

/* ───────── Como Começar ───────── */
const Steps = () => {
  const steps = [
    { n: "01", title: "Crie sua conta", text: "Cadastro rápido, sem cartão de crédito. Em 2 minutos você já está dentro." },
    { n: "02", title: "Monte seu cardápio", text: "Adicione produtos, fotos, preços e combos. Tudo fácil e visual." },
    { n: "03", title: "Comece a receber pedidos", text: "Compartilhe o QR Code ou link e veja os pedidos chegando em tempo real." },
  ];
  return (
    <section id="recursos" className="py-20 px-5 lg:px-8 bg-[#F5F5F0]">
      <div className="max-w-6xl mx-auto text-center">
        <span className="text-xs font-bold tracking-[0.2em] text-[#F97316]">PASSO A PASSO</span>
        <h2 className="mt-3 text-3xl md:text-5xl font-extrabold text-[#0F172A] tracking-tight">
          Comece a vender em 3 passos simples
        </h2>
        <p className="mt-4 text-[#475569] max-w-xl mx-auto">
          Setup em menos de 2 minutos. Sem técnico, sem complicação.
        </p>

        <div className="mt-12 grid md:grid-cols-3 gap-5 text-left">
          {steps.map((s) => (
            <div key={s.n} className="bg-white rounded-2xl p-7 border border-[#E2E8F0] hover:shadow-lg hover:-translate-y-0.5 transition-all">
              <div className="h-12 w-12 rounded-full bg-[#F97316] text-white font-extrabold flex items-center justify-center text-lg">
                {s.n}
              </div>
              <h3 className="mt-5 font-bold text-xl text-[#0F172A]">{s.title}</h3>
              <p className="mt-2 text-sm text-[#64748B] leading-relaxed">{s.text}</p>
            </div>
          ))}
        </div>

        <a
          href={REGISTER_URL}
          className="mt-12 inline-flex items-center gap-2 bg-[#F97316] hover:bg-[#EA670B] active:scale-[0.97] text-white font-bold px-7 py-4 rounded-xl shadow-lg shadow-orange-200 transition-all"
        >
          <Rocket className="h-4 w-4" /> Começar agora — é grátis
        </a>
      </div>
    </section>
  );
};

/* ───────── Depoimentos ───────── */
const Testimonials = () => {
  const items = [
    { name: "Carlos M.", role: "Dono de hamburgueria", text: "Saí de 15 para 45 pedidos por dia no primeiro mês. Nunca imaginei que seria tão rápido." },
    { name: "Ana P.", role: "Dona de restaurante", text: "O robô do WhatsApp atende meus clientes de madrugada. Pedidos prontos e faturamento garantido!" },
    { name: "Roberto S.", role: "Dono de pizzaria", text: "Larguei o iFood e economizo mais de R$ 3.000/mês em comissões. Paguei no primeiro dia." },
  ];
  return (
    <section className="py-20 px-5 lg:px-8 bg-white">
      <div className="max-w-6xl mx-auto text-center">
        <span className="text-xs font-bold tracking-[0.2em] text-[#F97316]">DEPOIMENTOS</span>
        <h2 className="mt-3 text-3xl md:text-5xl font-extrabold text-[#0F172A] tracking-tight">
          Quem usa, recomenda
        </h2>

        <div className="mt-12 grid md:grid-cols-3 gap-5 text-left">
          {items.map((t) => (
            <div key={t.name} className="bg-[#F5F5F0] rounded-2xl p-7 border border-[#E2E8F0]">
              <div className="flex gap-0.5">
                {[0,1,2,3,4].map((i) => <Star key={i} className="h-4 w-4 fill-[#F97316] text-[#F97316]" />)}
              </div>
              <p className="mt-4 text-[#0F172A] leading-relaxed">"{t.text}"</p>
              <div className="mt-5 pt-4 border-t border-[#E2E8F0]">
                <div className="font-bold text-[#0F172A]">{t.name}</div>
                <div className="text-xs text-[#64748B]">{t.role}</div>
              </div>
            </div>
          ))}
        </div>

        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener"
          className="mt-12 inline-flex items-center gap-2 bg-white border-2 border-[#25D366] text-[#15803D] hover:bg-[#F0FDF4] active:scale-[0.97] font-bold px-7 py-4 rounded-xl transition-all"
        >
          <MessageCircle className="h-5 w-5" /> Quero falar com especialista no WhatsApp
        </a>
      </div>
    </section>
  );

/* ───────── Simulador de Economia ───────── */
const Simulator = () => (
  <section className="py-20 px-5 lg:px-8 bg-white">
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-10">
        <span className="text-xs font-bold tracking-[0.2em] text-[#F97316]">CALCULADORA</span>
        <h2 className="mt-3 text-3xl md:text-5xl font-extrabold text-[#0F172A] tracking-tight">
          Quanto seu restaurante pode faturar a mais?
        </h2>
        <p className="mt-4 text-[#475569] max-w-2xl mx-auto">
          Mexa nos sliders e veja sua projeção de receita com Menu's.
        </p>
      </div>
      <SavingsSimulator primaryColor="#F97316" primaryColorEnd="#FB923C" registerUrl={REGISTER_URL} />
    </div>
  </section>
);

/* ───────── Planos ───────── */
const Pricing = () => {
  const plans = [
    {
      name: "BÁSICO",
      price: "69,90",
      perDay: "≈ R$ 2,33/dia",
      featured: false,
      features: ["Cardápio digital ilimitado", "QR Code para mesas", "Pedidos em tempo real", "1 usuário administrador", "Suporte por email"],
    },
    {
      name: "INTERMEDIÁRIO",
      price: "149,90",
      perDay: "≈ R$ 5,00/dia",
      featured: false,
      features: ["Tudo do Básico", "Delivery completo (0% taxa)", "Gestão de estoque e CMV", "Relatórios e DRE", "Programa de fidelidade", "Até 5 usuários", "Suporte prioritário"],
    },
    {
      name: "AVANÇADO",
      price: "249,90",
      perDay: "≈ R$ 8,33/dia",
      featured: true,
      features: ["Tudo do Intermediário", "Robô IA Vendedor", "Marketing WhatsApp", "Remarketing automático", "Nota fiscal eletrônica", "Usuários ilimitados", "Suporte VIP"],
    },
  ];
  return (
    <section id="precos" className="py-20 px-5 lg:px-8 bg-[#F5F5F0]">
      <div className="max-w-6xl mx-auto text-center">
        <span className="text-xs font-bold tracking-[0.2em] text-[#F97316]">PLANOS E PREÇOS</span>
        <h2 className="mt-3 text-3xl md:text-5xl font-extrabold text-[#0F172A] tracking-tight">
          7 dias grátis em qualquer plano
        </h2>
        <p className="mt-4 text-[#475569]">Sem fidelidade, sem multa. Comece agora e mude quando quiser.</p>

        <div className="mt-12 grid md:grid-cols-3 gap-5 text-left items-start">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative bg-white rounded-2xl p-7 border transition-all hover:-translate-y-1 hover:shadow-xl ${
                p.featured ? "border-[#F97316] border-2 shadow-lg md:scale-105" : "border-[#E2E8F0]"
              }`}
            >
              {p.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#F97316] text-white text-[11px] font-bold px-3 py-1 rounded-full whitespace-nowrap">
                  ⭐ Mais escolhido
                </div>
              )}
              <div className="text-xs font-bold tracking-[0.18em] text-[#64748B]">{p.name}</div>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-sm text-[#64748B]">R$</span>
                <span className="text-4xl font-extrabold text-[#0F172A]">{p.price}</span>
                <span className="text-sm text-[#64748B]">/mês</span>
              </div>
              <div className="text-xs text-[#94A3B8]">{p.perDay}</div>

              <a
                href={REGISTER_URL}
                className={`mt-6 w-full inline-flex items-center justify-center gap-2 font-bold py-3 rounded-xl transition-all active:scale-[0.97] ${
                  p.featured
                    ? "bg-[#F97316] hover:bg-[#EA670B] text-white shadow-md"
                    : "bg-white border-2 border-[#0F172A]/10 hover:border-[#F97316] text-[#0F172A]"
                }`}
              >
                {p.featured ? "Experimentar grátis por 7 dias" : "Experimentar grátis"} <ArrowRight className="h-4 w-4" />
              </a>

              <div className="mt-6 border-t border-[#E2E8F0] pt-5 space-y-3">
                {p.features.map((f) => (
                  <div key={f} className="flex items-start gap-2.5 text-sm text-[#0F172A]">
                    <div className="h-5 w-5 rounded-full bg-[#FED7AA] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="h-3 w-3 text-[#9A3412]" strokeWidth={3} />
                    </div>
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 max-w-2xl mx-auto bg-white border border-[#E2E8F0] rounded-2xl p-6 flex flex-col md:flex-row items-center gap-4 text-left">
          <div className="flex-1">
            <p className="text-[#0F172A] font-semibold">Não sabe qual plano escolher?</p>
            <p className="text-sm text-[#64748B] mt-1">
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

        <p className="mt-8 text-xs text-[#64748B]">
          Cancele a qualquer momento  ·  Sem taxas por pedido  ·  Pagamento seguro
        </p>
      </div>
    </section>
  );
};

/* ───────── FAQ ───────── */
const FAQ = () => {
  const items = [
    { q: "Preciso instalar algum aplicativo?", a: "Não. O MenusApp roda 100% no navegador, tanto para você quanto para seus clientes. É só acessar o link e usar." },
    { q: "Posso cancelar a qualquer momento?", a: "Sim. Não há fidelidade nem multa. Você cancela direto no painel quando quiser." },
    { q: "Como funciona o delivery?", a: "Você cria zonas de entrega com taxas próprias, recebe os pedidos pelo painel e gerencia tudo sem pagar comissão por pedido." },
    { q: "O sistema emite nota fiscal?", a: "Sim, no plano Avançado emitimos NFC-e automaticamente integrado à Nuvem Fiscal." },
    { q: "Como funciona o Robô IA?", a: "Um agente de IA atende seus clientes no WhatsApp 24/7, tira dúvidas, sugere produtos e fecha pedidos automaticamente." },
    { q: "Como funciona o marketing por WhatsApp?", a: "Crie campanhas que disparam automaticamente para clientes que não pedem há X dias, com cupons personalizados — recuperando vendas no automático." },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="py-20 px-5 lg:px-8 bg-white">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-5xl font-extrabold text-[#0F172A] tracking-tight text-center">
          Perguntas frequentes
        </h2>
        <div className="mt-10 space-y-3">
          {items.map((it, i) => {
            const isOpen = open === i;
            return (
              <div key={it.q} className="border border-[#E2E8F0] rounded-xl overflow-hidden bg-white">
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#FAFAF8] transition"
                >
                  <span className="font-semibold text-[#0F172A]">{it.q}</span>
                  <ChevronDown className={`h-5 w-5 text-[#64748B] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-sm text-[#475569] leading-relaxed">{it.a}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

/* ───────── CTA Final ───────── */
const FinalCTA = () => (
  <section className="py-20 px-5 lg:px-8 bg-[#F97316]">
    <div className="max-w-4xl mx-auto text-center">
      <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight">
        Pronto para seu restaurante vender mais?
      </h2>
      <p className="mt-4 text-white/90 text-lg">
        Comece agora mesmo, é grátis. Sem cartão de crédito.
      </p>
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        <a
          href={REGISTER_URL}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white text-[#F97316] hover:bg-white/95 active:scale-[0.97] font-bold text-base px-7 py-4 rounded-xl shadow-lg transition-all"
        >
          <Rocket className="h-5 w-5" /> Começar grátis por 7 dias
        </a>
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-transparent border-2 border-white/70 text-white hover:bg-white/10 active:scale-[0.97] font-bold text-base px-7 py-4 rounded-xl transition-all"
        >
          <MessageCircle className="h-5 w-5" /> Falar no WhatsApp
        </a>
      </div>
      <p className="mt-5 text-xs text-white/85">
        ✓ Sem cartão  ·  ✓ Setup em 2 min  ·  ✓ Cancele quando quiser
      </p>
    </div>
  </section>
);

/* ───────── Footer ───────── */
const Footer = () => (
  <footer className="bg-[#0F172A] text-[#CBD5E1] px-5 lg:px-8 py-12">
    <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-xl bg-[#F97316] text-white flex items-center justify-center font-extrabold">M</div>
        <span className="font-extrabold text-white">Menu's</span>
      </div>
      <div className="flex flex-wrap items-center gap-6 text-sm">
        <a href="#solucoes" className="hover:text-white">Soluções</a>
        <a href="#recursos" className="hover:text-white">Recursos</a>
        <a href="#precos" className="hover:text-white">Preços</a>
        <a href="/login" className="hover:text-white">Entrar</a>
      </div>
      <div className="text-xs text-[#94A3B8]">© Menu's 2026 — Todos os direitos reservados.</div>
    </div>
  </footer>
);

/* ───────── WhatsApp Floating ───────── */
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

/* ───────── Page ───────── */
export default function LandingPageV2() {
  return (
    <div style={jakarta} className="min-h-screen bg-white text-[#0F172A] antialiased">
      <Navbar />
      <main>
        <Hero />
        <Stats />
        <Pain />
        <Steps />
        <Testimonials />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
      <WhatsAppFloat />
    </div>
  );
}

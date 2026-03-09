import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Check, Smartphone, ShoppingCart, BarChart3, Users, Utensils, Truck, Star, ArrowRight } from "lucide-react";
import menusLogo from "@/assets/menus-logo.png";

const plans = [
  {
    name: "Básico",
    price: "R$ 99",
    period: "/mês",
    description: "Ideal para começar",
    features: [
      "Cardápio digital ilimitado",
      "QR Code para mesas",
      "Pedidos em tempo real",
      "1 usuário administrador",
    ],
    cta: "Começar Agora",
    highlighted: false,
  },
  {
    name: "Profissional",
    price: "R$ 199",
    period: "/mês",
    description: "O mais popular",
    features: [
      "Tudo do Básico",
      "Delivery integrado",
      "Gestão de estoque",
      "Relatórios avançados",
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
    description: "Para grandes operações",
    features: [
      "Tudo do Profissional",
      "Marketing automatizado",
      "Programa de fidelidade",
      "Nota fiscal eletrônica",
      "Usuários ilimitados",
      "API & integrações",
    ],
    cta: "Falar com Vendas",
    highlighted: false,
  },
];

const features = [
  {
    icon: Smartphone,
    title: "Cardápio Digital",
    description: "Seu cardápio acessível por QR Code. Atualização em tempo real, sem reimprimir.",
  },
  {
    icon: ShoppingCart,
    title: "Pedidos Online",
    description: "Receba pedidos direto no painel. Sem intermediários, sem comissões absurdas.",
  },
  {
    icon: Truck,
    title: "Delivery Próprio",
    description: "Sistema completo de delivery com zonas, taxas e rastreamento de pedidos.",
  },
  {
    icon: BarChart3,
    title: "Relatórios & Gestão",
    description: "Dashboard com vendas, estoque, CMV, fluxo de caixa e muito mais.",
  },
  {
    icon: Users,
    title: "Clientes & Fidelidade",
    description: "Cadastro de clientes, programa de pontos e cupons de desconto.",
  },
  {
    icon: Utensils,
    title: "Gestão de Mesas",
    description: "Controle de mesas, comandas digitais e conta dividida.",
  },
];

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <img src={menusLogo} alt="Menu's" className="h-8 w-8" />
            <span className="text-xl font-bold text-foreground">Menu's</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Planos</a>
          </nav>
          <Button onClick={() => navigate("/login")} variant="outline" size="sm">
            Entrar no Painel
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <Star className="h-3.5 w-3.5" />
            Sistema completo para restaurantes
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground tracking-tight max-w-4xl mx-auto leading-tight">
            Seu restaurante na palma da mão do cliente
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Cardápio digital, pedidos, delivery, gestão de mesas e muito mais. Tudo em uma plataforma simples e poderosa.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="text-base px-8" onClick={() => {
              document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
            }}>
              Ver Planos
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8" onClick={() => navigate("/login")}>
              Já sou cliente
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 sm:py-28 bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Tudo que você precisa</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Um sistema completo para digitalizar e gerenciar seu restaurante de ponta a ponta.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <Card key={feature.title} className="border-border/50 hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Planos & Preços</h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Escolha o plano ideal para o tamanho do seu negócio. Sem fidelidade, cancele quando quiser.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative flex flex-col ${
                  plan.highlighted
                    ? "border-primary shadow-lg ring-2 ring-primary/20"
                    : "border-border/50"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                    Mais Popular
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-3 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span className="text-sm text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full mt-6"
                    variant={plan.highlighted ? "default" : "outline"}
                    onClick={() => {
                      // Placeholder - future payment integration
                      window.alert("Em breve! Entre em contato pelo WhatsApp.");
                    }}
                  >
                    {plan.cta}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary/5">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Pronto para digitalizar seu restaurante?</h2>
          <p className="text-lg text-muted-foreground mb-8">
            Comece agora e tenha seu cardápio digital funcionando em minutos.
          </p>
          <Button size="lg" className="text-base px-8" onClick={() => {
            document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" });
          }}>
            Escolher meu plano
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <img src={menusLogo} alt="Menu's" className="h-6 w-6" />
              <span className="font-semibold text-foreground">Menu's</span>
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

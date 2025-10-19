import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Download, Menu, QrCode, TrendingUp, Users, Monitor } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: <Menu className="h-8 w-8 text-primary" />,
      title: "Cardápio Digital",
      description: "Cardápios interativos e atualizáveis em tempo real"
    },
    {
      icon: <QrCode className="h-8 w-8 text-primary" />,
      title: "QR Code nas Mesas",
      description: "Clientes acessam o menu escaneando o código da mesa"
    },
    {
      icon: <TrendingUp className="h-8 w-8 text-primary" />,
      title: "Gestão Completa",
      description: "Controle de estoque, pedidos, caixa e relatórios"
    },
    {
      icon: <Users className="h-8 w-8 text-primary" />,
      title: "Multi-Restaurante",
      description: "Gerencie múltiplos estabelecimentos em uma única plataforma"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
              <Menu className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Menu's
            </span>
          </div>
          <div className="flex gap-4">
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Entrar
            </Button>
            <Button onClick={() => navigate("/auth?mode=signup")}>
              Começar Agora
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
          Transforme seu Restaurante
          <br />
          com Cardápios Digitais
        </h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Sistema completo de gestão de cardápios digitais com QR Code. 
          Aumente suas vendas e modernize seu atendimento.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Button size="lg" className="gap-2" onClick={() => navigate("/auth?mode=signup")}>
            <Download className="h-5 w-5" />
            Começar Gratuitamente
          </Button>
          <Button size="lg" variant="outline" onClick={() => {
            const featuresSection = document.getElementById('features');
            featuresSection?.scrollIntoView({ behavior: 'smooth' });
          }}>
            Saiba Mais
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-20">
        <h2 className="text-4xl font-bold text-center mb-4">
          Tudo que você precisa em um só lugar
        </h2>
        <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
          Funcionalidades completas para gerenciar seu restaurante de forma eficiente
        </p>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {features.map((feature, index) => (
            <Card key={index} className="border-border/50 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="mb-4">{feature.icon}</div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Download Desktop App Section */}
      <section className="container mx-auto px-4 py-20">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Monitor className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-3xl">
              Versão Desktop 100% Offline
            </CardTitle>
            <CardDescription className="text-lg max-w-2xl mx-auto">
              Baixe o Menu's para seu computador e funcione completamente sem internet. 
              Perfeito para restaurantes que precisam de autonomia total.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 justify-center flex-wrap mb-6">
              <Button size="lg" variant="outline" className="gap-2" asChild>
                <a href="#" onClick={(e) => {
                  e.preventDefault();
                  alert('Em breve: Installer Windows (.exe)');
                }}>
                  <Download className="h-5 w-5" />
                  Windows
                </a>
              </Button>
              <Button size="lg" variant="outline" className="gap-2" asChild>
                <a href="#" onClick={(e) => {
                  e.preventDefault();
                  alert('Em breve: Installer Mac (.dmg)');
                }}>
                  <Download className="h-5 w-5" />
                  macOS
                </a>
              </Button>
              <Button size="lg" variant="outline" className="gap-2" asChild>
                <a href="#" onClick={(e) => {
                  e.preventDefault();
                  alert('Em breve: Installer Linux (.AppImage)');
                }}>
                  <Download className="h-5 w-5" />
                  Linux
                </a>
              </Button>
            </div>
            <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <span>100% Offline</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <span>Banco de dados local</span>
              </div>
              <div className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <span>Todas as funcionalidades</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Benefits Section */}
      <section className="bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold mb-6">
                Por que escolher o Menu's?
              </h2>
              <div className="space-y-4">
                {[
                  "Redução de custos com impressão de cardápios",
                  "Atualização instantânea de preços e produtos",
                  "Aumento da velocidade no atendimento",
                  "Relatórios detalhados de vendas e estoque",
                  "Controle completo de caixa e financeiro",
                  "Suporte técnico especializado"
                ].map((benefit, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-lg">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-2xl">Como Funciona</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Cadastre-se</h3>
                    <p className="text-muted-foreground">Crie sua conta e configure seu restaurante</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Configure o Cardápio</h3>
                    <p className="text-muted-foreground">Adicione produtos, preços e imagens</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Gere QR Codes</h3>
                    <p className="text-muted-foreground">Imprima e coloque nas mesas do seu restaurante</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                    4
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Comece a Vender</h3>
                    <p className="text-muted-foreground">Clientes escaneiam e fazem pedidos direto pelo celular</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <Card className="border-border/50 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardHeader className="space-y-4 pb-8">
            <CardTitle className="text-4xl">
              Pronto para Começar?
            </CardTitle>
            <CardDescription className="text-lg">
              Junte-se a centenas de restaurantes que já modernizaram seu atendimento
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-8">
            <Button size="lg" onClick={() => navigate("/auth?mode=signup")} className="gap-2">
              <Download className="h-5 w-5" />
              Criar Conta Grátis
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              Sem cartão de crédito necessário. Configure em minutos.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-muted/30">
        <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
          <p>© 2025 Menu's. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;

import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSlugFromSubdomain } from "@/lib/slugResolver";

const NotFound = () => {
  const location = useLocation();
  const subdomainSlug = getSlugFromSubdomain();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname,
      subdomainSlug ? `(subdomain: ${subdomainSlug})` : ""
    );
  }, [location.pathname, subdomainSlug]);

  // Mensagem amigável quando o subdomínio acessado não corresponde a um restaurante
  const isUnknownRestaurant = !!subdomainSlug;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <Utensils className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="mb-2 text-3xl font-bold text-foreground">
          {isUnknownRestaurant ? "Restaurante não encontrado" : "Página não encontrada"}
        </h1>
        <p className="mb-6 text-muted-foreground">
          {isUnknownRestaurant
            ? `Não encontramos nenhum restaurante com o endereço "${subdomainSlug}.menusapp.com.br". Verifique se o link está correto.`
            : "A página que você procura não existe ou foi movida."}
        </p>
        <Button asChild>
          <Link to="/">Voltar para a página inicial</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;

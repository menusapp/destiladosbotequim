import { Navigate, useLocation } from "react-router-dom";
import { isSessionExpired, clearAdminSession } from "@/lib/sessionExpiry";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * O painel admin usa autenticação customizada (RPCs + localStorage).
 * Não dependemos de `supabase.auth.getSession()` aqui — esse caminho
 * causava spinner infinito em dispositivos novos quando a inicialização
 * do auth nativo demorava ou falhava silenciosamente.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();

  // Sessão expira após 7 dias para reforçar segurança
  if (isSessionExpired()) {
    clearAdminSession();
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const restaurantId = localStorage.getItem("restaurant_id");
  const staffId = localStorage.getItem("staff_id");

  if (!restaurantId) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!staffId) {
    return <Navigate to="/login/staff" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

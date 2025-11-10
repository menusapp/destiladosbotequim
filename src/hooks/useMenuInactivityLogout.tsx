import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hora em milissegundos

export const useMenuInactivityLogout = (
  tableId: string | null,
  tableNumber: string | undefined,
  restaurantSlug: string | undefined
) => {
  const navigate = useNavigate();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkAndLogout = async () => {
    if (!tableId || !tableNumber || !restaurantSlug) return;

    try {
      // Verificar se há pedidos ou contas ativas para esta mesa
      const { data: activeOrders } = await supabase
        .from("orders")
        .select("id")
        .eq("table_id", tableId)
        .in("status", ["pending", "preparing", "ready"])
        .limit(1);

      const { data: unpaidBills } = await supabase
        .from("bills")
        .select("id")
        .eq("table_id", tableId)
        .neq("status", "paid")
        .limit(1);

      // Se houver pedidos ativos ou contas não pagas, não deslogar
      if ((activeOrders && activeOrders.length > 0) || (unpaidBills && unpaidBills.length > 0)) {
        console.log("Cliente tem pedidos/contas ativas, mantendo sessão");
        // Resetar o timer para verificar novamente daqui a 1 hora
        resetTimer();
        return;
      }

      // Se não houver pedidos/contas, deslogar
      console.log("Nenhum pedido/conta ativo, deslogando por inatividade");

      // Liberar a mesa
      await supabase
        .from("tables")
        .update({
          is_occupied: false,
          occupied_at: null,
          occupied_by: null
        })
        .eq("id", tableId);

      // Limpar sessionStorage
      sessionStorage.removeItem(`customer_name_${tableNumber}`);
      sessionStorage.removeItem(`customer_cpf_${tableNumber}`);
      sessionStorage.removeItem(`cart_${tableNumber}`);

      // Mostrar mensagem e recarregar a página para forçar o dialog de login
      toast.info("Sessão expirada por inatividade");
      window.location.href = `/menu/${restaurantSlug}/${tableNumber}`;
    } catch (error) {
      console.error("Erro ao verificar pedidos ativos:", error);
    }
  };

  const resetTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(checkAndLogout, INACTIVITY_TIMEOUT);
  };

  useEffect(() => {
    // Só ativar o timer se houver tableId (ou seja, se o cliente estiver logado)
    if (!tableId) return;

    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"];

    const handleActivity = () => {
      resetTimer();
    };

    // Iniciar o timer
    resetTimer();

    // Adicionar listeners de atividade
    events.forEach((event) => {
      document.addEventListener(event, handleActivity);
    });

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [tableId, tableNumber, restaurantSlug, navigate]);
};

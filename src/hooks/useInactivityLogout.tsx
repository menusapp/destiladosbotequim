import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";

const INACTIVITY_TIMEOUT = 60 * 60 * 1000; // 1 hora em milissegundos

export const useInactivityLogout = () => {
  const navigate = useNavigate();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      // Only clear staff session, keep restaurant session so user can re-login faster
      localStorage.removeItem('staff_id');
      localStorage.removeItem('staff_name');
      localStorage.removeItem('staff_role');
      localStorage.removeItem('staff_allowed_sections');
      localStorage.removeItem('staff_can_manage_orders');
      localStorage.removeItem('staff_receives_order_notifications');
      toast.info("Sessão expirada por inatividade");
      navigate("/login/staff");
    }, INACTIVITY_TIMEOUT);
  };

  useEffect(() => {
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
  }, [navigate]);
};

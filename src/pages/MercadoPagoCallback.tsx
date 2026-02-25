import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const MercadoPagoCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      toast.error("Parâmetros inválidos no callback do Mercado Pago");
      navigate("/admin", { replace: true });
      return;
    }

    const exchangeCode = async () => {
      try {
        const redirectUri = window.location.origin + "/admin/mercadopago/callback";

        const { data, error } = await supabase.functions.invoke("mercadopago-oauth", {
          body: { code, state, redirectUri },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        toast.success("Conta Mercado Pago conectada com sucesso!");
      } catch (err: any) {
        console.error("OAuth callback error:", err);
        toast.error(err.message || "Erro ao conectar conta Mercado Pago");
      } finally {
        setProcessing(false);
        navigate("/admin", { replace: true });
      }
    };

    exchangeCode();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-muted-foreground">
        {processing ? "Conectando sua conta Mercado Pago..." : "Redirecionando..."}
      </p>
    </div>
  );
};

export default MercadoPagoCallback;

import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const MercadoPagoCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Conectando sua conta Mercado Pago...");
  const processedRef = useRef(false);

  useEffect(() => {
    // Prevent double execution in strict mode
    if (processedRef.current) return;
    processedRef.current = true;

    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      setStatus("error");
      setMessage("Parâmetros inválidos no callback do Mercado Pago.");
      toast.error("Parâmetros inválidos no callback do Mercado Pago");
      const slug = localStorage.getItem("restaurant_slug") || "";
      setTimeout(() => navigate(slug ? `/${slug}/admin` : "/login", { replace: true }), 2000);
      return;
    }

    const exchangeCode = async () => {
      try {
        setMessage("Trocando código de autorização...");
        const redirectUri = window.location.origin + "/admin/mercadopago/callback";

        const { data, error } = await supabase.functions.invoke("mercadopago-oauth", {
          body: { code, state, redirectUri },
        });

        if (error) {
          console.error("Edge function error:", error);
          throw new Error(error.message || "Erro na Edge Function");
        }

        if (data?.error) {
          console.error("OAuth error response:", data);
          throw new Error(data.error);
        }

        setStatus("success");
        setMessage("Conta Mercado Pago conectada com sucesso!");
        toast.success("Conta Mercado Pago conectada com sucesso!");
      } catch (err: any) {
        console.error("OAuth callback error:", err);
        setStatus("error");
        const errorMsg = err?.message || "Erro desconhecido ao conectar conta Mercado Pago";
        setMessage(`Erro: ${errorMsg}`);
        toast.error(errorMsg);
      } finally {
        // Always redirect back after a short delay
        setTimeout(() => {
          navigate("/admin", { replace: true });
        }, 2500);
      }
    };

    exchangeCode();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
      {status === "processing" && (
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      )}
      {status === "success" && (
        <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
      {status === "error" && (
        <div className="h-10 w-10 rounded-full bg-destructive flex items-center justify-center">
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
      )}
      <p className="text-muted-foreground text-center max-w-md">{message}</p>
      <p className="text-xs text-muted-foreground">Redirecionando para o painel...</p>
    </div>
  );
};

export default MercadoPagoCallback;

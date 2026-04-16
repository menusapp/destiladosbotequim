import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { validatePhone } from "@/lib/cpfValidator";

interface Props {
  primaryColor: string;
  customerCpf: string;
  restaurantId: string;
  onPhoneSaved: (phone: string) => void;
  onBack: () => void;
}

export function KioskPhoneCollection({ primaryColor, customerCpf, restaurantId, onPhoneSaved, onBack }: Props) {
  const [phone, setPhone] = useState("");

  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  const rawPhone = phone.replace(/\D/g, "");
  const isValid = rawPhone.length >= 10 && validatePhone(rawPhone);

  const handleSave = async () => {
    if (!isValid) return;
    // Format to 55DDXXXXXXXXX for Evolution API
    const formatted = rawPhone.length === 11 ? `55${rawPhone}` : `55${rawPhone}`;
    try {
      await supabase
        .from("customers")
        .update({ phone: formatted })
        .eq("cpf", customerCpf)
        .eq("restaurant_id", restaurantId);
      onPhoneSaved(formatted);
    } catch (err) {
      console.error("[KioskPhone] Error saving phone:", err);
      toast.error("Erro ao salvar telefone");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex items-center gap-4 p-5 border-b bg-card shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-12 w-12 rounded-full">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h2 className="text-xl font-bold text-foreground">Seu WhatsApp</h2>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 max-w-lg mx-auto w-full">
        <div className="h-20 w-20 rounded-2xl flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
          <Bell className="h-10 w-10 text-white" />
        </div>

        <h2 className="text-2xl font-bold text-foreground text-center">Seu número de WhatsApp</h2>

        <p className="text-muted-foreground text-lg text-center">
          Vamos te avisar pelo WhatsApp quando seu pedido estiver pronto para retirar no balcão!
        </p>

        <Input
          type="tel"
          placeholder="(00) 00000-0000"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          className="text-xl h-14 text-center"
          inputMode="tel"
          maxLength={15}
          autoFocus
        />
      </div>

      <div className="border-t bg-card p-5 shrink-0">
        <div className="max-w-lg mx-auto">
          <Button
            onClick={handleSave}
            className="w-full h-14 text-lg font-bold rounded-xl text-white"
            style={{ backgroundColor: primaryColor }}
            disabled={!isValid}
          >
            Confirmar e continuar
          </Button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { validateCPF } from "@/lib/cpfValidator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, UserCheck } from "lucide-react";

interface CustomerInfoDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, cpf: string, phone?: string) => void;
  restaurantColor?: string;
  restaurantId?: string;
  requireName?: boolean;
  requirePhone?: boolean;
}

const CustomerInfoDialog = ({ 
  open,
  onClose, 
  onSubmit, 
  restaurantColor = "#FF6B35",
  restaurantId,
  requireName = true,
  requirePhone = false
}: CustomerInfoDialogProps) => {
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [cpfError, setCpfError] = useState("");
  const [isCheckingCpf, setIsCheckingCpf] = useState(false);
  const [existingCustomer, setExistingCustomer] = useState<{name: string; phone?: string} | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setName("");
      setCpf("");
      setPhone("");
      setCpfError("");
      setExistingCustomer(null);
    }
  }, [open]);

  // Check for existing customer when CPF is valid
  useEffect(() => {
    const checkExistingCustomer = async () => {
      const sanitizedCPF = cpf.replace(/\D/g, "");
      
      if (sanitizedCPF.length !== 11 || !validateCPF(sanitizedCPF) || !restaurantId) {
        setExistingCustomer(null);
        return;
      }

      setIsCheckingCpf(true);
      try {
        const { data, error } = await supabase
          .from("customers")
          .select("name, phone")
          .eq("restaurant_id", restaurantId)
          .eq("cpf", sanitizedCPF)
          .maybeSingle();

        if (!error && data) {
          setExistingCustomer(data);
          setName(data.name); // Auto-fill name
          if (data.phone) setPhone(data.phone); // Auto-fill phone
        } else {
          setExistingCustomer(null);
        }
      } catch (err) {
        console.error("Error checking customer:", err);
        setExistingCustomer(null);
      } finally {
        setIsCheckingCpf(false);
      }
    };

    const debounceTimer = setTimeout(checkExistingCustomer, 300);
    return () => clearTimeout(debounceTimer);
  }, [cpf, restaurantId]);

  const formatCPFInput = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const formatPhoneInput = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPFInput(e.target.value);
    setCpf(formatted);
    setCpfError("");
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneInput(e.target.value);
    setPhone(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const sanitizedCPF = cpf.replace(/\D/g, "");
    
    if (!sanitizedCPF || sanitizedCPF.length !== 11) {
      toast.error("Por favor, informe seu CPF completo");
      return;
    }

    if (!validateCPF(sanitizedCPF)) {
      setCpfError("CPF inválido");
      toast.error("CPF inválido. Por favor, verifique o número digitado.");
      return;
    }

    // If existing customer, use their saved name (ignore whatever was typed)
    const finalName = existingCustomer ? existingCustomer.name : name.trim();
    const finalPhone = existingCustomer?.phone || phone.replace(/\D/g, "") || undefined;

    if (requireName && !finalName) {
      toast.error("Por favor, informe seu nome");
      return;
    }

    if (requirePhone && !finalPhone && !existingCustomer?.phone) {
      toast.error("Por favor, informe seu telefone");
      return;
    }

    // If new customer, create record in database
    if (!existingCustomer && restaurantId) {
      try {
        const insertData: { restaurant_id: string; cpf: string; name: string; phone?: string } = {
          restaurant_id: restaurantId,
          cpf: sanitizedCPF,
          name: finalName || "Cliente",
        };
        if (finalPhone) {
          insertData.phone = finalPhone;
        }
        await supabase
          .from("customers")
          .insert(insertData);
      } catch (err) {
        console.error("Error creating customer:", err);
        // Continue anyway - the customer will be created on order if this fails
      }
    }

    onSubmit(finalName || "Cliente", sanitizedCPF, finalPhone);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {existingCustomer ? "Bem-vindo de volta!" : "Bem-vindo!"}
          </DialogTitle>
          <DialogDescription>
            {existingCustomer 
              ? `Olá, ${existingCustomer.name}! Bom te ver novamente.`
              : "Para começar seu pedido, precisamos de algumas informações"
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customer-cpf">CPF</Label>
            <div className="relative">
              <Input
                id="customer-cpf"
                value={cpf}
                onChange={handleCPFChange}
                placeholder="000.000.000-00"
                required
                maxLength={14}
                className={cpfError ? "border-destructive" : ""}
              />
              {isCheckingCpf && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {cpfError && (
              <p className="text-sm text-destructive">{cpfError}</p>
            )}
          </div>

          {existingCustomer ? (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
              <UserCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">{existingCustomer.name}</p>
                {existingCustomer.phone && (
                  <p className="text-sm text-green-600 dark:text-green-400">📞 {formatPhoneInput(existingCustomer.phone)}</p>
                )}
                <p className="text-sm text-green-600 dark:text-green-400">Cliente cadastrado</p>
              </div>
            </div>
          ) : (
            <>
              {requireName && (
                <div className="space-y-2">
                  <Label htmlFor="customer-name">Nome</Label>
                  <Input
                    id="customer-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Digite seu nome"
                    required={requireName}
                    disabled={isCheckingCpf}
                  />
                </div>
              )}

              {requirePhone && (
                <div className="space-y-2">
                  <Label htmlFor="customer-phone">Telefone</Label>
                  <Input
                    id="customer-phone"
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="(00) 00000-0000"
                    required={requirePhone}
                    disabled={isCheckingCpf}
                    maxLength={15}
                  />
                </div>
              )}
            </>
          )}

          <Button 
            type="submit" 
            className="w-full text-white"
            style={{ backgroundColor: restaurantColor }}
            disabled={isCheckingCpf}
          >
            {existingCustomer ? "Continuar" : "Começar Pedido"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerInfoDialog;

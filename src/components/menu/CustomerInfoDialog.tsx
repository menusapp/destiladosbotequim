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
import { validateCPF, validatePhone } from "@/lib/cpfValidator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
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
  const [phoneError, setPhoneError] = useState("");
  const [isCheckingCpf, setIsCheckingCpf] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingCustomer, setExistingCustomer] = useState<{name: string; phone?: string} | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setName("");
      setCpf("");
      setPhone("");
      setCpfError("");
      setPhoneError("");
      setExistingCustomer(null);
      setIsCheckingCpf(false);
      setIsSubmitting(false);
    }
  }, [open]);

  // Check for existing customer when CPF is valid
  useEffect(() => {
    const sanitizedCPF = cpf.replace(/\D/g, "");
    
    // Se CPF não está completo ou inválido, garantir que não está "checking"
    if (sanitizedCPF.length !== 11 || !validateCPF(sanitizedCPF) || !restaurantId) {
      setExistingCustomer(null);
      setIsCheckingCpf(false);
      return;
    }

    // Setar como checking ANTES do debounce
    setIsCheckingCpf(true);

    const checkExistingCustomer = async () => {
      try {
        const { data, error } = await supabase
          .from("customers")
          .select("name, phone")
          .eq("restaurant_id", restaurantId)
          .eq("cpf", sanitizedCPF)
          .maybeSingle();

        if (!error && data) {
          setExistingCustomer(data);
          setName(data.name);
          if (data.phone) setPhone(data.phone);
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
    setPhoneError(""); // Limpar erro ao digitar
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

    if (requireName && !finalName) {
      toast.error("Por favor, informe seu nome");
      return;
    }

    // Validar telefone se preenchido
    const typedPhone = phone.replace(/\D/g, "");
    if (typedPhone && !validatePhone(typedPhone)) {
      setPhoneError("Número de telefone inválido");
      toast.error("Número de telefone inválido. Verifique o DDD e o número.");
      return;
    }

    // Validar telefone: se requirePhone e não tem telefone (nem salvo nem digitado)
    const finalPhone = existingCustomer?.phone || typedPhone || undefined;
    if (requirePhone && !finalPhone) {
      toast.error("Por favor, informe seu telefone");
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Se cliente existente mas sem telefone e foi digitado um telefone, atualizar
      if (existingCustomer && !existingCustomer.phone && typedPhone && restaurantId) {
        // Verificar se telefone já existe em outro cliente
        const { data: phoneExists } = await supabase
          .from("customers")
          .select("cpf, name")
          .eq("restaurant_id", restaurantId)
          .eq("phone", typedPhone)
          .neq("cpf", sanitizedCPF)
          .maybeSingle();

        if (phoneExists) {
          setPhoneError("Este telefone já está cadastrado para outro cliente");
          toast.error("Este telefone já está cadastrado para outro cliente");
          setIsSubmitting(false);
          return;
        }

        // Atualizar telefone do cliente existente
        await supabase
          .from("customers")
          .update({ phone: typedPhone })
          .eq("restaurant_id", restaurantId)
          .eq("cpf", sanitizedCPF);
      }

      // If new customer, create record in database
      if (!existingCustomer && restaurantId) {
        // Verificar se telefone já existe em outro cliente
        if (finalPhone) {
          const { data: phoneExists } = await supabase
            .from("customers")
            .select("cpf, name")
            .eq("restaurant_id", restaurantId)
            .eq("phone", finalPhone)
            .neq("cpf", sanitizedCPF)
            .maybeSingle();

          if (phoneExists) {
            setPhoneError("Este telefone já está cadastrado para outro cliente");
            toast.error("Este telefone já está cadastrado para outro cliente");
            setIsSubmitting(false);
            return;
          }
        }

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
      }
    } catch (err) {
      console.error("Error saving customer:", err);
      // Continue anyway - the customer will be created on order if this fails
    } finally {
      setIsSubmitting(false);
    }

    onSubmit(finalName || "Cliente", sanitizedCPF, finalPhone);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-md">
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

          {existingCustomer && (
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
          )}

          {/* Campo de nome - só para novos clientes */}
          {!existingCustomer && requireName && (
            <div className="space-y-2">
              <Label htmlFor="customer-name">Nome</Label>
              <Input
                id="customer-name"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 35))}
                placeholder="Digite seu nome"
                required={requireName}
                disabled={isCheckingCpf}
                maxLength={35}
              />
            </div>
          )}

          {/* Campo de telefone - para novos clientes OU clientes existentes sem telefone */}
          {((!existingCustomer && requirePhone) || (existingCustomer && !existingCustomer.phone && requirePhone)) && (
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
                className={phoneError ? "border-destructive" : ""}
              />
              {phoneError && (
                <p className="text-sm text-destructive">{phoneError}</p>
              )}
              {existingCustomer && (
                <p className="text-xs text-muted-foreground">
                  Complete seu cadastro informando seu telefone
                </p>
              )}
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full text-white"
            style={{ backgroundColor: restaurantColor }}
            disabled={isCheckingCpf || isSubmitting}
          >
            {isSubmitting ? "Verificando..." : existingCustomer ? "Continuar" : "Começar Pedido"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerInfoDialog;

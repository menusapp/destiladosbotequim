import { useState } from "react";
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
import { toast } from "sonner";

interface CustomerInfoDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, cpf?: string) => void;
  restaurantColor?: string;
}

const CustomerInfoDialog = ({ 
  open,
  onClose, 
  onSubmit, 
  restaurantColor = "#FF6B35"
}: CustomerInfoDialogProps) => {
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [cpfError, setCpfError] = useState("");

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCpf(value);
    setCpfError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error("Por favor, informe seu nome");
      return;
    }

    if (!cpf.trim()) {
      toast.error("Por favor, informe seu CPF");
      return;
    }

    const sanitizedCPF = cpf.replace(/\D/g, "");
    
    if (!validateCPF(sanitizedCPF)) {
      setCpfError("CPF inválido");
      toast.error("CPF inválido. Por favor, verifique o número digitado.");
      return;
    }

    onSubmit(name.trim(), sanitizedCPF);
  };
  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Bem-vindo!</DialogTitle>
          <DialogDescription>
            Para começar seu pedido, precisamos de algumas informações
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="customer-name">Nome</Label>
            <Input
              id="customer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Digite seu nome"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer-cpf">CPF</Label>
            <Input
              id="customer-cpf"
              value={cpf}
              onChange={handleCPFChange}
              placeholder="000.000.000-00"
              required
              maxLength={14}
              className={cpfError ? "border-destructive" : ""}
            />
            {cpfError && (
              <p className="text-sm text-destructive">{cpfError}</p>
            )}
          </div>
          <Button 
            type="submit" 
            className="w-full text-white"
            style={{ backgroundColor: restaurantColor }}
          >
            Começar Pedido
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerInfoDialog;

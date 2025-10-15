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

interface CustomerInfoDialogProps {
  open: boolean;
  onSubmit: (name: string, cpf: string) => void;
  restaurantColor?: string;
  isColetiva?: boolean;
}

const CustomerInfoDialog = ({ 
  open, 
  onSubmit, 
  restaurantColor = "#FF6B35",
  isColetiva = false 
}: CustomerInfoDialogProps) => {
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && cpf.trim()) {
      onSubmit(name.trim(), cpf.trim());
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>
            {isColetiva ? "Comanda Coletiva" : "Bem-vindo!"}
          </DialogTitle>
          <DialogDescription>
            {isColetiva 
              ? "Compartilhe o CPF com todos que vão pedir juntos" 
              : "Para começar seu pedido, precisamos de algumas informações"}
          </DialogDescription>
        </DialogHeader>
        
        {isColetiva && (
          <div className="bg-amber-50 border border-amber-500 rounded-lg p-3 text-sm">
            <p className="text-amber-800 font-semibold">
              ⚠️ Usem o mesmo CPF para todos os dispositivos
            </p>
            <p className="text-amber-700 text-xs mt-1">
              Cada pessoa coloca seu nome, mas todos usam o mesmo CPF para compartilhar a comanda
            </p>
          </div>
        )}

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
              onChange={(e) => setCpf(e.target.value)}
              placeholder="000.000.000-00"
              required
            />
          </div>
          <Button 
            type="submit" 
            className="w-full text-white"
            style={{ backgroundColor: restaurantColor }}
          >
            {isColetiva ? "Entrar na Comanda" : "Começar Pedido"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerInfoDialog;

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
}

const CustomerInfoDialog = ({ open, onSubmit }: CustomerInfoDialogProps) => {
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
              onChange={(e) => setCpf(e.target.value)}
              placeholder="000.000.000-00"
              required
            />
          </div>
          <Button type="submit" className="w-full">
            Começar Pedido
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerInfoDialog;

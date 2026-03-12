import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, User, Check } from "lucide-react";

interface Customer {
  id: string;
  cpf: string;
  name: string;
  phone: string | null;
  defaultAddress?: {
    street: string;
    number: string;
    complement: string | null;
    neighborhood: string;
    city: string;
    state: string;
    zip_code: string;
  } | null;
}

interface CustomerSelectDialogProps {
  restaurantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (customer: Customer) => void;
}

export const CustomerSelectDialog = ({
  restaurantId,
  open,
  onOpenChange,
  onSelect,
}: CustomerSelectDialogProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch customers
  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers-select", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, cpf, name, phone")
        .eq("restaurant_id", restaurantId)
        .order("name");

      if (error) throw error;
      return data as Customer[];
    },
    enabled: open,
  });

  // Filter customers
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    if (!searchTerm) return customers;

    const term = searchTerm.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.cpf.includes(term) ||
        c.phone?.includes(term)
    );
  }, [customers, searchTerm]);

  const formatCpf = (cpf: string) => {
    const digits = cpf.replace(/\D/g, "");
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }
    return cpf;
  };

  const handleSelect = (customer: Customer) => {
    onSelect(customer);
    onOpenChange(false);
    setSearchTerm("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Selecionar Cliente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {/* Customer list */}
          <ScrollArea className="h-[300px] border rounded-lg">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground">
                Carregando...
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                {searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
              </div>
            ) : (
              <div className="divide-y">
                {filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    className="w-full p-3 text-left hover:bg-muted/50 transition-colors flex items-center justify-between group"
                    onClick={() => handleSelect(customer)}
                  >
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {formatCpf(customer.cpf)}
                        {customer.phone && ` • ${customer.phone}`}
                      </p>
                    </div>
                    <Check className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

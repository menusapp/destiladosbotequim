import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, User, Check, MapPin, Plus, ChevronLeft } from "lucide-react";
import { toast } from "@/components/ui/sonner";

interface Address {
  id: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zip_code: string;
  is_default: boolean;
}

interface Customer {
  id: string;
  cpf: string;
  name: string;
  phone: string | null;
  addresses?: Address[];
  defaultAddress?: Address | null;
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
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newStreet, setNewStreet] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [newComplement, setNewComplement] = useState("");
  const [newNeighborhood, setNewNeighborhood] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newState, setNewState] = useState("");
  const [newZipCode, setNewZipCode] = useState("");

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

  // Fetch addresses ONLY for customers of this restaurant + only the columns
  // we actually use in the filter below. Restricting by CPF list avoids
  // pulling addresses from other restaurants and reduces payload size.
  const { data: allAddresses } = useQuery({
    queryKey: ["customer-addresses-all", restaurantId, customers?.length ?? 0],
    queryFn: async () => {
      const cpfs = (customers ?? []).map((c) => c.cpf).filter(Boolean);
      if (cpfs.length === 0) return [] as Array<{
        customer_cpf: string; street: string; number: string;
        neighborhood: string; city: string; zip_code: string;
      }>;
      const { data } = await supabase
        .from("customer_addresses")
        .select("customer_cpf, street, number, neighborhood, city, zip_code")
        .in("customer_cpf", cpfs);
      return data || [];
    },
    enabled: open && !!customers && customers.length > 0,
  });

  // Filter customers by name, CPF, phone, or address
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    if (!searchTerm) return customers;

    const term = searchTerm.toLowerCase();
    
    // Find CPFs that match by address
    const cpfsWithMatchingAddress = new Set<string>();
    allAddresses?.forEach((addr: any) => {
      const addrStr = `${addr.street} ${addr.number} ${addr.neighborhood} ${addr.city} ${addr.zip_code}`.toLowerCase();
      if (addrStr.includes(term)) {
        cpfsWithMatchingAddress.add(addr.customer_cpf);
      }
    });

    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.cpf.includes(term) ||
        c.phone?.includes(term) ||
        cpfsWithMatchingAddress.has(c.cpf)
    );
  }, [customers, searchTerm, allAddresses]);

  const formatCpf = (cpf: string) => {
    const digits = cpf.replace(/\D/g, "");
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }
    return cpf;
  };

  const handleSelectCustomer = async (customer: { id: string; cpf: string; name: string; phone: string | null }) => {
    // Fetch ALL addresses for the customer
    const { data: addrData } = await supabase
      .from("customer_addresses")
      .select("id, street, number, complement, neighborhood, city, state, zip_code, is_default")
      .eq("customer_cpf", customer.cpf)
      .order("is_default", { ascending: false });

    const addresses = (addrData || []) as Address[];
    
    if (addresses.length === 0) {
      // No addresses → select immediately
      onSelect({ ...customer, addresses: [], defaultAddress: null });
      resetAndClose();
    } else {
      // Show address picker
      setSelectedCustomer({ ...customer, addresses });
    }
  };

  const handlePickAddress = (address: Address | null) => {
    if (!selectedCustomer) return;
    onSelect({
      ...selectedCustomer,
      defaultAddress: address,
    });
    resetAndClose();
  };

  const handleCepLookup = async (cep: string) => {
    setNewZipCode(cep);
    const clean = cep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setNewStreet(data.logradouro || "");
        setNewNeighborhood(data.bairro || "");
        setNewCity(data.localidade || "");
        setNewState(data.uf || "");
      }
    } catch { /* ignore */ }
  };

  const handleSaveNewAddress = async () => {
    if (!selectedCustomer || !newStreet || !newNumber || !newNeighborhood || !newCity || !newState) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    const { data, error } = await supabase.from("customer_addresses").insert({
      customer_cpf: selectedCustomer.cpf,
      customer_name: selectedCustomer.name,
      customer_phone: selectedCustomer.phone || "",
      street: newStreet,
      number: newNumber,
      complement: newComplement || null,
      neighborhood: newNeighborhood,
      city: newCity,
      state: newState,
      zip_code: newZipCode,
      is_default: false,
    }).select().single();

    if (error) {
      toast.error("Erro ao salvar endereço");
      return;
    }

    toast.success("Endereço salvo!");
    const newAddr = data as Address;
    
    // Select this new address immediately
    onSelect({
      ...selectedCustomer,
      defaultAddress: newAddr,
    });
    resetAndClose();
  };

  const resetAndClose = () => {
    setSearchTerm("");
    setSelectedCustomer(null);
    setShowAddAddress(false);
    clearNewAddress();
    onOpenChange(false);
  };

  const clearNewAddress = () => {
    setNewStreet(""); setNewNumber(""); setNewComplement("");
    setNewNeighborhood(""); setNewCity(""); setNewState(""); setNewZipCode("");
  };

  // View: Address picker for selected customer
  if (selectedCustomer) {
    if (showAddAddress) {
      return (
        <Dialog open={open} onOpenChange={() => resetAndClose()}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAddAddress(false)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                Novo Endereço
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">CEP</Label>
                <Input placeholder="00000-000" value={newZipCode} onChange={e => handleCepLookup(e.target.value)} className="h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Rua *</Label>
                <Input value={newStreet} onChange={e => setNewStreet(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Número *</Label>
                  <Input value={newNumber} onChange={e => setNewNumber(e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Complemento</Label>
                  <Input value={newComplement} onChange={e => setNewComplement(e.target.value)} className="h-8 text-sm" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Bairro *</Label>
                <Input value={newNeighborhood} onChange={e => setNewNeighborhood(e.target.value)} className="h-8 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Cidade *</Label>
                  <Input value={newCity} onChange={e => setNewCity(e.target.value)} className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Estado *</Label>
                  <Input value={newState} onChange={e => setNewState(e.target.value)} className="h-8 text-sm" maxLength={2} />
                </div>
              </div>
              <Button className="w-full" onClick={handleSaveNewAddress}>Salvar e Usar</Button>
            </div>
          </DialogContent>
        </Dialog>
      );
    }

    return (
      <Dialog open={open} onOpenChange={() => resetAndClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedCustomer(null)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              Endereços de {selectedCustomer.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {selectedCustomer.addresses?.map(addr => (
                  <Card
                    key={addr.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handlePickAddress(addr)}
                  >
                    <CardContent className="p-3 flex items-start gap-2">
                      <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {addr.street}, {addr.number}
                          {addr.complement && ` - ${addr.complement}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {addr.neighborhood} • {addr.city} - {addr.state}
                        </p>
                        {addr.zip_code && (
                          <p className="text-xs text-muted-foreground font-mono">{addr.zip_code}</p>
                        )}
                      </div>
                      {addr.is_default && <Badge variant="secondary" className="text-[10px]">Padrão</Badge>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            <Button variant="outline" className="w-full" onClick={() => setShowAddAddress(true)}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar novo endereço
            </Button>

            <Button variant="ghost" className="w-full text-xs" onClick={() => handlePickAddress(null)}>
              Continuar sem endereço
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // View: Customer list
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
              placeholder="Buscar por nome, CPF, telefone ou endereço..."
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
                    onClick={() => handleSelectCustomer(customer)}
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

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Users, UserPlus, TrendingUp, ArrowUpDown, Phone, Mail, ShoppingBag } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { CustomerDetailDrawer } from "./CustomerDetailDrawer";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClientesTabProps {
  restaurantId: string;
}

interface Customer {
  id: string;
  cpf: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
  total_orders?: number;
  total_spent?: number;
}

type SortOption = 'most_spent' | 'least_spent' | 'recent' | 'oldest' | 'alphabetical';

export const ClientesTab = ({ restaurantId }: ClientesTabProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);
  
  // New customer form
  const [newName, setNewName] = useState("");
  const [newCpf, setNewCpf] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newNotes, setNewNotes] = useState("");
  // Address fields
  const [newCep, setNewCep] = useState("");
  const [newStreet, setNewStreet] = useState("");
  const [newNumber, setNewNumber] = useState("");
  const [newComplement, setNewComplement] = useState("");
  const [newNeighborhood, setNewNeighborhood] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newState, setNewState] = useState("");

  // Fetch customers with order stats
  const { data: customers, isLoading, refetch } = useQuery({
    queryKey: ["customers", restaurantId],
    queryFn: async () => {
      const { data: customersData, error } = await supabase
        .from("customers")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("name");

      if (error) throw error;

      // Batch: fetch ALL orders and comandas for the restaurant in 2 queries instead of N*2
      const [{ data: allOrders }, { data: allComandas }] = await Promise.all([
        supabase
          .from("orders")
          .select(`id, customer_cpf, order_items(price_at_order, quantity, order_item_extras(price_at_order))`)
          .eq("restaurant_id", restaurantId),
        supabase
          .from("comandas")
          .select(`id, customer_cpf, bills(total_amount, status)`)
          .eq("restaurant_id", restaurantId),
      ]);

      // Aggregate client-side by cpf
      const ordersByCpf = new Map<string, { count: number; spent: number }>();
      (allOrders || []).forEach((order: any) => {
        const cpf = order.customer_cpf;
        const existing = ordersByCpf.get(cpf) || { count: 0, spent: 0 };
        existing.count += 1;
        const orderSpent = (order.order_items || []).reduce((itemSum: number, item: any) => {
          const extrasTotal = (item.order_item_extras || []).reduce((s: number, e: any) => s + e.price_at_order, 0);
          return itemSum + (item.price_at_order + extrasTotal) * item.quantity;
        }, 0);
        existing.spent += orderSpent;
        ordersByCpf.set(cpf, existing);
      });

      const comandasByCpf = new Map<string, { count: number; spent: number }>();
      (allComandas || []).forEach((comanda: any) => {
        const cpf = comanda.customer_cpf;
        const existing = comandasByCpf.get(cpf) || { count: 0, spent: 0 };
        existing.count += 1;
        const billTotal = (comanda.bills || []).reduce((billSum: number, bill: any) => {
          if (bill.status === 'paid') return billSum + (bill.total_amount || 0);
          return billSum;
        }, 0);
        existing.spent += billTotal;
        comandasByCpf.set(cpf, existing);
      });

      const customersWithStats = (customersData || []).map(customer => {
        const orderStats = ordersByCpf.get(customer.cpf) || { count: 0, spent: 0 };
        const comandaStats = comandasByCpf.get(customer.cpf) || { count: 0, spent: 0 };
        return {
          ...customer,
          total_orders: orderStats.count + comandaStats.count,
          total_spent: orderStats.spent + comandaStats.spent,
        };
      });

      return customersWithStats;
    },
  });

  const stats = useMemo(() => {
    if (!customers) return { total: 0, newLast30: 0, activeLast30: 0 };
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return {
      total: customers.length,
      newLast30: customers.filter(c => new Date(c.created_at) >= thirtyDaysAgo).length,
      activeLast30: customers.filter(c => (c.total_orders || 0) > 0).length,
    };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    let result = [...customers];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(term) || c.cpf.includes(term) || c.phone?.includes(term)
      );
    }
    switch (sortBy) {
      case 'most_spent': result.sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0)); break;
      case 'least_spent': result.sort((a, b) => (a.total_spent || 0) - (b.total_spent || 0)); break;
      case 'recent': result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      case 'oldest': result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break;
      case 'alphabetical': result.sort((a, b) => a.name.localeCompare(b.name)); break;
    }
    return result;
  }, [customers, searchTerm, sortBy]);

  const formatCpf = (cpf: string) => {
    const digits = cpf.replace(/\D/g, "");
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }
    return cpf;
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
  };

  const handleOpenDetail = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDetailOpen(true);
  };

  const handleCepLookup = async (cep: string) => {
    setNewCep(cep);
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

  const handleCreateCustomer = async () => {
    if (!newName || !newCpf) {
      toast.error("Nome e CPF são obrigatórios");
      return;
    }
    const cpfClean = newCpf.replace(/\D/g, "");
    const { error } = await supabase.from("customers").insert({
      restaurant_id: restaurantId, name: newName, cpf: cpfClean,
      phone: newPhone || null, email: newEmail || null, notes: newNotes || null,
    });
    if (error) {
      if (error.code === "23505") toast.error("Cliente com este CPF já existe");
      else toast.error("Erro ao criar cliente");
      return;
    }
    if (newStreet && newNumber) {
      await supabase.from("customer_addresses").insert({
        customer_cpf: cpfClean, customer_name: newName, customer_phone: newPhone || "",
        street: newStreet, number: newNumber, complement: newComplement || null,
        neighborhood: newNeighborhood, city: newCity, state: newState,
        zip_code: newCep.replace(/\D/g, ""), is_default: true,
      });
    }
    toast.success("Cliente cadastrado com sucesso!");
    setIsNewCustomerOpen(false);
    setNewName(""); setNewCpf(""); setNewPhone(""); setNewEmail(""); setNewNotes("");
    setNewCep(""); setNewStreet(""); setNewNumber(""); setNewComplement(""); setNewNeighborhood(""); setNewCity(""); setNewState("");
    refetch();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">Gerencie sua base de clientes</p>
        </div>
        <Button onClick={() => setIsNewCustomerOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Novo Cliente
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total de clientes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/10">
                <UserPlus className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.newLast30}</p>
                <p className="text-sm text-muted-foreground">Novos (30 dias)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-orange-500/10">
                <TrendingUp className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeLast30}</p>
                <p className="text-sm text-muted-foreground">Com pedidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CPF ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[200px]">
            <ArrowUpDown className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Ordenar por..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="most_spent">Mais gasto</SelectItem>
            <SelectItem value="least_spent">Menos gasto</SelectItem>
            <SelectItem value="recent">Recentes</SelectItem>
            <SelectItem value="oldest">Mais antigos</SelectItem>
            <SelectItem value="alphabetical">A-Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Customers Grid */}
      <ScrollArea className="h-[calc(100vh-340px)]">
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCustomers.map((customer) => (
              <Card
                key={customer.id}
                className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
                onClick={() => handleOpenDetail(customer)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-primary">{getInitials(customer.name)}</span>
                    </div>
                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{customer.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{formatCpf(customer.cpf)}</p>
                      {customer.phone && (
                        <div className="flex items-center gap-1 mt-1">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{customer.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Stats row */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                    <Badge variant="secondary" className="text-[10px]">
                      <ShoppingBag className="w-3 h-3 mr-1" />
                      {customer.total_orders || 0} pedidos
                    </Badge>
                    <span className="text-xs font-semibold text-primary ml-auto">
                      R$ {(customer.total_spent || 0).toFixed(0)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Customer Detail */}
      <CustomerDetailDrawer
        customer={selectedCustomer}
        restaurantId={restaurantId}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onUpdate={refetch}
      />

      {/* New Customer Dialog */}
      <Dialog open={isNewCustomerOpen} onOpenChange={setIsNewCustomerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label>CPF *</Label>
              <Input value={newCpf} onChange={(e) => setNewCpf(e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>

            <Separator className="my-2" />
            <p className="text-sm font-semibold text-muted-foreground">Endereço (opcional)</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">CEP</Label>
                <Input value={newCep} onChange={(e) => handleCepLookup(e.target.value)} placeholder="00000-000" className="h-8 text-sm" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Rua</Label>
                <Input value={newStreet} onChange={(e) => setNewStreet(e.target.value)} placeholder="Rua..." className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Número</Label>
                <Input value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder="Nº" className="h-8 text-sm" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Complemento</Label>
                <Input value={newComplement} onChange={(e) => setNewComplement(e.target.value)} placeholder="Apto, Bloco..." className="h-8 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Bairro</Label>
                <Input value={newNeighborhood} onChange={(e) => setNewNeighborhood(e.target.value)} placeholder="Bairro" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cidade</Label>
                <Input value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="Cidade" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Estado</Label>
                <Input value={newState} onChange={(e) => setNewState(e.target.value)} placeholder="UF" className="h-8 text-sm" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Notas sobre o cliente..." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsNewCustomerOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateCustomer}>Cadastrar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientesTab;

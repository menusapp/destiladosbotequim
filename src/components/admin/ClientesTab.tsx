import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Search, Users, UserPlus, TrendingUp, Calendar, Phone, Mail, FileText } from "lucide-react";
import { toast } from "sonner";
import { CustomerDetailDrawer } from "./CustomerDetailDrawer";

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

export const ClientesTab = ({ restaurantId }: ClientesTabProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);
  
  // New customer form
  const [newName, setNewName] = useState("");
  const [newCpf, setNewCpf] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Fetch customers with order stats
  const { data: customers, isLoading, refetch } = useQuery({
    queryKey: ["customers", restaurantId],
    queryFn: async () => {
      // Fetch customers
      const { data: customersData, error } = await supabase
        .from("customers")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("name");

      if (error) throw error;

      // Fetch order stats for each customer
      const customersWithStats = await Promise.all(
        (customersData || []).map(async (customer) => {
          const { data: ordersData } = await supabase
            .from("orders")
            .select(`
              id,
              order_items(price_at_order, quantity, order_item_extras(price_at_order))
            `)
            .eq("restaurant_id", restaurantId)
            .eq("customer_cpf", customer.cpf);

          const totalOrders = ordersData?.length || 0;
          const totalSpent = ordersData?.reduce((sum, order) => {
            return sum + (order.order_items?.reduce((itemSum: number, item: any) => {
              const extrasTotal = item.order_item_extras?.reduce((s: number, e: any) => s + e.price_at_order, 0) || 0;
              return itemSum + (item.price_at_order + extrasTotal) * item.quantity;
            }, 0) || 0);
          }, 0) || 0;

          return {
            ...customer,
            total_orders: totalOrders,
            total_spent: totalSpent,
          };
        })
      );

      return customersWithStats;
    },
  });

  // Calculate stats
  const stats = useMemo(() => {
    if (!customers) return { total: 0, newLast30: 0, activeLast30: 0 };
    
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const newLast30 = customers.filter(c => new Date(c.created_at) >= thirtyDaysAgo).length;
    const activeLast30 = customers.filter(c => (c.total_orders || 0) > 0).length;
    
    return {
      total: customers.length,
      newLast30,
      activeLast30,
    };
  }, [customers]);

  // Filter customers
  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    if (!searchTerm) return customers;
    
    const term = searchTerm.toLowerCase();
    return customers.filter(c => 
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

  const handleOpenDetail = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsDetailOpen(true);
  };

  const handleCreateCustomer = async () => {
    if (!newName || !newCpf) {
      toast.error("Nome e CPF são obrigatórios");
      return;
    }

    const { error } = await supabase
      .from("customers")
      .insert({
        restaurant_id: restaurantId,
        name: newName,
        cpf: newCpf.replace(/\D/g, ""),
        phone: newPhone || null,
        email: newEmail || null,
        notes: newNotes || null,
      });

    if (error) {
      if (error.code === "23505") {
        toast.error("Cliente com este CPF já existe");
      } else {
        toast.error("Erro ao criar cliente");
      }
      return;
    }

    toast.success("Cliente cadastrado com sucesso!");
    setIsNewCustomerOpen(false);
    setNewName("");
    setNewCpf("");
    setNewPhone("");
    setNewEmail("");
    setNewNotes("");
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

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, CPF ou telefone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Customers table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="text-center">Pedidos</TableHead>
                  <TableHead className="text-right">Total Gasto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((customer) => (
                    <TableRow
                      key={customer.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleOpenDetail(customer)}
                    >
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell className="font-mono text-sm">{formatCpf(customer.cpf)}</TableCell>
                      <TableCell>{customer.phone || "-"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{customer.total_orders || 0}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        R$ {(customer.total_spent || 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Customer Detail Drawer */}
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
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <div className="space-y-2">
              <Label>CPF *</Label>
              <Input
                value={newCpf}
                onChange={(e) => setNewCpf(e.target.value)}
                placeholder="000.000.000-00"
              />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Notas sobre o cliente..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsNewCustomerOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateCustomer}>
                Cadastrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientesTab;

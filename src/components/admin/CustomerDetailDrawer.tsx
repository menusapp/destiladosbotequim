import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { User, Phone, Mail, FileText, ShoppingBag, Calendar, Trash2, Save, MapPin, Plus, Star, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

interface CustomerDetailDrawerProps {
  customer: Customer | null;
  restaurantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export const CustomerDetailDrawer = ({
  customer,
  restaurantId,
  open,
  onOpenChange,
  onUpdate,
}: CustomerDetailDrawerProps) => {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editNotes, setEditNotes] = useState("");
  
  // Address form
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addrCep, setAddrCep] = useState("");
  const [addrStreet, setAddrStreet] = useState("");
  const [addrNumber, setAddrNumber] = useState("");
  const [addrComplement, setAddrComplement] = useState("");
  const [addrNeighborhood, setAddrNeighborhood] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");

  // Fetch order history
  const { data: orders } = useQuery({
    queryKey: ["customer-orders", customer?.cpf, restaurantId],
    queryFn: async () => {
      if (!customer) return [];
      const { data, error } = await supabase
        .from("orders")
        .select(`id, created_at, status, order_type, delivery_type, table_id,
          order_items(price_at_order, quantity, products(name), order_item_extras(price_at_order))`)
        .eq("restaurant_id", restaurantId)
        .eq("customer_cpf", customer.cpf)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
    enabled: !!customer,
  });

  // Fetch saved addresses
  const { data: addresses, refetch: refetchAddresses } = useQuery({
    queryKey: ["customer-addresses", customer?.cpf],
    queryFn: async () => {
      if (!customer) return [];
      const { data, error } = await supabase
        .from("customer_addresses")
        .select("*")
        .eq("customer_cpf", customer.cpf)
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!customer,
  });

  const startEdit = () => {
    if (!customer) return;
    setEditName(customer.name);
    setEditPhone(customer.phone || "");
    setEditEmail(customer.email || "");
    setEditNotes(customer.notes || "");
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!customer) return;
    const { error } = await supabase.from("customers").update({
      name: editName, phone: editPhone || null, email: editEmail || null, notes: editNotes || null,
    }).eq("id", customer.id);
    if (error) { toast.error("Erro ao atualizar cliente"); return; }
    toast.success("Cliente atualizado!");
    setIsEditing(false);
    onUpdate();
  };

  const handleDelete = async () => {
    if (!customer) return;
    const { error } = await supabase.from("customers").delete().eq("id", customer.id);
    if (error) { toast.error("Erro ao excluir cliente"); return; }
    toast.success("Cliente excluído!");
    onOpenChange(false);
    onUpdate();
  };

  const formatCpf = (cpf: string) => {
    const digits = cpf.replace(/\D/g, "");
    if (digits.length === 11) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    return cpf;
  };

  const getInitials = (name: string) => name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

  const getOrderTotal = (order: any) => {
    return order.order_items?.reduce((sum: number, item: any) => {
      const extrasTotal = item.order_item_extras?.reduce((s: number, e: any) => s + e.price_at_order, 0) || 0;
      return sum + (item.price_at_order + extrasTotal) * item.quantity;
    }, 0) || 0;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pendente", accepted: "Em preparo", preparing: "Preparando", ready: "Pronto",
      out_for_delivery: "Saiu para entrega", delivered: "Entregue", picked_up: "Retirado", cancelled: "Cancelado",
    };
    return labels[status] || status;
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" | "success" | "warning" => {
    if (status === "delivered" || status === "picked_up") return "success";
    if (status === "cancelled") return "destructive";
    if (status === "pending") return "warning";
    return "secondary";
  };

  const getOrderTypeLabel = (order: any) => {
    if (order.order_type === "delivery") return order.delivery_type === "pickup" ? "Retirada" : "Entrega";
    return "Local";
  };

  const clearAddressForm = () => {
    setShowAddressForm(false);
    setAddrCep(""); setAddrStreet(""); setAddrNumber(""); setAddrComplement(""); setAddrNeighborhood(""); setAddrCity(""); setAddrState("");
  };

  const handleAddAddress = async () => {
    if (!addrStreet || !addrNumber || !customer) return toast.error("Rua e número são obrigatórios");
    const isFirst = !addresses || addresses.length === 0;
    await supabase.from("customer_addresses").insert({
      customer_cpf: customer.cpf, customer_name: customer.name, customer_phone: customer.phone || "",
      street: addrStreet, number: addrNumber, complement: addrComplement || null,
      neighborhood: addrNeighborhood, city: addrCity, state: addrState,
      zip_code: addrCep.replace(/\D/g, ""), is_default: isFirst,
    });
    toast.success("Endereço adicionado!");
    clearAddressForm();
    refetchAddresses();
  };

  const handleCepLookup = (value: string) => {
    setAddrCep(value);
    const clean = value.replace(/\D/g, "");
    if (clean.length === 8) {
      fetch(`https://viacep.com.br/ws/${clean}/json/`)
        .then(r => r.json())
        .then(d => { if (!d.erro) { setAddrStreet(d.logradouro || ""); setAddrNeighborhood(d.bairro || ""); setAddrCity(d.localidade || ""); setAddrState(d.uf || ""); } })
        .catch(() => {});
    }
  };

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header with avatar and stats */}
        <div className="p-6 pb-4 border-b bg-muted/30">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xl font-bold text-primary">{getInitials(customer.name)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold truncate">{customer.name}</h2>
                  <p className="text-sm text-muted-foreground font-mono">{formatCpf(customer.cpf)}</p>
                </div>
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>Cancelar</Button>
                      <Button size="sm" onClick={handleSave}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" size="sm" onClick={startEdit}>Editar</Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm"><Trash2 className="w-4 h-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
                            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </>
                  )}
                </div>
              </div>
              {/* Stats badges */}
              <div className="flex flex-wrap gap-3 mt-3">
                <Badge variant="secondary" className="gap-1">
                  <ShoppingBag className="w-3 h-3" /> {customer.total_orders || 0} pedidos
                </Badge>
                <Badge variant="secondary" className="gap-1">
                  R$ {(customer.total_spent || 0).toFixed(0)} gasto
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Calendar className="w-3 h-3" />
                  Cliente desde {format(new Date(customer.created_at), "MMM/yyyy", { locale: ptBR })}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="dados" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-6 mt-4 w-fit">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="enderecos">Endereços ({addresses?.length || 0})</TabsTrigger>
            <TabsTrigger value="historico">Histórico ({orders?.length || 0})</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 px-6 pb-6">
            {/* Dados Tab */}
            <TabsContent value="dados" className="mt-4 space-y-4">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Nome</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
                    <div className="space-y-2"><Label>CPF</Label><Input value={formatCpf(customer.cpf)} disabled className="bg-muted" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Telefone</Label><Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} /></div>
                    <div className="space-y-2"><Label>E-mail</Label><Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} /></div>
                  </div>
                  <div className="space-y-2"><Label>Observações</Label><Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} /></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {customer.phone && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><Phone className="w-4 h-4 text-muted-foreground" /></div>
                        <div><p className="text-xs text-muted-foreground">Telefone</p><p className="text-sm font-medium">{customer.phone}</p></div>
                      </div>
                    )}
                    {customer.email && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><Mail className="w-4 h-4 text-muted-foreground" /></div>
                        <div><p className="text-xs text-muted-foreground">E-mail</p><p className="text-sm font-medium">{customer.email}</p></div>
                      </div>
                    )}
                    {!customer.phone && !customer.email && (
                      <p className="text-sm text-muted-foreground">Nenhum contato cadastrado</p>
                    )}
                  </div>
                  <div>
                    {customer.notes && (
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0"><FileText className="w-4 h-4 text-muted-foreground" /></div>
                        <div><p className="text-xs text-muted-foreground">Observações</p><p className="text-sm">{customer.notes}</p></div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Endereços Tab */}
            <TabsContent value="enderecos" className="mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">Endereços salvos</h4>
                <Button variant="outline" size="sm" onClick={() => setShowAddressForm(!showAddressForm)}>
                  <Plus className="w-4 h-4 mr-1" /> Adicionar
                </Button>
              </div>

              {showAddressForm && (
                <Card className="p-4 bg-muted/30">
                  <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-2">
                      <Input placeholder="CEP" value={addrCep} onChange={(e) => handleCepLookup(e.target.value)} className="h-9 text-sm" />
                      <Input placeholder="Rua" value={addrStreet} onChange={(e) => setAddrStreet(e.target.value)} className="h-9 text-sm col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <Input placeholder="Nº" value={addrNumber} onChange={(e) => setAddrNumber(e.target.value)} className="h-9 text-sm" />
                      <Input placeholder="Complemento" value={addrComplement} onChange={(e) => setAddrComplement(e.target.value)} className="h-9 text-sm col-span-3" />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="Bairro" value={addrNeighborhood} onChange={(e) => setAddrNeighborhood(e.target.value)} className="h-9 text-sm" />
                      <Input placeholder="Cidade" value={addrCity} onChange={(e) => setAddrCity(e.target.value)} className="h-9 text-sm" />
                      <Input placeholder="UF" value={addrState} onChange={(e) => setAddrState(e.target.value)} className="h-9 text-sm" />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" onClick={clearAddressForm}>Cancelar</Button>
                      <Button size="sm" onClick={handleAddAddress}>Salvar Endereço</Button>
                    </div>
                  </div>
                </Card>
              )}

              {addresses && addresses.length > 0 ? (
                <div className="space-y-2">
                  {addresses.map((addr) => (
                    <Card key={addr.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium flex items-center gap-2">
                              {addr.street}, {addr.number}
                              {addr.complement && <span className="text-muted-foreground">- {addr.complement}</span>}
                              {addr.is_default && (
                                <Badge variant="secondary" className="text-[10px] gap-0.5">
                                  <Star className="w-2.5 h-2.5 fill-current" /> Padrão
                                </Badge>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">{addr.neighborhood} - {addr.city}/{addr.state}</p>
                            {addr.zip_code && <p className="text-xs text-muted-foreground">CEP: {addr.zip_code}</p>}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {!addr.is_default && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={async () => {
                              await supabase.from("customer_addresses").update({ is_default: false }).eq("customer_cpf", customer.cpf);
                              await supabase.from("customer_addresses").update({ is_default: true }).eq("id", addr.id);
                              toast.success("Endereço padrão atualizado");
                              refetchAddresses();
                            }}>
                              <Star className="w-3 h-3 mr-1" /> Padrão
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={async () => {
                            await supabase.from("customer_addresses").delete().eq("id", addr.id);
                            toast.success("Endereço removido");
                            refetchAddresses();
                          }}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhum endereço cadastrado</p>
                </div>
              )}
            </TabsContent>

            {/* Histórico Tab */}
            <TabsContent value="historico" className="mt-4 space-y-3">
              {!orders || orders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhum pedido encontrado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <Card key={order.id} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{getOrderTypeLabel(order)}</Badge>
                          <Badge variant={getStatusVariant(order.status || "pending")} className="text-[10px]">
                            {getStatusLabel(order.status || "pending")}
                          </Badge>
                        </div>
                        <span className="font-semibold text-sm text-primary">R$ {getOrderTotal(order).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                        <Clock className="w-3 h-3" />
                        {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {order.order_items?.slice(0, 3).map((item: any, idx: number) => (
                          <span key={idx}>
                            {item.quantity}x {item.products?.name}
                            {idx < Math.min(order.order_items.length, 3) - 1 && ", "}
                          </span>
                        ))}
                        {order.order_items?.length > 3 && (
                          <span> +{order.order_items.length - 3} mais</span>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

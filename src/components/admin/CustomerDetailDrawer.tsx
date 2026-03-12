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
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
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
import { User, Phone, Mail, FileText, ShoppingBag, Calendar, Trash2, Save, MapPin, Plus, Star } from "lucide-react";
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

  // Fetch order history for customer
  const { data: orders } = useQuery({
    queryKey: ["customer-orders", customer?.cpf, restaurantId],
    queryFn: async () => {
      if (!customer) return [];
      
      const { data, error } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          status,
          order_type,
          delivery_type,
          table_id,
          order_items(
            price_at_order,
            quantity,
            products(name),
            order_item_extras(price_at_order)
          )
        `)
        .eq("restaurant_id", restaurantId)
        .eq("customer_cpf", customer.cpf)
        .order("created_at", { ascending: false })
        .limit(20);

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

    const { error } = await supabase
      .from("customers")
      .update({
        name: editName,
        phone: editPhone || null,
        email: editEmail || null,
        notes: editNotes || null,
      })
      .eq("id", customer.id);

    if (error) {
      toast.error("Erro ao atualizar cliente");
      return;
    }

    toast.success("Cliente atualizado!");
    setIsEditing(false);
    onUpdate();
  };

  const handleDelete = async () => {
    if (!customer) return;

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", customer.id);

    if (error) {
      toast.error("Erro ao excluir cliente");
      return;
    }

    toast.success("Cliente excluído!");
    onOpenChange(false);
    onUpdate();
  };

  const formatCpf = (cpf: string) => {
    const digits = cpf.replace(/\D/g, "");
    if (digits.length === 11) {
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    }
    return cpf;
  };

  const getOrderTotal = (order: any) => {
    return order.order_items?.reduce((sum: number, item: any) => {
      const extrasTotal = item.order_item_extras?.reduce((s: number, e: any) => s + e.price_at_order, 0) || 0;
      return sum + (item.price_at_order + extrasTotal) * item.quantity;
    }, 0) || 0;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: "Pendente",
      accepted: "Em preparo",
      preparing: "Preparando",
      ready: "Pronto",
      out_for_delivery: "Saiu para entrega",
      delivered: "Entregue",
      picked_up: "Retirado",
      cancelled: "Cancelado",
    };
    return labels[status] || status;
  };

  const getOrderTypeLabel = (order: any) => {
    if (order.order_type === "delivery") {
      return order.delivery_type === "pickup" ? "Retirada" : "Entrega";
    }
    return "Local";
  };

  if (!customer) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <DrawerTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {customer.name}
            </DrawerTitle>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleSave}>
                    <Save className="w-4 h-4 mr-1" />
                    Salvar
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={startEdit}>
                    Editar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. O histórico de pedidos será mantido.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </div>
        </DrawerHeader>

        <ScrollArea className="flex-1 p-4">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Customer Info */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Dados do Cliente</h3>
              
              {isEditing ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>CPF</Label>
                    <Input value={formatCpf(customer.cpf)} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail</Label>
                    <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-mono">{formatCpf(customer.cpf)}</span>
                  </div>
                  {customer.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{customer.phone}</span>
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      <span>{customer.email}</span>
                    </div>
                  )}
                  {customer.notes && (
                    <div className="flex items-start gap-2 text-sm">
                      <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                      <span className="text-muted-foreground">{customer.notes}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Cliente desde {format(new Date(customer.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 pt-4">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">{customer.total_orders || 0}</p>
                  <p className="text-xs text-muted-foreground">Pedidos</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold">R$ {(customer.total_spent || 0).toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">Total Gasto</p>
                </div>
              </div>

              {/* Saved Addresses */}
              {addresses && addresses.length > 0 && (
                <div className="pt-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Endereços Salvos
                  </h4>
                  <div className="space-y-2">
                    {addresses.map((addr) => (
                      <div key={addr.id} className="text-sm p-2 bg-muted/30 rounded">
                        <p>{addr.street}, {addr.number}</p>
                        <p className="text-muted-foreground">{addr.neighborhood} - {addr.city}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Order History */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <ShoppingBag className="w-5 h-5" />
                Histórico de Pedidos
              </h3>

              {!orders || orders.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum pedido encontrado</p>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="border rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {getOrderTypeLabel(order)}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {getStatusLabel(order.status || "pending")}
                          </Badge>
                        </div>
                        <span className="font-medium">
                          R$ {getOrderTotal(order).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                      <div className="text-sm">
                        {order.order_items?.slice(0, 3).map((item: any, idx: number) => (
                          <span key={idx}>
                            {item.quantity}x {item.products?.name}
                            {idx < Math.min(order.order_items.length, 3) - 1 && ", "}
                          </span>
                        ))}
                        {order.order_items?.length > 3 && (
                          <span className="text-muted-foreground"> +{order.order_items.length - 3} mais</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
};

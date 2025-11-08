import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Eye, Edit, Printer, Trash2, CheckCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { z } from "zod";

interface BalcaoTabProps {
  restaurantId: string;
}

const counterOrderSchema = z.object({
  tableId: z.string().min(1, "Selecione uma mesa"),
  customerName: z.string().min(1, "Nome do cliente é obrigatório"),
  customerCpf: z.string().optional(),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().min(1),
    price: z.number(),
    notes: z.string().optional(),
    extras: z.array(z.object({
      extraId: z.string(),
      price: z.number(),
    })).optional(),
  })).min(1, "Adicione pelo menos um produto"),
  feeType: z.enum(['fixed', 'percentage']).optional(),
  feeValue: z.number().optional(),
  paymentMethod: z.string().optional(),
});

const BalcaoTab = ({ restaurantId }: BalcaoTabProps) => {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Form state
  const [formData, setFormData] = useState({
    tableId: "",
    customerName: "",
    customerCpf: "",
    items: [] as any[],
    feeType: "fixed" as "fixed" | "percentage",
    feeValue: 0,
    paymentMethod: "",
  });
  
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [itemNotes, setItemNotes] = useState("");

  // Fetch counter orders
  const { data: orders, isLoading } = useQuery({
    queryKey: ["counter-orders", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("counter_orders")
        .select(`
          *,
          tables!inner(table_number),
          counter_order_items(
            *,
            products(name, price),
            counter_order_item_extras(
              *,
              product_extras(name, price)
            )
          )
        `)
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch tables
  const { data: tables } = useQuery({
    queryKey: ["tables", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tables")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("table_number");
      if (error) throw error;
      return data;
    },
  });

  // Fetch products
  const { data: products } = useQuery({
    queryKey: ["products", restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          categories!inner(restaurant_id),
          product_extras(*)
        `)
        .eq("categories.restaurant_id", restaurantId)
        .eq("available", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const calculateTotals = () => {
    const subtotal = formData.items.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity;
      const extrasTotal = (item.extras || []).reduce((eSum: number, e: any) => eSum + e.price, 0) * item.quantity;
      return sum + itemTotal + extrasTotal;
    }, 0);

    let feeAmount = 0;
    if (formData.feeType === 'fixed') {
      feeAmount = formData.feeValue || 0;
    } else if (formData.feeType === 'percentage') {
      feeAmount = subtotal * ((formData.feeValue || 0) / 100);
    }

    const total = subtotal + feeAmount;
    return { subtotal, feeAmount, total };
  };

  const addItemToOrder = () => {
    if (!selectedProduct) {
      toast.error("Selecione um produto");
      return;
    }

    const product = products?.find(p => p.id === selectedProduct);
    if (!product) return;

    const extras = selectedExtras.map(extraId => {
      const extra = product.product_extras?.find((e: any) => e.id === extraId);
      return {
        extraId,
        name: extra?.name || "",
        price: extra?.price || 0,
      };
    });

    const newItem = {
      productId: product.id,
      productName: product.name,
      quantity: selectedQuantity,
      price: product.price,
      notes: itemNotes,
      extras,
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem],
    }));

    // Reset
    setSelectedProduct("");
    setSelectedQuantity(1);
    setSelectedExtras([]);
    setItemNotes("");
  };

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      try {
        counterOrderSchema.parse(formData);
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new Error(error.errors[0].message);
        }
        throw error;
      }

      const totals = calculateTotals();
      const createdBy = localStorage.getItem("restaurant_name") || "Sistema";

      // Insert counter order
      const { data: order, error: orderError } = await supabase
        .from("counter_orders")
        .insert({
          restaurant_id: restaurantId,
          table_id: formData.tableId,
          customer_name: formData.customerName,
          customer_cpf: formData.customerCpf || null,
          status: formData.paymentMethod ? 'paid' : 'pending',
          payment_method: formData.paymentMethod || null,
          subtotal: totals.subtotal,
          fee_type: formData.feeType || null,
          fee_value: formData.feeValue || 0,
          fee_amount: totals.feeAmount,
          total_amount: totals.total,
          finalized_at: formData.paymentMethod ? new Date().toISOString() : null,
          created_by: createdBy,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Insert items
      for (const item of formData.items) {
        const { data: orderItem, error: itemError } = await supabase
          .from("counter_order_items")
          .insert({
            counter_order_id: order.id,
            product_id: item.productId,
            quantity: item.quantity,
            price_at_order: item.price,
            notes: item.notes || null,
          })
          .select()
          .single();

        if (itemError) throw itemError;

        // Insert extras
        if (item.extras && item.extras.length > 0) {
          const extrasToInsert = item.extras.map((extra: any) => ({
            counter_order_item_id: orderItem.id,
            product_extra_id: extra.extraId,
            price_at_order: extra.price,
          }));

          const { error: extrasError } = await supabase
            .from("counter_order_item_extras")
            .insert(extrasToInsert);

          if (extrasError) throw extrasError;
        }
      }

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["counter-orders"] });
      toast.success("Pedido criado com sucesso!");
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao criar pedido");
    },
  });

  // Finalize mutation (for pending orders)
  const finalizeMutation = useMutation({
    mutationFn: async ({ orderId, paymentMethod }: { orderId: string; paymentMethod: string }) => {
      const { error } = await supabase
        .from("counter_orders")
        .update({
          status: 'paid',
          payment_method: paymentMethod,
          finalized_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["counter-orders"] });
      toast.success("Pedido finalizado!");
      setIsEditOpen(false);
      setSelectedOrder(null);
    },
    onError: (error: any) => {
      toast.error("Erro ao finalizar pedido");
      console.error(error);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("counter_orders")
        .delete()
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["counter-orders"] });
      toast.success("Pedido excluído e estoque revertido");
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir pedido");
      console.error(error);
    },
  });

  const resetForm = () => {
    setFormData({
      tableId: "",
      customerName: "",
      customerCpf: "",
      items: [],
      feeType: "fixed",
      feeValue: 0,
      paymentMethod: "",
    });
  };

  const handlePrint = (order: any) => {
    // Implementar impressão
    toast.info("Função de impressão em desenvolvimento");
  };

  const filteredOrders = orders?.filter(order =>
    order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.tables?.table_number.toString().includes(searchTerm)
  );

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Balcão</h2>
          <p className="text-muted-foreground">Gerencie pedidos de balcão</p>
        </div>
        <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <SheetTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Criar Pedido
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Novo Pedido de Balcão</SheetTitle>
              <SheetDescription>Preencha os dados do pedido</SheetDescription>
            </SheetHeader>

            <div className="grid grid-cols-2 gap-6 mt-6">
              {/* Coluna Esquerda - Dados do Cliente */}
              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div>
                      <Label htmlFor="table">Mesa *</Label>
                      <Select
                        value={formData.tableId}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, tableId: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a mesa" />
                        </SelectTrigger>
                        <SelectContent>
                          {tables?.map((table) => (
                            <SelectItem key={table.id} value={table.id}>
                              Mesa {table.table_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="customerName">Nome do Cliente *</Label>
                      <Input
                        id="customerName"
                        value={formData.customerName}
                        onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                        placeholder="Digite o nome"
                      />
                    </div>

                    <div>
                      <Label htmlFor="customerCpf">CPF (opcional)</Label>
                      <Input
                        id="customerCpf"
                        value={formData.customerCpf}
                        onChange={(e) => setFormData(prev => ({ ...prev, customerCpf: e.target.value }))}
                        placeholder="000.000.000-00"
                      />
                    </div>

                    <div>
                      <Label>Taxa de Serviço</Label>
                      <div className="flex gap-2 mt-2">
                        <Select
                          value={formData.feeType}
                          onValueChange={(value: "fixed" | "percentage") => setFormData(prev => ({ ...prev, feeType: value }))}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">R$</SelectItem>
                            <SelectItem value="percentage">%</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.feeValue}
                          onChange={(e) => setFormData(prev => ({ ...prev, feeValue: parseFloat(e.target.value) || 0 }))}
                          placeholder="Valor"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="paymentMethod">Forma de Pagamento</Label>
                      <Select
                        value={formData.paymentMethod}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, paymentMethod: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">Dinheiro</SelectItem>
                          <SelectItem value="debit">Débito</SelectItem>
                          <SelectItem value="credit">Crédito</SelectItem>
                          <SelectItem value="pix">PIX</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Coluna Direita - Produtos */}
              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-6 space-y-4">
                    <div>
                      <Label>Adicionar Produto</Label>
                      <Select
                        value={selectedProduct}
                        onValueChange={setSelectedProduct}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um produto" />
                        </SelectTrigger>
                        <SelectContent>
                          {products?.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} - R$ {product.price.toFixed(2)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedProduct && (
                      <>
                        <div>
                          <Label>Quantidade</Label>
                          <Input
                            type="number"
                            min="1"
                            value={selectedQuantity}
                            onChange={(e) => setSelectedQuantity(parseInt(e.target.value) || 1)}
                          />
                        </div>

                        {products?.find(p => p.id === selectedProduct)?.product_extras?.length > 0 && (
                          <div>
                            <Label>Adicionais</Label>
                            <div className="space-y-2 mt-2">
                              {products?.find(p => p.id === selectedProduct)?.product_extras?.map((extra: any) => (
                                <div key={extra.id} className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id={extra.id}
                                    checked={selectedExtras.includes(extra.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedExtras(prev => [...prev, extra.id]);
                                      } else {
                                        setSelectedExtras(prev => prev.filter(id => id !== extra.id));
                                      }
                                    }}
                                  />
                                  <Label htmlFor={extra.id} className="cursor-pointer">
                                    {extra.name} - R$ {extra.price.toFixed(2)}
                                  </Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div>
                          <Label>Observações</Label>
                          <Textarea
                            value={itemNotes}
                            onChange={(e) => setItemNotes(e.target.value)}
                            placeholder="Ex: sem cebola"
                          />
                        </div>

                        <Button onClick={addItemToOrder} className="w-full">
                          Adicionar ao Pedido
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Itens Adicionados */}
                {formData.items.length > 0 && (
                  <Card>
                    <CardContent className="pt-6">
                      <Label className="text-lg font-semibold mb-4 block">Itens do Pedido</Label>
                      <div className="space-y-2">
                        {formData.items.map((item, index) => (
                          <div key={index} className="flex justify-between items-start p-2 bg-muted rounded">
                            <div className="flex-1">
                              <p className="font-medium">
                                {item.quantity}x {item.productName}
                              </p>
                              {item.extras && item.extras.length > 0 && (
                                <p className="text-sm text-muted-foreground">
                                  + {item.extras.map((e: any) => e.name).join(", ")}
                                </p>
                              )}
                              {item.notes && (
                                <p className="text-sm text-muted-foreground italic">{item.notes}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-medium">
                                R$ {(item.price * item.quantity + (item.extras?.reduce((sum: number, e: any) => sum + e.price, 0) || 0) * item.quantity).toFixed(2)}
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeItem(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 pt-4 border-t space-y-2">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>R$ {totals.subtotal.toFixed(2)}</span>
                        </div>
                        {totals.feeAmount > 0 && (
                          <div className="flex justify-between">
                            <span>Taxa:</span>
                            <span>R$ {totals.feeAmount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-lg">
                          <span>Total:</span>
                          <span>R$ {totals.total.toFixed(2)}</span>
                        </div>
                      </div>

                      <Button
                        className="w-full mt-4"
                        onClick={() => createMutation.mutate()}
                        disabled={createMutation.isPending}
                      >
                        {createMutation.isPending ? "Salvando..." : "Salvar Pedido"}
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Buscar por cliente ou mesa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Orders Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-center text-muted-foreground">Carregando...</p>
          ) : !filteredOrders || filteredOrders.length === 0 ? (
            <p className="text-center text-muted-foreground">Nenhum pedido encontrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mesa</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>Mesa {order.tables?.table_number}</TableCell>
                    <TableCell>{order.customer_name}</TableCell>
                    <TableCell>R$ {order.total_amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={order.status === 'paid' ? 'default' : 'secondary'}>
                        {order.status === 'paid' ? 'Pago' : 'Pendente'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {order.payment_method ? (
                        order.payment_method === 'cash' ? 'Dinheiro' :
                        order.payment_method === 'debit' ? 'Débito' :
                        order.payment_method === 'credit' ? 'Crédito' :
                        order.payment_method === 'pix' ? 'PIX' : order.payment_method
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePrint(order)}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        {order.status === 'pending' && (
                          <Sheet open={isEditOpen && selectedOrder?.id === order.id} onOpenChange={(open) => {
                            setIsEditOpen(open);
                            if (!open) setSelectedOrder(null);
                          }}>
                            <SheetTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedOrder(order)}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            </SheetTrigger>
                            <SheetContent>
                              <SheetHeader>
                                <SheetTitle>Finalizar Pedido</SheetTitle>
                                <SheetDescription>
                                  Selecione a forma de pagamento para finalizar
                                </SheetDescription>
                              </SheetHeader>
                              <div className="mt-6 space-y-4">
                                <div>
                                  <Label>Forma de Pagamento</Label>
                                  <Select
                                    onValueChange={(value) => {
                                      finalizeMutation.mutate({
                                        orderId: order.id,
                                        paymentMethod: value,
                                      });
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="cash">Dinheiro</SelectItem>
                                      <SelectItem value="debit">Débito</SelectItem>
                                      <SelectItem value="credit">Crédito</SelectItem>
                                      <SelectItem value="pix">PIX</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            </SheetContent>
                          </Sheet>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm("Tem certeza que deseja excluir este pedido?")) {
                              deleteMutation.mutate(order.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BalcaoTab;

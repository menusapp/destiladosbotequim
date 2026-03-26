import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { Ticket, Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order_value: number | null;
  max_discount: number | null;
  is_active: boolean;
  usage_limit: number | null;
  used_count: number;
  valid_from: string | null;
  valid_until: string | null;
}

interface CouponsManagementProps {
  restaurantId: string;
}

export default function CouponsManagement({ restaurantId }: CouponsManagementProps) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    discount_type: "percentage",
    discount_value: "",
    min_order_value: "",
    max_discount: "",
    usage_limit: "",
    valid_until: "",
  });

  useEffect(() => {
    fetchCoupons();
  }, [restaurantId]);

  const fetchCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCoupons(data || []);
    } catch (error) {
      console.error("Error fetching coupons:", error);
      toast.error("Erro ao carregar cupons");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (coupon?: Coupon) => {
    if (coupon) {
      setEditingCoupon(coupon);
      setFormData({
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value.toString(),
        min_order_value: coupon.min_order_value?.toString() || "",
        max_discount: coupon.max_discount?.toString() || "",
        usage_limit: coupon.usage_limit?.toString() || "",
        valid_until: coupon.valid_until ? format(new Date(coupon.valid_until), "yyyy-MM-dd") : "",
      });
    } else {
      setEditingCoupon(null);
      setFormData({
        code: "",
        discount_type: "percentage",
        discount_value: "",
        min_order_value: "",
        max_discount: "",
        usage_limit: "",
        valid_until: "",
      });
    }
    setDialogOpen(true);
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code || !formData.discount_value) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      const payload = {
        restaurant_id: restaurantId,
        code: formData.code.toUpperCase(),
        discount_type: formData.discount_type,
        discount_value: parseFloat(formData.discount_value),
        min_order_value: formData.min_order_value ? parseFloat(formData.min_order_value) : 0,
        max_discount: formData.max_discount ? parseFloat(formData.max_discount) : null,
        usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
        valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null,
      };

      if (editingCoupon) {
        const { error } = await supabase
          .from("coupons")
          .update(payload)
          .eq("id", editingCoupon.id);

        if (error) throw error;
        toast.success("Cupom atualizado!");
      } else {
        const { error } = await supabase.from("coupons").insert(payload);

        if (error) throw error;
        toast.success("Cupom criado!");
      }

      setDialogOpen(false);
      fetchCoupons();
    } catch (error: any) {
      console.error("Error saving coupon:", error);
      if (error.code === "23505") {
        toast.error("Já existe um cupom com este código");
      } else {
        toast.error("Erro ao salvar cupom");
      }
    }
  };

  const handleToggleStatus = async (couponId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("coupons")
        .update({ is_active: isActive })
        .eq("id", couponId);

      if (error) throw error;
      
      toast.success(isActive ? "Cupom ativado!" : "Cupom desativado!");
      fetchCoupons();
    } catch (error) {
      console.error("Error toggling coupon:", error);
      toast.error("Erro ao atualizar cupom");
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    try {
      const { error } = await supabase
        .from("coupons")
        .delete()
        .eq("id", couponId);

      if (error) throw error;
      
      toast.success("Cupom excluído!");
      fetchCoupons();
    } catch (error) {
      console.error("Error deleting coupon:", error);
      toast.error("Erro ao excluir cupom");
    }
  };

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Cupons de Desconto</h2>
          <p className="text-muted-foreground">
            Crie e gerencie cupons promocionais para seus clientes
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Criar Cupom
        </Button>
      </div>

      {coupons.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Ticket className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Nenhum cupom criado</h3>
            <p className="text-muted-foreground mb-4">
              Comece criando seu primeiro cupom promocional
            </p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeiro Cupom
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {coupons.map((coupon) => (
            <Card key={coupon.id}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold">{coupon.code}</h3>
                      <Badge variant={coupon.is_active ? "default" : "secondary"}>
                        {coupon.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>

                    <p className="text-lg mb-2">
                      {coupon.discount_type === "percentage"
                        ? `${coupon.discount_value}% de desconto`
                        : `R$ ${coupon.discount_value.toFixed(2)} de desconto`}
                    </p>

                    {coupon.min_order_value && coupon.min_order_value > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Válido para pedidos acima de R$ {coupon.min_order_value.toFixed(2)}
                      </p>
                    )}

                    {coupon.max_discount && (
                      <p className="text-sm text-muted-foreground">
                        Desconto máximo: R$ {coupon.max_discount.toFixed(2)}
                      </p>
                    )}

                    <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
                      <span>
                        Usado: {coupon.used_count} {coupon.usage_limit ? `/ ${coupon.usage_limit}` : ""}
                      </span>
                      {coupon.valid_until && (
                        <span>
                          Válido até: {format(new Date(coupon.valid_until), "dd/MM/yyyy")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStatus(coupon.id, !coupon.is_active)}
                    >
                      {coupon.is_active ? "Desativar" : "Ativar"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(coupon)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir cupom?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. O cupom {coupon.code} será excluído permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteCoupon(coupon.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingCoupon ? "Editar Cupom" : "Criar Novo Cupom"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveCoupon} className="space-y-4">
            <div>
              <Label>Código do Cupom *</Label>
              <Input
                placeholder="Ex: PRIMEIRA10, VERAO20"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value.toUpperCase() })
                }
                required
              />
            </div>

            <div>
              <Label>Tipo de Desconto *</Label>
              <Select
                value={formData.discount_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, discount_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>
                {formData.discount_type === "percentage"
                  ? "Percentual de Desconto *"
                  : "Valor do Desconto (R$) *"}
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder={formData.discount_type === "percentage" ? "Ex: 10" : "Ex: 5.00"}
                value={formData.discount_value}
                onChange={(e) =>
                  setFormData({ ...formData, discount_value: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label>Valor Mínimo do Pedido (R$)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Deixe 0 para sem mínimo"
                value={formData.min_order_value}
                onChange={(e) =>
                  setFormData({ ...formData, min_order_value: e.target.value })
                }
              />
            </div>

            {formData.discount_type === "percentage" && (
              <div>
                <Label>Desconto Máximo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Opcional. Ex: 20% com max R$50"
                  value={formData.max_discount}
                  onChange={(e) =>
                    setFormData({ ...formData, max_discount: e.target.value })
                  }
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Ex: 20% com max R$50 = desconto máximo de R$50
                </p>
              </div>
            )}

            <div>
              <Label>Limite de Uso</Label>
              <Input
                type="number"
                placeholder="Deixe vazio para uso ilimitado"
                value={formData.usage_limit}
                onChange={(e) =>
                  setFormData({ ...formData, usage_limit: e.target.value })
                }
              />
            </div>

            <div>
              <Label>Data de Validade</Label>
              <Input
                type="date"
                value={formData.valid_until}
                onChange={(e) =>
                  setFormData({ ...formData, valid_until: e.target.value })
                }
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1">
                {editingCoupon ? "Salvar Alterações" : "Criar Cupom"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

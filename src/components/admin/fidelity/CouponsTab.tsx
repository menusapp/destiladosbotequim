import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Ticket, Plus, Pencil, Trash2, Gift, Truck, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface Coupon {
  id: string;
  code: string;
  coupon_type: string;
  discount_type: string;
  discount_value: number;
  min_order_value: number | null;
  max_discount: number | null;
  is_active: boolean;
  usage_limit: number | null;
  usage_limit_per_user: number | null;
  used_count: number;
  valid_from: string | null;
  valid_until: string | null;
  target_product_id: string | null;
  target_extra_id: string | null;
  target_product_extra_id: string | null;
  target_product_name?: string;
  target_extra_name?: string;
}

interface Product {
  id: string;
  name: string;
}

interface ProductVariation {
  id: string;
  name: string;
  price: number;
  category_name: string;
  system: 'new' | 'legacy'; // Track which system the variation comes from
}

interface CouponsTabProps {
  restaurantId: string;
}

export default function CouponsTab({ restaurantId }: CouponsTabProps) {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productVariations, setProductVariations] = useState<ProductVariation[]>([]);
  const [variationSystem, setVariationSystem] = useState<'new' | 'legacy' | null>(null);
  const [variationDrawerOpen, setVariationDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState({
    code: "",
    coupon_type: "discount" as string,
    discount_type: "percentage",
    discount_value: "",
    min_order_value: "",
    max_discount: "",
    usage_limit: "",
    usage_limit_per_user: "",
    valid_from: "",
    valid_until: "",
    target_product_id: "",
    target_extra_id: "",
  });

  useEffect(() => {
    fetchCoupons();
    fetchProducts();
  }, [restaurantId]);

  // Buscar variações quando produto é selecionado
  useEffect(() => {
    if (formData.target_product_id && formData.coupon_type === "free_product") {
      fetchProductVariations(formData.target_product_id);
    } else {
      setProductVariations([]);
      setVariationSystem(null);
      setFormData(prev => ({ ...prev, target_extra_id: "" }));
    }
  }, [formData.target_product_id, formData.coupon_type]);

  const fetchCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch product and extra names for free_product coupons
      const productIds = data?.filter(c => c.target_product_id).map(c => c.target_product_id) || [];
      const newSystemExtraIds = data?.filter(c => c.target_extra_id).map(c => c.target_extra_id) || [];
      const legacyExtraIds = data?.filter(c => c.target_product_extra_id).map(c => c.target_product_extra_id) || [];
      
      let productMap: Record<string, string> = {};
      let extraMap: Record<string, string> = {};
      
      if (productIds.length > 0) {
        const { data: prods } = await supabase
          .from("products")
          .select("id, name")
          .in("id", productIds);
        prods?.forEach(p => { productMap[p.id] = p.name; });
      }

      // Fetch from new system (extra_category_items)
      if (newSystemExtraIds.length > 0) {
        const { data: extras } = await supabase
          .from("extra_category_items")
          .select("id, name")
          .in("id", newSystemExtraIds);
        extras?.forEach(e => { extraMap[e.id] = e.name; });
      }

      // Fetch from legacy system (product_extras)
      if (legacyExtraIds.length > 0) {
        const { data: extras } = await supabase
          .from("product_extras")
          .select("id, name")
          .in("id", legacyExtraIds);
        extras?.forEach(e => { extraMap[e.id] = e.name; });
      }

      setCoupons(data?.map(c => ({
        ...c,
        coupon_type: c.coupon_type || "discount",
        target_product_name: c.target_product_id ? productMap[c.target_product_id] : undefined,
        target_extra_name: c.target_extra_id 
          ? extraMap[c.target_extra_id] 
          : c.target_product_extra_id 
            ? extraMap[c.target_product_extra_id] 
            : undefined,
      })) || []);
    } catch (error) {
      console.error("Error fetching coupons:", error);
      toast.error("Erro ao carregar cupons");
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name")
      .eq("available", true)
      .order("name");
    setProducts(data || []);
  };

  const fetchProductVariations = async (productId: string) => {
    try {
      // First, try the new system (product_complement_groups)
      const { data: groups } = await supabase
        .from("product_complement_groups")
        .select(`
          id,
          is_required,
          extra_category_id,
          extra_categories (
            id,
            name,
            extra_category_items (
              id,
              name,
              price
            )
          )
        `)
        .eq("product_id", productId)
        .eq("is_required", true);

      if (groups && groups.length > 0) {
        const variations: ProductVariation[] = [];
        groups.forEach((group: any) => {
          const category = group.extra_categories;
          if (category && category.extra_category_items) {
            category.extra_category_items.forEach((item: any) => {
              variations.push({
                id: item.id,
                name: item.name,
                price: item.price,
                category_name: category.name,
                system: 'new', // Mark as new system
              });
            });
          }
        });
        if (variations.length > 0) {
          setProductVariations(variations);
          setVariationSystem('new');
          return;
        }
      }
      
      // Fallback: try legacy system (product_extras)
      const { data: extras } = await supabase
        .from("product_extras")
        .select("id, name, price, is_required")
        .eq("product_id", productId)
        .eq("is_required", true);

      if (extras && extras.length > 0) {
        setProductVariations(extras.map(e => ({
          id: e.id,
          name: e.name,
          price: e.price,
          category_name: "Variação",
          system: 'legacy', // Mark as legacy system
        })));
        setVariationSystem('legacy');
      } else {
        setProductVariations([]);
        setVariationSystem(null);
      }
    } catch (error) {
      console.error("Error fetching product variations:", error);
      setProductVariations([]);
      setVariationSystem(null);
    }
  };

  const handleOpenDialog = (coupon?: Coupon) => {
    if (coupon) {
      setEditingCoupon(coupon);
      // Use whichever extra ID is set (new or legacy system)
      const extraId = coupon.target_extra_id || coupon.target_product_extra_id || "";
      setFormData({
        code: coupon.code,
        coupon_type: coupon.coupon_type || "discount",
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value.toString(),
        min_order_value: coupon.min_order_value?.toString() || "",
        max_discount: coupon.max_discount?.toString() || "",
        usage_limit: coupon.usage_limit?.toString() || "",
        usage_limit_per_user: coupon.usage_limit_per_user?.toString() || "",
        valid_from: coupon.valid_from ? format(new Date(coupon.valid_from), "yyyy-MM-dd") : "",
        valid_until: coupon.valid_until ? format(new Date(coupon.valid_until), "yyyy-MM-dd") : "",
        target_product_id: coupon.target_product_id || "",
        target_extra_id: extraId,
      });
    } else {
      setEditingCoupon(null);
      setFormData({
        code: "",
        coupon_type: "discount",
        discount_type: "percentage",
        discount_value: "",
        min_order_value: "",
        max_discount: "",
        usage_limit: "",
        usage_limit_per_user: "",
        valid_from: "",
        valid_until: "",
        target_product_id: "",
        target_extra_id: "",
      });
    }
    setDialogOpen(true);
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code) {
      toast.error("Informe o código do cupom");
      return;
    }

    // Validar desconto apenas para tipo discount
    if (formData.coupon_type === "discount" && !formData.discount_value) {
      toast.error("Informe o valor do desconto");
      return;
    }

    if (formData.coupon_type === "free_product" && !formData.target_product_id) {
      toast.error("Selecione o produto grátis");
      return;
    }

    try {
      // Determine which column to use for variation based on the system
      const isNewSystem = variationSystem === 'new';
      const hasVariation = formData.coupon_type === "free_product" && formData.target_extra_id;
      
      const payload: any = {
        restaurant_id: restaurantId,
        code: formData.code.toUpperCase(),
        coupon_type: formData.coupon_type,
        // Para free_product e free_delivery, discount_value é 0
        discount_type: formData.coupon_type === "discount" ? formData.discount_type : "fixed",
        discount_value: formData.coupon_type === "discount" ? parseFloat(formData.discount_value) : 0,
        min_order_value: formData.min_order_value ? parseFloat(formData.min_order_value) : 0,
        max_discount: formData.max_discount ? parseFloat(formData.max_discount) : null,
        usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
        usage_limit_per_user: formData.usage_limit_per_user ? parseInt(formData.usage_limit_per_user) : null,
        valid_from: formData.valid_from ? new Date(formData.valid_from).toISOString() : null,
        valid_until: formData.valid_until ? new Date(formData.valid_until).toISOString() : null,
        target_product_id: formData.coupon_type === "free_product" ? formData.target_product_id : null,
        // Save to correct column based on variation system
        target_extra_id: hasVariation && isNewSystem ? formData.target_extra_id : null,
        target_product_extra_id: hasVariation && !isNewSystem ? formData.target_extra_id : null,
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
      toast.error("Erro ao atualizar cupom");
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    try {
      const { error } = await supabase.from("coupons").delete().eq("id", couponId);
      if (error) throw error;
      toast.success("Cupom excluído!");
      fetchCoupons();
    } catch (error) {
      toast.error("Erro ao excluir cupom");
    }
  };

  const getCouponTypeIcon = (type: string) => {
    switch (type) {
      case "free_product": return <Gift className="w-4 h-4" />;
      case "free_delivery": return <Truck className="w-4 h-4" />;
      default: return <Ticket className="w-4 h-4" />;
    }
  };

  const getCouponDescription = (coupon: Coupon) => {
    switch (coupon.coupon_type) {
      case "free_product":
        let desc = `Produto grátis: ${coupon.target_product_name || "N/A"}`;
        if (coupon.target_extra_name) {
          desc += ` (${coupon.target_extra_name})`;
        }
        return desc;
      case "free_delivery":
        return "Entrega grátis";
      default:
        return coupon.discount_type === "percentage"
          ? `${coupon.discount_value}% de desconto`
          : `R$ ${coupon.discount_value.toFixed(2)} de desconto`;
    }
  };

  if (loading) {
    return <div className="p-4">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Cupons de Desconto</h2>
          <p className="text-sm text-muted-foreground">
            Crie cupons para usar em campanhas ou promoções
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
              Crie cupons para enviar em campanhas de marketing ou promoções
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
                      {getCouponTypeIcon(coupon.coupon_type)}
                      <h3 className="text-xl font-bold">{coupon.code}</h3>
                      <Badge variant={coupon.is_active ? "default" : "secondary"}>
                        {coupon.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                      <Badge variant="outline">
                        {coupon.coupon_type === "free_product" && "Produto Grátis"}
                        {coupon.coupon_type === "free_delivery" && "Entrega Grátis"}
                        {coupon.coupon_type === "discount" && "Desconto"}
                      </Badge>
                    </div>

                    <p className="text-lg mb-2">{getCouponDescription(coupon)}</p>

                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      {coupon.min_order_value && coupon.min_order_value > 0 && (
                        <span>Mín: R$ {coupon.min_order_value.toFixed(2)}</span>
                      )}
                      {coupon.max_discount && (
                        <span>Máx: R$ {coupon.max_discount.toFixed(2)}</span>
                      )}
                      <span>
                        Usado: {coupon.used_count}{coupon.usage_limit ? `/${coupon.usage_limit}` : ""}
                      </span>
                      {coupon.usage_limit_per_user && (
                        <span>{coupon.usage_limit_per_user}x por cliente</span>
                      )}
                    </div>

                    <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                      {coupon.valid_from && (
                        <span>Início: {format(new Date(coupon.valid_from), "dd/MM/yyyy")}</span>
                      )}
                      {coupon.valid_until && (
                        <span>Fim: {format(new Date(coupon.valid_until), "dd/MM/yyyy")}</span>
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
                    <Button variant="outline" size="sm" onClick={() => handleOpenDialog(coupon)}>
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
                            O cupom {coupon.code} será excluído permanentemente.
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCoupon ? "Editar Cupom" : "Criar Novo Cupom"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveCoupon} className="space-y-4">
            <div>
              <Label>Código do Cupom *</Label>
              <Input
                placeholder="Ex: PRIMEIRA10, FRETEGRATIS"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                required
              />
            </div>

            <div>
              <Label>Tipo de Cupom *</Label>
              <Select
                value={formData.coupon_type}
                onValueChange={(v) => setFormData({ ...formData, coupon_type: v, target_product_id: "", target_extra_id: "" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discount">Desconto (% ou R$)</SelectItem>
                  <SelectItem value="free_product">Produto Grátis</SelectItem>
                  <SelectItem value="free_delivery">Entrega Grátis</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.coupon_type === "discount" && (
              <>
                <div>
                  <Label>Tipo de Desconto *</Label>
                  <Select
                    value={formData.discount_type}
                    onValueChange={(v) => setFormData({ ...formData, discount_type: v })}
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
                  <Label>{formData.discount_type === "percentage" ? "Percentual (%)" : "Valor (R$)"} *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={formData.discount_type === "percentage" ? "Ex: 10" : "Ex: 5.00"}
                    value={formData.discount_value}
                    onChange={(e) => setFormData({ ...formData, discount_value: e.target.value })}
                    required
                  />
                </div>

                {formData.discount_type === "percentage" && (
                  <div>
                    <Label>Desconto Máximo (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Opcional"
                      value={formData.max_discount}
                      onChange={(e) => setFormData({ ...formData, max_discount: e.target.value })}
                    />
                  </div>
                )}
              </>
            )}

            {formData.coupon_type === "free_product" && (
              <>
                <div>
                  <Label>Produto Grátis *</Label>
                  <Select
                    value={formData.target_product_id}
                    onValueChange={(v) => setFormData({ ...formData, target_product_id: v, target_extra_id: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {productVariations.length > 0 && (
                  <div>
                    <Label>Variação/Tamanho do Produto</Label>

                    <Drawer open={variationDrawerOpen} onOpenChange={setVariationDrawerOpen}>
                      <DrawerTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-between"
                        >
                          <span className="truncate">
                            {formData.target_extra_id
                              ? productVariations.find(v => v.id === formData.target_extra_id)?.name || "Variação selecionada"
                              : "Qualquer variação"}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DrawerTrigger>

                      <DrawerContent className="max-h-[80vh] bg-background z-50">
                        <DrawerHeader>
                          <DrawerTitle>Escolher variação</DrawerTitle>
                        </DrawerHeader>

                        <div className="px-4 pb-4 space-y-2 overflow-y-auto">
                          <Button
                            type="button"
                            variant={formData.target_extra_id === "" ? "default" : "outline"}
                            className="w-full justify-between"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, target_extra_id: "" }));
                              setVariationDrawerOpen(false);
                            }}
                          >
                            <span>Qualquer variação</span>
                          </Button>

                          {productVariations.map((variation) => (
                            <Button
                              key={variation.id}
                              type="button"
                              variant={formData.target_extra_id === variation.id ? "default" : "outline"}
                              className="w-full justify-between"
                              onClick={() => {
                                setFormData(prev => ({ ...prev, target_extra_id: variation.id }));
                                setVariationDrawerOpen(false);
                              }}
                            >
                              <span className="truncate">
                                {variation.name} - R$ {variation.price.toFixed(2)}
                              </span>
                            </Button>
                          ))}

                          <p className="text-xs text-muted-foreground">
                            Escolha qual variação específica será dada de graça
                          </p>
                        </div>
                      </DrawerContent>
                    </Drawer>
                  </div>
                )}
              </>
            )}

            {formData.coupon_type === "free_delivery" && (
              <div className="p-4 bg-accent rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <Truck className="w-4 h-4 inline mr-2" />
                  Este cupom vai zerar a taxa de entrega do pedido
                </p>
              </div>
            )}

            <div>
              <Label>Valor Mínimo do Pedido (R$)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0 para sem mínimo"
                value={formData.min_order_value}
                onChange={(e) => setFormData({ ...formData, min_order_value: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Limite Total de Uso</Label>
                <Input
                  type="number"
                  placeholder="Ilimitado"
                  value={formData.usage_limit}
                  onChange={(e) => setFormData({ ...formData, usage_limit: e.target.value })}
                />
              </div>
              <div>
                <Label>Limite por Cliente (CPF)</Label>
                <Input
                  type="number"
                  placeholder="Ilimitado"
                  value={formData.usage_limit_per_user}
                  onChange={(e) => setFormData({ ...formData, usage_limit_per_user: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Data de Início</Label>
                <Input
                  type="date"
                  value={formData.valid_from}
                  onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
                />
              </div>
              <div>
                <Label>Data de Fim</Label>
                <Input
                  type="date"
                  value={formData.valid_until}
                  onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
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

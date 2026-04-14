import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";

interface CampaignFormProps {
  restaurantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCampaign?: any;
  onSuccess: () => void;
  prefill?: {
    triggerType: string;
    name?: string;
    messageTemplate?: string;
  };
}

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  category_id: string;
}

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  coupon_type: string | null;
  is_active: boolean;
}

const MESSAGE_VARIABLES = [
  { key: "{nome}", desc: "Nome do cliente" },
  { key: "{cupom}", desc: "Código do cupom" },
  { key: "{desconto}", desc: "Valor do desconto" },
  { key: "{produto}", desc: "Produto comprado" },
  { key: "{categoria}", desc: "Categoria comprada" },
  { key: "{validade}", desc: "Dias de validade" },
  { key: "{restaurante}", desc: "Nome do restaurante" },
];

export function CampaignForm({
  restaurantId,
  open,
  onOpenChange,
  editingCampaign,
  onSuccess,
}: CampaignFormProps) {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<"any_purchase" | "product_purchased" | "category_purchased">("any_purchase");
  const [triggerProductId, setTriggerProductId] = useState<string>("");
  const [triggerCategoryId, setTriggerCategoryId] = useState<string>("");
  const [delayValue, setDelayValue] = useState(3);
  const [delayUnit, setDelayUnit] = useState<"seconds" | "minutes" | "hours" | "days">("days");
  const [orderTypeFilter, setOrderTypeFilter] = useState<"all" | "online" | "local">("all");
  const [messageTemplate, setMessageTemplate] = useState(
    "Olá {nome}! 🎉\n\nSentimos sua falta! Use o cupom {cupom} e ganhe {desconto} na sua próxima compra!\n\nVálido por {validade} dias. Te esperamos!"
  );
  const [includeDiscount, setIncludeDiscount] = useState(false);
  const [selectedCouponId, setSelectedCouponId] = useState<string>("");

  useEffect(() => {
    if (open) {
      fetchCategoriesAndProducts();
      
      if (editingCampaign) {
        populateForm(editingCampaign);
      } else {
        resetForm();
      }
    }
  }, [open, editingCampaign]);

  const fetchCategoriesAndProducts = async () => {
    try {
      const { data: categoriesData } = await supabase
        .from("categories")
        .select("id, name")
        .eq("restaurant_id", restaurantId)
        .order("name");

      setCategories(categoriesData || []);

      const { data: productsData } = await supabase
        .from("products")
        .select("id, name, category_id")
        .eq("available", true)
        .in("category_id", (categoriesData || []).map(c => c.id))
        .order("name");

      setProducts(productsData || []);

      // Fetch active coupons
      const { data: couponsData } = await supabase
        .from("coupons")
        .select("id, code, discount_type, discount_value, coupon_type, is_active")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .order("code");

      setCoupons(couponsData || []);
    } catch (error) {
      console.error("Error fetching categories/products/coupons:", error);
    }
  };

  const populateForm = async (campaign: any) => {
    setName(campaign.name);

    // Fetch the rule
    const { data: rule } = await supabase
      .from("marketing_campaign_rules")
      .select("*")
      .eq("campaign_id", campaign.id)
      .single();

    if (rule) {
      setTriggerType(rule.trigger_type as any);
      setTriggerProductId(rule.trigger_product_id || "");
      setTriggerCategoryId(rule.trigger_category_id || "");
      setDelayValue(rule.delay_value);
      setDelayUnit(rule.delay_unit as any);
      setMessageTemplate(rule.message_template);
      setOrderTypeFilter((rule.order_type_filter as any) || "all");
      
      // Load coupon_id directly from the rule
      if (rule.coupon_id) {
        setIncludeDiscount(true);
        setSelectedCouponId(rule.coupon_id);
      } else {
        setIncludeDiscount(false);
        setSelectedCouponId("");
      }
    }
  };

  const resetForm = () => {
    setName("");
    setTriggerType("any_purchase");
    setTriggerProductId("");
    setTriggerCategoryId("");
    setDelayValue(3);
    setDelayUnit("days");
    setMessageTemplate(
      "Olá {nome}! 🎉\n\nSentimos sua falta! Use o cupom {cupom} e ganhe {desconto} na sua próxima compra!\n\nVálido por {validade} dias. Te esperamos!"
    );
    setIncludeDiscount(false);
    setSelectedCouponId("");
    setOrderTypeFilter("all");
  };

  const getSelectedCoupon = () => coupons.find(c => c.id === selectedCouponId);

  const formatCouponDisplay = (coupon: Coupon) => {
    if (coupon.coupon_type === "free_delivery") {
      return `${coupon.code} - Entrega Grátis`;
    }
    if (coupon.coupon_type === "free_product") {
      return `${coupon.code} - Produto Grátis`;
    }
    if (coupon.discount_type === "percentage") {
      return `${coupon.code} - ${coupon.discount_value}% de desconto`;
    }
    return `${coupon.code} - R$ ${coupon.discount_value.toFixed(2)} de desconto`;
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Informe o nome da campanha");
      return;
    }

    if (!messageTemplate.trim()) {
      toast.error("Informe a mensagem a ser enviada");
      return;
    }

    if (triggerType === "product_purchased" && !triggerProductId) {
      toast.error("Selecione o produto gatilho");
      return;
    }

    if (triggerType === "category_purchased" && !triggerCategoryId) {
      toast.error("Selecione a categoria gatilho");
      return;
    }

    if (includeDiscount && !selectedCouponId) {
      toast.error("Selecione um cupom existente");
      return;
    }

    const selectedCoupon = getSelectedCoupon();

    setLoading(true);

    try {
      if (editingCampaign) {
        // Update existing campaign
        const { error: campaignError } = await supabase
          .from("marketing_campaigns")
          .update({ name, updated_at: new Date().toISOString() })
          .eq("id", editingCampaign.id);

        if (campaignError) throw campaignError;

        // Update rule
        const { error: ruleError } = await supabase
          .from("marketing_campaign_rules")
          .update({
            trigger_type: triggerType,
            trigger_product_id: triggerType === "product_purchased" ? triggerProductId : null,
            trigger_category_id: triggerType === "category_purchased" ? triggerCategoryId : null,
            delay_value: delayValue,
            delay_unit: delayUnit,
            message_template: messageTemplate,
            discount_type: includeDiscount && selectedCoupon ? selectedCoupon.discount_type : null,
            discount_value: includeDiscount && selectedCoupon ? selectedCoupon.discount_value : 0,
            discount_target_type: "any",
            discount_target_product_id: null,
            discount_target_category_id: null,
            discount_validity_days: 7,
            order_type_filter: orderTypeFilter,
            coupon_id: includeDiscount ? selectedCouponId : null,
          })
          .eq("campaign_id", editingCampaign.id);

        if (ruleError) throw ruleError;

        toast.success("Campanha atualizada com sucesso!");
      } else {
        // Create new campaign
        const { data: campaign, error: campaignError } = await supabase
          .from("marketing_campaigns")
          .insert({
            restaurant_id: restaurantId,
            name,
            is_active: true,
          })
          .select()
          .single();

        if (campaignError) throw campaignError;

        // Create rule
        const { error: ruleError } = await supabase
          .from("marketing_campaign_rules")
          .insert({
            campaign_id: campaign.id,
            trigger_type: triggerType,
            trigger_product_id: triggerType === "product_purchased" ? triggerProductId : null,
            trigger_category_id: triggerType === "category_purchased" ? triggerCategoryId : null,
            delay_value: delayValue,
            delay_unit: delayUnit,
            message_template: messageTemplate,
            discount_type: includeDiscount && selectedCoupon ? selectedCoupon.discount_type : null,
            discount_value: includeDiscount && selectedCoupon ? selectedCoupon.discount_value : 0,
            discount_target_type: "any",
            discount_target_product_id: null,
            discount_target_category_id: null,
            discount_validity_days: 7,
            order_type_filter: orderTypeFilter,
            coupon_id: includeDiscount ? selectedCouponId : null,
          });

        if (ruleError) throw ruleError;

        toast.success("Campanha criada com sucesso!");
      }

      onSuccess();
    } catch (error) {
      console.error("Error saving campaign:", error);
      toast.error("Erro ao salvar campanha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {editingCampaign ? "Editar Campanha" : "Nova Campanha"}
          </SheetTitle>
          <SheetDescription>
            Configure as regras de disparo automático de mensagens
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Nome da Campanha */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Campanha</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Retorno - Clientes de Pizza"
            />
          </div>

          <Separator />

          {/* Gatilho */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Gatilho</Label>
            <p className="text-sm text-muted-foreground">
              Quando disparar esta campanha?
            </p>

            <RadioGroup
              value={triggerType}
              onValueChange={(v) => setTriggerType(v as any)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="any_purchase" id="any" />
                <Label htmlFor="any">Qualquer compra</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="product_purchased" id="product" />
                <Label htmlFor="product">Produto específico</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="category_purchased" id="category" />
                <Label htmlFor="category">Categoria específica</Label>
              </div>
            </RadioGroup>

            {triggerType === "product_purchased" && (
              <Select value={triggerProductId} onValueChange={setTriggerProductId}>
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
            )}

            {triggerType === "category_purchased" && (
              <Select value={triggerCategoryId} onValueChange={setTriggerCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Separator />

          {/* Delay */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Tempo de espera</Label>
            <p className="text-sm text-muted-foreground">
              Enviar mensagem após quanto tempo?
            </p>

            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                value={delayValue}
                onChange={(e) => setDelayValue(parseInt(e.target.value) || 1)}
                className="w-24"
              />
              <Select value={delayUnit} onValueChange={(v) => setDelayUnit(v as any)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seconds">Segundos</SelectItem>
                  <SelectItem value="minutes">Minutos</SelectItem>
                  <SelectItem value="hours">Horas</SelectItem>
                  <SelectItem value="days">Dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Tipo de Pedido */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Tipo de Pedido</Label>
            <p className="text-sm text-muted-foreground">
              Para quais tipos de pedido esta campanha será acionada?
            </p>

            <RadioGroup
              value={orderTypeFilter}
              onValueChange={(v) => setOrderTypeFilter(v as any)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="order-all" />
                <Label htmlFor="order-all">Ambos (Online + Local)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="online" id="order-online" />
                <Label htmlFor="order-online" className="text-sm">
                  Apenas Online (Delivery/Retirada do cardápio digital ou PDV)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="local" id="order-local" />
                <Label htmlFor="order-local" className="text-sm">
                  Apenas Local (Pedidos de mesas/comandas)
                </Label>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* Mensagem */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Mensagem</Label>
            
            <div className="flex flex-wrap gap-1 text-xs">
              {MESSAGE_VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setMessageTemplate(prev => prev + " " + v.key)}
                  className="px-2 py-1 bg-muted rounded-md hover:bg-muted/80 transition-colors"
                  title={v.desc}
                >
                  {v.key}
                </button>
              ))}
            </div>

            <Textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              rows={6}
              placeholder="Digite a mensagem..."
            />
          </div>

          <Separator />

          {/* Cupom de Desconto */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Incluir Cupom de Desconto</Label>
              <Switch
                checked={includeDiscount}
                onCheckedChange={setIncludeDiscount}
              />
            </div>

            {includeDiscount && (
              <div className="space-y-2">
                <Label>Selecionar Cupom Existente</Label>
                {coupons.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum cupom ativo encontrado. Crie cupons na aba Fidelidade → Cupons.
                  </p>
                ) : (
                  <Select value={selectedCouponId} onValueChange={setSelectedCouponId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cupom" />
                    </SelectTrigger>
                    <SelectContent>
                      {coupons.map((coupon) => (
                        <SelectItem key={coupon.id} value={coupon.id}>
                          {formatCouponDisplay(coupon)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selectedCouponId && getSelectedCoupon() && (
                  <p className="text-xs text-muted-foreground">
                    O código do cupom será incluído automaticamente na mensagem usando a variável {"{cupom}"}
                  </p>
                )}
              </div>
            )}
          </div>

          <Separator />

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1"
            >
              {loading ? "Salvando..." : editingCampaign ? "Atualizar" : "Criar Campanha"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

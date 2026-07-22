import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Plus, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";

/**
 * Ofertas da Sacola (upsell por produto).
 *
 * "Quem adicionar o produto X na sacola vê o produto Y com desconto."
 * O cliente vê a oferta embaixo do item na sacola, com preço riscado,
 * preço com desconto em destaque e badge do desconto.
 */

interface ProductLite {
  id: string;
  name: string;
  price: number;
  promotional_price: number | null;
}

interface UpsellRule {
  id: string;
  trigger_product_id: string;
  upsell_product_id: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  is_active: boolean;
}

export function UpsellManagerCard({ restaurantId }: { restaurantId: string }) {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<UpsellRule[]>([]);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [triggerId, setTriggerId] = useState("");
  const [upsellId, setUpsellId] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState("10");

  const productName = (id: string) => products.find((p) => p.id === id)?.name || "—";

  const fetchAll = async () => {
    const [rulesRes, productsRes] = await Promise.all([
      (supabase as any)
        .from("product_upsells")
        .select("id, trigger_product_id, upsell_product_id, discount_type, discount_value, is_active")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false }),
      supabase
        .from("products")
        .select("id, name, price, promotional_price")
        .eq("restaurant_id", restaurantId)
        .order("name"),
    ]);
    if (!rulesRes.error && rulesRes.data) setRules(rulesRes.data as UpsellRule[]);
    if (!productsRes.error && productsRes.data) {
      setProducts(
        (productsRes.data as any[]).map((p) => ({
          id: p.id, name: p.name, price: p.price, promotional_price: p.promotional_price,
        }))
      );
    }
  };

  useEffect(() => {
    if (open) fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, restaurantId]);

  const previewPrice = () => {
    const p = products.find((x) => x.id === upsellId);
    if (!p) return null;
    const base = p.promotional_price ?? p.price;
    const v = parseFloat(discountValue.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) return null;
    const final = discountType === "percentage" ? base * (1 - v / 100) : base - v;
    return { base, final: Math.max(0, Math.round(final * 100) / 100) };
  };

  const handleSave = async () => {
    const v = parseFloat(discountValue.replace(",", "."));
    if (!triggerId || !upsellId) {
      toast.error("Selecione o produto gatilho e o produto da oferta");
      return;
    }
    if (triggerId === upsellId) {
      toast.error("O produto da oferta deve ser diferente do gatilho");
      return;
    }
    if (!Number.isFinite(v) || v <= 0 || (discountType === "percentage" && v >= 100)) {
      toast.error("Desconto inválido");
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any).from("product_upsells").insert({
        restaurant_id: restaurantId,
        trigger_product_id: triggerId,
        upsell_product_id: upsellId,
        discount_type: discountType,
        discount_value: v,
        is_active: true,
      });
      if (error) {
        if (String(error.message || "").includes("duplicate") || String(error.code) === "23505") {
          toast.error("Já existe uma oferta desse gatilho para esse produto");
        } else {
          throw error;
        }
        return;
      }
      toast.success("Oferta criada!");
      setDialogOpen(false);
      setTriggerId(""); setUpsellId(""); setDiscountType("percentage"); setDiscountValue("10");
      fetchAll();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar oferta");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: UpsellRule) => {
    const { error } = await (supabase as any)
      .from("product_upsells")
      .update({ is_active: !rule.is_active, updated_at: new Date().toISOString() })
      .eq("id", rule.id);
    if (error) toast.error("Erro ao atualizar");
    else fetchAll();
  };

  const handleDelete = async (rule: UpsellRule) => {
    const { error } = await (supabase as any).from("product_upsells").delete().eq("id", rule.id);
    if (error) toast.error("Erro ao excluir");
    else {
      toast.success("Oferta removida");
      fetchAll();
    }
  };

  const preview = previewPrice();

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-6 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-green-600" />
              <h3 className="text-lg font-semibold">Ofertas da Sacola (Peça Junto)</h3>
            </div>
            <ChevronDown className={`h-5 w-5 transition-transform ${open ? "rotate-180" : ""}`} />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-6 pb-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Quando o cliente adicionar o <b>produto gatilho</b> na sacola, o <b>produto da
              oferta</b> aparece logo abaixo dele com o desconto configurado (preço riscado +
              badge). Válido no cardápio delivery e no cardápio da mesa.
            </p>

            <div className="flex justify-end">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Oferta
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Nova Oferta da Sacola</DialogTitle>
                    <DialogDescription>
                      Ex.: quem pedir Hambúrguer Salada vê Batata Média com 10% de desconto.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Produto gatilho (o que o cliente adiciona)</Label>
                      <Select value={triggerId} onValueChange={setTriggerId}>
                        <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Produto da oferta (aparece com desconto)</Label>
                      <Select value={upsellId} onValueChange={setUpsellId}>
                        <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                        <SelectContent>
                          {products.filter((p) => p.id !== triggerId).map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Tipo de desconto</Label>
                        <Select value={discountType} onValueChange={(v) => setDiscountType(v as any)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                            <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{discountType === "percentage" ? "Desconto (%)" : "Desconto (R$)"}</Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                        />
                      </div>
                    </div>
                    {preview && (
                      <div className="rounded-lg border border-green-500/50 bg-green-50 dark:bg-green-950/30 p-3 text-sm">
                        O cliente verá:{" "}
                        <span className="line-through text-muted-foreground">
                          R$ {preview.base.toFixed(2).replace(".", ",")}
                        </span>{" "}
                        <span className="font-bold text-green-600">
                          R$ {preview.final.toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                    )}
                    <Button className="w-full" onClick={handleSave} disabled={saving}>
                      {saving ? "Salvando..." : "Criar Oferta"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma oferta configurada ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {productName(rule.trigger_product_id)}{" "}
                        <span className="text-muted-foreground">→</span>{" "}
                        {productName(rule.upsell_product_id)}
                      </p>
                      <Badge variant="secondary" className="mt-1">
                        {rule.discount_type === "percentage"
                          ? `-${Number(rule.discount_value)}%`
                          : `-R$ ${Number(rule.discount_value).toFixed(2).replace(".", ",")}`}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Switch checked={rule.is_active} onCheckedChange={() => handleToggle(rule)} />
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(rule)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

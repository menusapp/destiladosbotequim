import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Play, Pause, Trash2, Edit, MessageSquare, Ticket, TrendingUp, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CampaignForm } from "./CampaignForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Campaign {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  rule?: {
    trigger_type: string;
    trigger_product_id: string | null;
    trigger_category_id: string | null;
    delay_value: number;
    delay_unit: string;
    discount_type: string | null;
    discount_value: number;
    discount_target_type: string;
  };
  metrics?: {
    sent: number;
    couponsUsed: number;
    sales: number;
  };
  trigger_product_name?: string;
  trigger_category_name?: string;
}

interface CampaignsListProps {
  restaurantId: string;
}

export function CampaignsList({ restaurantId }: CampaignsListProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaigns();
  }, [restaurantId]);

  const fetchCampaigns = async () => {
    try {
      // Fetch campaigns with their rules
      const { data: campaignsData, error: campaignsError } = await supabase
        .from("marketing_campaigns")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });

      if (campaignsError) throw campaignsError;

      if (!campaignsData || campaignsData.length === 0) {
        setCampaigns([]);
        setLoading(false);
        return;
      }

      // Fetch rules for all campaigns
      const { data: rulesData } = await supabase
        .from("marketing_campaign_rules")
        .select("*")
        .in("campaign_id", campaignsData.map(c => c.id));

      // Fetch metrics for each campaign
      const campaignsWithMetrics = await Promise.all(
        campaignsData.map(async (campaign) => {
          const rule = rulesData?.find(r => r.campaign_id === campaign.id);
          
          // Get sent messages count
          const { count: sentCount } = await supabase
            .from("marketing_scheduled_messages")
            .select("*", { count: "exact", head: true })
            .eq("campaign_id", campaign.id)
            .eq("status", "sent");

          // Get product/category names for display
          let triggerProductName: string | undefined;
          let triggerCategoryName: string | undefined;

          if (rule?.trigger_product_id) {
            const { data: product } = await supabase
              .from("products")
              .select("name")
              .eq("id", rule.trigger_product_id)
              .single();
            triggerProductName = product?.name;
          }

          if (rule?.trigger_category_id) {
            const { data: category } = await supabase
              .from("categories")
              .select("name")
              .eq("id", rule.trigger_category_id)
              .single();
            triggerCategoryName = category?.name;
          }

          // Get coupons used count (approximate - based on scheduled messages that had coupons)
          const { data: scheduledWithCoupons } = await supabase
            .from("marketing_scheduled_messages")
            .select("coupon_code")
            .eq("campaign_id", campaign.id)
            .eq("status", "sent")
            .not("coupon_code", "is", null);

          let couponsUsed = 0;
          let totalSales = 0;

          if (scheduledWithCoupons && scheduledWithCoupons.length > 0) {
            const couponCodes = scheduledWithCoupons.map(s => s.coupon_code).filter(Boolean);
            
            if (couponCodes.length > 0) {
              const { data: usedCoupons } = await supabase
                .from("coupons")
                .select("code, used_count")
                .in("code", couponCodes);
              
              couponsUsed = usedCoupons?.reduce((sum, c) => sum + (c.used_count || 0), 0) || 0;

              // Get sales from orders using these coupons
              const { data: ordersWithCoupons } = await supabase
                .from("orders")
                .select("id, order_items(price_at_order, quantity)")
                .in("coupon_code", couponCodes);

              if (ordersWithCoupons) {
                totalSales = ordersWithCoupons.reduce((sum, order) => {
                  const orderTotal = order.order_items?.reduce((s: number, i: any) => 
                    s + (i.price_at_order * i.quantity), 0) || 0;
                  return sum + orderTotal;
                }, 0);
              }
            }
          }

          return {
            ...campaign,
            rule,
            trigger_product_name: triggerProductName,
            trigger_category_name: triggerCategoryName,
            metrics: {
              sent: sentCount || 0,
              couponsUsed,
              sales: totalSales,
            },
          };
        })
      );

      setCampaigns(campaignsWithMetrics);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      toast.error("Erro ao carregar campanhas");
    } finally {
      setLoading(false);
    }
  };

  const toggleCampaign = async (campaignId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("marketing_campaigns")
        .update({ is_active: isActive })
        .eq("id", campaignId);

      if (error) throw error;

      setCampaigns(prev =>
        prev.map(c => (c.id === campaignId ? { ...c, is_active: isActive } : c))
      );

      toast.success(isActive ? "Campanha ativada" : "Campanha pausada");
    } catch (error) {
      console.error("Error toggling campaign:", error);
      toast.error("Erro ao atualizar campanha");
    }
  };

  const deleteCampaign = async () => {
    if (!deleteId) return;

    try {
      // First cancel all pending messages
      await supabase
        .from("marketing_scheduled_messages")
        .update({ status: "cancelled" })
        .eq("campaign_id", deleteId)
        .eq("status", "pending");

      // Then delete the campaign (rules will be cascade deleted)
      const { error } = await supabase
        .from("marketing_campaigns")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;

      setCampaigns(prev => prev.filter(c => c.id !== deleteId));
      toast.success("Campanha excluída");
    } catch (error) {
      console.error("Error deleting campaign:", error);
      toast.error("Erro ao excluir campanha");
    } finally {
      setDeleteId(null);
    }
  };

  const getTriggerDescription = (campaign: Campaign) => {
    if (!campaign.rule) return "Sem gatilho configurado";

    switch (campaign.rule.trigger_type) {
      case "product_purchased":
        return `Comprou: ${campaign.trigger_product_name || "Produto"}`;
      case "category_purchased":
        return `Comprou categoria: ${campaign.trigger_category_name || "Categoria"}`;
      case "any_purchase":
        return "Qualquer compra";
      default:
        return "Gatilho desconhecido";
    }
  };

  const getDelayDescription = (campaign: Campaign) => {
    if (!campaign.rule) return "";

    const { delay_value, delay_unit } = campaign.rule;
    const unitLabel = {
      minutes: delay_value === 1 ? "minuto" : "minutos",
      hours: delay_value === 1 ? "hora" : "horas",
      days: delay_value === 1 ? "dia" : "dias",
    }[delay_unit] || delay_unit;

    return `${delay_value} ${unitLabel} depois`;
  };

  const getDiscountDescription = (campaign: Campaign) => {
    if (!campaign.rule?.discount_type) return "Sem desconto";

    const { discount_type, discount_value, discount_target_type } = campaign.rule;
    const discountText = discount_type === "percentage" 
      ? `${discount_value}%` 
      : `R$ ${discount_value.toFixed(2)}`;

    const targetText = {
      any: "qualquer item",
      same_category: "mesma categoria",
      category: "categoria específica",
      product: "produto específico",
    }[discount_target_type] || discount_target_type;

    return `${discountText} em ${targetText}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Carregando campanhas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Suas Campanhas</h2>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Campanha
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma campanha criada</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crie sua primeira campanha de marketing para engajar seus clientes automaticamente
            </p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Campanha
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={campaign.is_active}
                      onCheckedChange={(checked) => toggleCampaign(campaign.id, checked)}
                    />
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {campaign.name}
                        <Badge variant={campaign.is_active ? "default" : "secondary"}>
                          {campaign.is_active ? "Ativa" : "Pausada"}
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {getTriggerDescription(campaign)} → {getDelayDescription(campaign)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditingCampaign(campaign);
                        setShowForm(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(campaign.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline">{getDiscountDescription(campaign)}</Badge>
                </div>

                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{campaign.metrics?.sent || 0}</p>
                      <p className="text-muted-foreground text-xs">Enviadas</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{campaign.metrics?.couponsUsed || 0}</p>
                      <p className="text-muted-foreground text-xs">Cupons usados</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {campaign.metrics?.sent 
                          ? ((campaign.metrics.couponsUsed / campaign.metrics.sent) * 100).toFixed(1) 
                          : 0}%
                      </p>
                      <p className="text-muted-foreground text-xs">Conversão</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        R$ {(campaign.metrics?.sales || 0).toFixed(2)}
                      </p>
                      <p className="text-muted-foreground text-xs">Vendas</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Campaign Form Drawer */}
      <CampaignForm
        restaurantId={restaurantId}
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditingCampaign(null);
        }}
        editingCampaign={editingCampaign}
        onSuccess={() => {
          setShowForm(false);
          setEditingCampaign(null);
          fetchCampaigns();
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as mensagens agendadas desta
              campanha serão canceladas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteCampaign} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

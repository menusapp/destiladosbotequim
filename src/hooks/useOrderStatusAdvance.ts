import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { printDocument } from "@/lib/printDispatcher";
import { getPublicMenuLink } from "@/lib/shareableLinks";

// Gera links públicos no formato path-based:
// https://menusapp.com.br/<slug>/<path>
// (Subdomínios desativados — domínio hospedado no Lovable não suporta wildcard.)
function buildPublicUrl(slug: string, path?: string): string {
  return getPublicMenuLink(slug, path);
}

interface Order {
  id: string;
  status: string;
  customer_name: string;
  delivery_type?: string;
  order_type?: string;
  delivery_phone?: string;
  customer_cpf?: string;
  table_id?: string;
  tables?: { table_number: number };
  ifood_source?: boolean;
  ifood_order_id?: string;
  dd_source?: boolean;
  dd_order_id?: string;
  payment_type?: string;
  payment_brand?: string;
  order_items?: any[];
  delivery_fee?: number;
  coupon_discount?: number;
  loyalty_points_used?: number;
  created_at?: string;
  notes?: string;
  delivery_address?: string;
  dd_scheduled_for?: string;
  cancellation_reason?: string;
}

interface NextStatusResult {
  status: string;
  label: string;
}

export function getNextStatus(order: Order): NextStatusResult | null {
  const isDelivery = order.order_type === "delivery" && order.delivery_type === "delivery";
  const isPickup = order.order_type === "delivery" && order.delivery_type === "pickup";
  const isTakeaway = order.order_type === "delivery" && order.delivery_type === "takeaway";
  const isBalcao = order.order_type === "balcao";
  const isLocal = order.order_type === "local" || (!order.order_type && !!order.table_id);
  const isIfood = !!order.ifood_source;

  switch (order.status) {
    case "pending":
      return { status: "accepted", label: "Confirmar" };
    case "accepted":
      // iFood requires explicit startPreparation transition before readyToPickup/dispatch.
      if (isIfood && (isDelivery || isPickup || isTakeaway)) {
        return { status: "preparing", label: "Iniciar Preparo" };
      }
      // fallthrough to legacy behavior
      if (isDelivery) return { status: "out_for_delivery", label: "Saiu p/ Entrega" };
      if (isPickup) return { status: "out_for_delivery", label: "Pronto p/ Retirada" };
      if (isTakeaway) return { status: "picked_up", label: "Retirado" };
      if (isBalcao) return { status: "ready", label: "Pronto" };
      if (isLocal) return { status: "delivered", label: "Na Mesa" };
      return { status: "preparing", label: "Em Preparo" };
    case "preparing":
      // iFood: preparing -> ready (readyToPickup) for all delivery_types
      if (isIfood && (isDelivery || isPickup || isTakeaway)) {
        return { status: "ready", label: isDelivery ? "Pronto" : "Pronto p/ Retirada" };
      }
      if (isDelivery) return { status: "out_for_delivery", label: "Saiu p/ Entrega" };
      if (isPickup) return { status: "out_for_delivery", label: "Pronto p/ Retirada" };
      if (isTakeaway) return { status: "picked_up", label: "Retirado" };
      if (isBalcao) return { status: "ready", label: "Pronto" };
      if (isLocal) return { status: "delivered", label: "Na Mesa" };
      return { status: "ready", label: "Pronto" };
    case "ready":
      // iFood DELIVERY: ready -> out_for_delivery (dispatch)
      if (isIfood && isDelivery) return { status: "out_for_delivery", label: "Despachar" };
      // iFood TAKEOUT/PICKUP: encerra em ready (sem dispatch)
      if (isIfood && (isPickup || isTakeaway)) return null;
      if (isBalcao) return { status: "picked_up", label: "Retirado" };
      if (isLocal) return { status: "delivered", label: "Na Mesa" };
      return null;
    case "out_for_delivery":
      if (isDelivery) return { status: "delivered", label: "Entregue" };
      if (isPickup) return { status: "picked_up", label: "Retirado" };
      return null;
    default:
      return null;
  }
}

export function useOrderStatusAdvance(restaurantId: string) {
  const [loadingOrderId, setLoadingOrderId] = useState<string | null>(null);

  const getRestaurantSlug = async (): Promise<string> => {
    const { data } = await supabase
      .from("restaurants")
      .select("slug")
      .eq("id", restaurantId)
      .single();
    return data?.slug || '';
  };

  const sendWhatsAppNotification = async (order: Order, newStatus: string, reason?: string) => {
    try {
      let notificationType: string | null = null;
      if (newStatus === "accepted" || newStatus === "preparing") notificationType = "order_accepted";
      else if (newStatus === "out_for_delivery") notificationType = "order_out_for_delivery";
      else if (newStatus === "ready") notificationType = "order_ready_pickup";
      else if (newStatus === "cancelled") notificationType = "order_cancelled";

      if (!notificationType) {
        console.log(`[WhatsApp][NOTIF] Status "${newStatus}" sem template mapeado — ignorando.`);
        return;
      }

      // Sempre tentar resolver telefone a partir do cadastro do cliente (CPF),
      // caindo de volta para o telefone do pedido. Isso garante notificação mesmo
      // quando delivery_phone vier vazio (pickup, balcao, etc).
      let phone: string | null = order.delivery_phone?.trim() || null;

      if (!phone && order.customer_cpf) {
        const { data: customer } = await supabase
          .from("customers")
          .select("phone")
          .eq("restaurant_id", restaurantId)
          .eq("cpf", order.customer_cpf)
          .maybeSingle();
        phone = customer?.phone?.trim() || null;
      }

      // Último fallback: buscar pelo nome do cliente neste restaurante
      if (!phone && order.customer_name) {
        const { data: customer } = await supabase
          .from("customers")
          .select("phone")
          .eq("restaurant_id", restaurantId)
          .ilike("name", order.customer_name.trim())
          .not("phone", "is", null)
          .limit(1)
          .maybeSingle();
        phone = customer?.phone?.trim() || null;
      }

      if (!phone) {
        console.warn(
          `[WhatsApp][NOTIF] Pedido ${order.id.slice(0, 8)} sem telefone — notificação "${notificationType}" não enviada.`
        );
        return;
      }

      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("prep_time_minutes, slug")
        .eq("id", restaurantId)
        .maybeSingle();

      const slug = restaurant?.slug || '';

      console.log(`[WhatsApp][NOTIF] Disparando ${notificationType} para pedido ${order.id.slice(0, 8)} (phone=${phone})`);

      const invokePromise = supabase.functions.invoke("whatsapp-notifications", {
        body: {
          restaurant_id: restaurantId,
          notification_type: notificationType,
          context: {
            nome: order.customer_name || "Cliente",
            numero_pedido: order.id.slice(0, 8),
            order_id: order.id,
            tempo_estimado: restaurant?.prep_time_minutes?.toString() || "30",
            phone,
            motivo: reason || "Não informado",
            link_avaliacao: buildPublicUrl(slug, `pedido/${order.id}`),
          },
        },
      });

      // Não bloqueia o fluxo, mas garante que falhas sejam logadas (evita
      // promise rejections silenciosas que escondiam erros de notificação).
      invokePromise
        .then((res) => {
          if (res.error) {
            console.error(`[WhatsApp][NOTIF] invoke error (${notificationType}):`, res.error);
          } else {
            console.log(`[WhatsApp][NOTIF] invoke ok (${notificationType}):`, res.data);
          }
        })
        .catch((err) => {
          console.error(`[WhatsApp][NOTIF] invoke threw (${notificationType}):`, err);
        });
    } catch (error) {
      console.error("[WhatsApp][NOTIF] Erro:", error);
    }
  };


  const syncDDStatus = async (order: Order, newStatus: string, reason?: string): Promise<{ ok: boolean; errorMsg?: string }> => {
    if (!order.dd_source || !order.dd_order_id) return { ok: true };
    const statusToAction: Record<string, string> = {
      accepted: "accept", preparing: "accept", out_for_delivery: "dispatch",
      ready: "ready", delivered: "deliver", picked_up: "deliver", cancelled: "cancel",
    };
    const ddAction = statusToAction[newStatus];
    if (!ddAction) return { ok: true };
    try {
      const res = await supabase.functions.invoke("dd-order-action", {
        body: { restaurant_id: restaurantId, dd_order_id: order.dd_order_id, action: ddAction, reason: reason || undefined },
      });
      if (res.data?.error) return { ok: false, errorMsg: res.data.error };
      if (res.error) {
        const errMsg = typeof res.error === "object" ? (res.error as any)?.message || JSON.stringify(res.error) : String(res.error);
        return { ok: false, errorMsg: errMsg };
      }
      return { ok: true };
    } catch (e) { return { ok: false, errorMsg: (e as Error).message }; }
  };

  const syncIfoodStatus = async (order: Order, newStatus: string, reason?: string, cancellationCode?: string) => {
    if (!order.ifood_source || !order.ifood_order_id) return;
    const statusToAction: Record<string, string> = {
      accepted: "confirm", preparing: "start_preparation", ready: "ready_to_pickup",
      out_for_delivery: "dispatch", cancelled: "cancel",
    };
    const ifoodAction = statusToAction[newStatus];
    if (!ifoodAction) return;
    console.log("[iFood][action] dispatch", { orderId: order.id, ifoodOrderId: order.ifood_order_id, action: ifoodAction, cancellationCode, reason });
    const { data, error } = await supabase.functions.invoke("ifood-order-action", {
      body: { restaurant_id: restaurantId, ifood_order_id: order.ifood_order_id, order_id: order.id, action: ifoodAction, cancellation_code: cancellationCode, reason },
    });
    console.log("[iFood][action] response", { data, error });
    if (error) {
      console.error("iFood action error:", error);
      toast.error("Erro ao sincronizar com iFood, mas o status local será atualizado");
    }
  };

  const requiresPaymentForFinalization = (order: Order, newStatus: string) => {
    if (order.ifood_source && order.payment_type === "Pago pelo iFood") return false;
    if (order.dd_source && order.payment_type === "Pago Delivery Direto") return false;
    const isLocal = order.order_type === "local" || (!order.order_type && order.table_id);
    if (isLocal) return false;
    return ["delivered", "picked_up"].includes(newStatus);
  };

  const advanceStatus = async (order: Order, newStatus: string, reason?: string, cancellationCode?: string): Promise<boolean> => {
    if (requiresPaymentForFinalization(order, newStatus) && (!order.payment_type || order.payment_type === "pending")) {
      toast.error("Defina a forma de pagamento antes de finalizar o pedido");
      return false;
    }

    setLoadingOrderId(order.id);
    try {
      await syncIfoodStatus(order, newStatus, reason, cancellationCode);

      const ddResult = await syncDDStatus(order, newStatus, reason);
      if (!ddResult.ok) {
        toast.error(`Delivery Direto: ${ddResult.errorMsg || "Erro ao sincronizar"}`);
        return false;
      }

      const { error } = await supabase.rpc("admin_update_order_status", { p_order_id: order.id, p_new_status: newStatus, p_restaurant_id: restaurantId });
      if (error) throw error;

      if (newStatus === "cancelled" && reason) {
        await supabase.from("orders").update({ cancellation_reason: reason }).eq("id", order.id);
      }

      // WhatsApp notification via unified engine (fire-and-forget)
      sendWhatsAppNotification(order, newStatus, reason);

      // Accept: mark table occupied + auto-print
      if (newStatus === "accepted") {
        if (order.order_type === "local" && order.table_id) {
          await supabase.from("tables").update({ is_occupied: true, occupied_at: new Date().toISOString(), occupied_by: order.customer_name }).eq("id", order.table_id);
        }
        try {
          const { data: printerConfig } = await supabase.from("printer_settings").select("auto_print_orders").eq("restaurant_id", restaurantId).maybeSingle();
          if (printerConfig?.auto_print_orders) await printDocument(order as any, restaurantId, { showToasts: false });
        } catch (printErr) { console.error("Auto-print error:", printErr); }
      }

      // Marketing trigger + review request on finalization
      if (newStatus === "delivered" || newStatus === "picked_up") {
        supabase.functions.invoke("marketing-trigger", { body: { orderId: order.id, restaurantId } });

        let phone: string | null = order.delivery_phone?.trim() || null;
        if (!phone && order.customer_cpf) {
          const { data: customer } = await supabase
            .from("customers")
            .select("phone")
            .eq("restaurant_id", restaurantId)
            .eq("cpf", order.customer_cpf)
            .maybeSingle();
          phone = customer?.phone?.trim() || null;
        }
        if (!phone && order.customer_name) {
          const { data: customer } = await supabase
            .from("customers")
            .select("phone")
            .eq("restaurant_id", restaurantId)
            .ilike("name", order.customer_name.trim())
            .not("phone", "is", null)
            .limit(1)
            .maybeSingle();
          phone = customer?.phone?.trim() || null;
        }

        if (phone) {
          const slug = await getRestaurantSlug();
          console.log(`[WhatsApp][NOTIF] Disparando order_delivered para pedido ${order.id.slice(0, 8)} (phone=${phone})`);
          supabase.functions.invoke("whatsapp-notifications", {
            body: {
              restaurant_id: restaurantId,
              notification_type: "order_delivered",
              context: {
                nome: order.customer_name || "Cliente",
                numero_pedido: order.id.slice(0, 8),
                order_id: order.id,
                phone,
                link_avaliacao: buildPublicUrl(slug, `pedido/${order.id}`),
              },
            },
          })
            .then((res) => {
              if (res.error) console.error("[WhatsApp][NOTIF] order_delivered error:", res.error);
              else console.log("[WhatsApp][NOTIF] order_delivered ok:", res.data);
            })
            .catch((err) => console.error("[WhatsApp][NOTIF] order_delivered threw:", err));
        } else {
          console.warn(
            `[WhatsApp][NOTIF] Pedido ${order.id.slice(0, 8)} finalizado sem telefone — order_delivered não enviada.`
          );
        }
      }


      toast.success("Status atualizado!");
      return true;
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      toast.error("Erro ao atualizar status");
      return false;
    } finally {
      setLoadingOrderId(null);
    }
  };

  return { advanceStatus, loadingOrderId, getNextStatus };
}

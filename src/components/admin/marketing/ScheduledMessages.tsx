import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, X, MessageSquare, User, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ScheduledMessage {
  id: string;
  campaign_id: string;
  customer_name: string;
  customer_phone: string;
  message_text: string;
  coupon_code: string | null;
  scheduled_for: string;
  status: string;
  created_at: string;
  campaign_name?: string;
}

interface ScheduledMessagesProps {
  restaurantId: string;
}

export function ScheduledMessages({ restaurantId }: ScheduledMessagesProps) {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMessages();
    
    // Subscribe to changes
    const channel = supabase
      .channel("scheduled-messages")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "marketing_scheduled_messages",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("marketing_scheduled_messages")
        .select(`
          *,
          marketing_campaigns(name)
        `)
        .eq("restaurant_id", restaurantId)
        .eq("status", "pending")
        .order("scheduled_for", { ascending: true });

      if (error) throw error;

      setMessages(
        (data || []).map((m) => ({
          ...m,
          campaign_name: m.marketing_campaigns?.name,
        }))
      );
    } catch (error) {
      console.error("Error fetching scheduled messages:", error);
      toast.error("Erro ao carregar mensagens agendadas");
    } finally {
      setLoading(false);
    }
  };

  const cancelMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from("marketing_scheduled_messages")
        .update({ status: "cancelled" })
        .eq("id", messageId);

      if (error) throw error;

      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      toast.success("Mensagem cancelada");
    } catch (error) {
      console.error("Error canceling message:", error);
      toast.error("Erro ao cancelar mensagem");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Carregando mensagens agendadas...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Mensagens Agendadas</h2>
        <Badge variant="secondary">{messages.length} pendentes</Badge>
      </div>

      {messages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma mensagem agendada</h3>
            <p className="text-muted-foreground text-center">
              As mensagens aparecerão aqui quando clientes ativarem suas campanhas
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {messages.map((message) => (
            <Card key={message.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{message.campaign_name}</Badge>
                      {message.coupon_code && (
                        <Badge variant="secondary">Cupom: {message.coupon_code}</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {message.customer_name}
                      </div>
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {message.customer_phone}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>
                        Agendada para:{" "}
                        <strong>
                          {format(new Date(message.scheduled_for), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR,
                          })}
                        </strong>
                      </span>
                    </div>

                    <div className="text-sm bg-muted p-2 rounded-md mt-2">
                      <MessageSquare className="h-3 w-3 inline mr-1" />
                      <span className="whitespace-pre-wrap">{message.message_text}</span>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => cancelMessage(message.id)}
                    title="Cancelar envio"
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

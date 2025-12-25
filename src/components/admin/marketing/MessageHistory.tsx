import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, CheckCircle, XCircle, User, Phone, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface HistoryMessage {
  id: string;
  campaign_id: string;
  customer_name: string;
  customer_phone: string;
  message_text: string;
  coupon_code: string | null;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
  campaign_name?: string;
}

interface MessageHistoryProps {
  restaurantId: string;
}

export function MessageHistory({ restaurantId }: MessageHistoryProps) {
  const [messages, setMessages] = useState<HistoryMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [restaurantId]);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("marketing_scheduled_messages")
        .select(`
          *,
          marketing_campaigns(name)
        `)
        .eq("restaurant_id", restaurantId)
        .in("status", ["sent", "failed"])
        .order("sent_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      setMessages(
        (data || []).map((m) => ({
          ...m,
          campaign_name: m.marketing_campaigns?.name,
        }))
      );
    } catch (error) {
      console.error("Error fetching message history:", error);
      toast.error("Erro ao carregar histórico");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Carregando histórico...</p>
      </div>
    );
  }

  const sentCount = messages.filter((m) => m.status === "sent").length;
  const failedCount = messages.filter((m) => m.status === "failed").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Histórico de Envios</h2>
        <div className="flex gap-2">
          <Badge variant="default" className="bg-success">
            <CheckCircle className="h-3 w-3 mr-1" />
            {sentCount} enviadas
          </Badge>
          {failedCount > 0 && (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" />
              {failedCount} falhas
            </Badge>
          )}
        </div>
      </div>

      {messages.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <History className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma mensagem enviada ainda</h3>
            <p className="text-muted-foreground text-center">
              O histórico de mensagens enviadas aparecerá aqui
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
                      {message.status === "sent" ? (
                        <CheckCircle className="h-4 w-4 text-success" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
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

                    {message.sent_at && (
                      <p className="text-xs text-muted-foreground">
                        Enviada em:{" "}
                        {format(new Date(message.sent_at), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                    )}

                    {message.error_message && (
                      <p className="text-xs text-destructive">
                        Erro: {message.error_message}
                      </p>
                    )}

                    <div className="text-sm bg-muted p-2 rounded-md mt-2">
                      <MessageSquare className="h-3 w-3 inline mr-1" />
                      <span className="whitespace-pre-wrap line-clamp-2">
                        {message.message_text}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  restaurantName: string;
  orderId?: string;
  counterOrderId?: string;
  billId?: string;
}

export const ReviewModal = ({
  open,
  onClose,
  restaurantId,
  restaurantName,
  orderId,
  counterOrderId,
  billId,
}: ReviewModalProps) => {
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Por favor, selecione uma avaliação de 1 a 5 estrelas");
      return;
    }

    setSubmitting(true);

    try {
      // Verificar se a bill ainda existe (pode ter sido deletada)
      let validBillId = null;
      if (billId) {
        const { data: billExists } = await supabase
          .from("bills")
          .select("id")
          .eq("id", billId)
          .maybeSingle();
        
        validBillId = billExists?.id || null;
      }

      const { error } = await supabase.from("restaurant_reviews").insert({
        restaurant_id: restaurantId,
        order_id: orderId || null,
        counter_order_id: counterOrderId || null,
        bill_id: validBillId,
        rating,
        comment: comment.trim() || null,
      });

      if (error) throw error;

      toast.success("Avaliação enviada com sucesso!");
      onClose();
    } catch (error) {
      console.error("Erro ao enviar avaliação:", error);
      toast.error("Erro ao enviar avaliação");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            Como foi sua experiência com o {restaurantName}?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Stars */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-10 h-10 ${
                    star <= (hoveredRating || rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Deixe um comentário (opcional)
            </label>
            <Textarea
              placeholder="Conte-nos sobre sua experiência..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground text-right">
              {comment.length}/500
            </p>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
            className="w-full"
          >
            {submitting ? "Enviando..." : "Enviar avaliação"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

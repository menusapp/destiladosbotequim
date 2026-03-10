import { useEffect, useState } from "react";
import { Star, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  customer_name: string;
}

interface ReviewsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  rating: number;
  reviewCount: number;
}

export const ReviewsDrawer = ({
  open,
  onOpenChange,
  restaurantId,
  rating,
  reviewCount,
}: ReviewsDrawerProps) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    const fetchReviews = async () => {
      setLoading(true);
      try {
        // Fetch reviews with order/counter_order join for customer name
        const { data, error } = await supabase
          .from("restaurant_reviews")
          .select(`
            id,
            rating,
            comment,
            created_at,
            order_id,
            counter_order_id,
            orders!restaurant_reviews_order_id_fkey(customer_name),
            counter_orders!restaurant_reviews_counter_order_id_fkey(customer_name)
          `)
          .eq("restaurant_id", restaurantId)
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Erro ao buscar avaliações:", error);
          return;
        }

        const mapped: Review[] = (data || []).map((r: any) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          created_at: r.created_at,
          customer_name:
            r.orders?.customer_name ||
            r.counter_orders?.customer_name ||
            "Cliente",
        }));

        setReviews(mapped);
      } catch (err) {
        console.error("Erro ao buscar avaliações:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [open, restaurantId]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="text-center pb-2">
          <DrawerTitle className="text-lg font-semibold">
            Avaliações
          </DrawerTitle>
          <div className="flex items-center justify-center gap-2 mt-1">
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-4 h-4 ${
                    rating > 0 && star <= Math.round(rating)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-gray-300"
                  }`}
                />
              ))}
            </div>
            <span className="font-semibold text-foreground">
              {rating > 0 ? rating.toFixed(1) : "0,0"}
            </span>
            <span className="text-sm text-muted-foreground">
              ({reviewCount}{" "}
              {reviewCount === 1 ? "avaliação" : "avaliações"})
            </span>
          </div>
        </DrawerHeader>

        <ScrollArea className="px-4 pb-6" style={{ maxHeight: "60vh" }}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground text-sm">Carregando...</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground text-sm">
                Nenhuma avaliação ainda.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="border border-border rounded-xl p-3"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {review.customer_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(review.created_at)}
                      </p>
                    </div>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-3.5 h-3.5 ${
                            star <= review.rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-muted-foreground pl-9">
                      {review.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  );
};

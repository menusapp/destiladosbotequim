import { Star, ChevronRight, Clock, DollarSign } from "lucide-react";
import { Card } from "@/components/ui/card";

interface RestaurantInfoCardProps {
  name: string;
  logoUrl: string | null;
  distance?: string;
  minOrder?: number;
  rating?: number;
  reviewCount?: number;
  deliveryTime?: string;
  deliveryFee?: number;
  primaryColor?: string;
  tableInfo?: string; // "Mesa 12" ou null para delivery
}

export const RestaurantInfoCard = ({
  name,
  logoUrl,
  distance = "0.7 km",
  minOrder,
  rating = 4.8,
  reviewCount = 12,
  deliveryTime = "50-60 min",
  deliveryFee = 3.0,
  primaryColor = "#fe9516",
  tableInfo,
}: RestaurantInfoCardProps) => {
  return (
    <Card className="bg-white rounded-3xl shadow-lg overflow-hidden -mt-8 mx-4 relative z-10">
      <div className="p-4">
        {/* Logo */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2">
          {logoUrl ? (
            <div className="w-20 h-20 rounded-full bg-white shadow-lg overflow-hidden border-4 border-white">
              <img src={logoUrl} alt={name} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div 
              className="w-20 h-20 rounded-full shadow-lg border-4 border-white flex items-center justify-center text-white text-2xl font-bold"
              style={{ backgroundColor: primaryColor }}
            >
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Nome do Restaurante */}
        <div className="flex items-center justify-between mt-8">
          <h1 className="text-2xl font-bold text-foreground">{name}</h1>
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </div>

        {/* Informações */}
        {!tableInfo && (
          <p className="text-sm text-muted-foreground mt-1">
            {distance} • Min R$ {minOrder?.toFixed(2) || "17,00"}
          </p>
        )}

        {tableInfo && (
          <p className="text-sm font-medium mt-1" style={{ color: primaryColor }}>
            {tableInfo}
          </p>
        )}

        {/* Avaliação */}
        <button className="flex items-center gap-1.5 mt-3 hover:bg-accent/50 px-2 py-1 -ml-2 rounded-lg transition-colors">
          <Star className="w-4 h-4 fill-warning text-warning" />
          <span className="font-semibold text-foreground">{rating}</span>
          <span className="text-sm text-muted-foreground">({reviewCount} avaliações)</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground ml-1" />
        </button>

        {/* Tempo e Taxa */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
          {!tableInfo ? (
            <>
              <span className="text-sm font-medium text-foreground">Padrão</span>
              <span className="text-xs text-muted-foreground">
                {deliveryTime} • R$ {deliveryFee.toFixed(2)}
              </span>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">
              <Clock className="w-4 h-4 inline mr-1" />
              Tempo estimado: {deliveryTime}
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          {tableInfo ? "Faça seu pedido pelo cardápio" : "Mais opções disponíveis na sacola"}
        </p>
      </div>
    </Card>
  );
};

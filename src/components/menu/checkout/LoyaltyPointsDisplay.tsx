import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Gift } from "lucide-react";
import { toast } from "@/components/ui/sonner";

interface LoyaltyPointsDisplayProps {
  points: number;
  pointsUsed: number;
  realPerPoint: number;
  onRedeem: (points: number) => void;
  primaryColor: string;
}

export const LoyaltyPointsDisplay = ({
  points,
  pointsUsed,
  realPerPoint,
  onRedeem,
  primaryColor,
}: LoyaltyPointsDisplayProps) => {
  const [inputPoints, setInputPoints] = useState("");

  const availablePoints = points - pointsUsed;
  const maxDiscount = availablePoints * realPerPoint;
  const currentDiscount = pointsUsed * realPerPoint;

  const handleUsePoints = () => {
    const value = parseInt(inputPoints);

    if (!value || value <= 0) {
      toast.error("Digite uma quantidade válida");
      return;
    }

    if (value > availablePoints) {
      toast.error(`Você tem apenas ${availablePoints} pontos disponíveis`);
      return;
    }

    onRedeem(pointsUsed + value);
    setInputPoints("");
    toast.success(`${value} pontos aplicados!`);
  };

  const handleRemovePoints = () => {
    onRedeem(0);
    toast.success("Pontos removidos");
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5" style={{ color: primaryColor }} />
            <span className="font-medium">Pontos de Fidelidade</span>
          </div>
          <span className="text-lg font-bold" style={{ color: primaryColor }}>
            {availablePoints} pontos
          </span>
        </div>

        {points === 0 && (
          <p className="text-sm text-muted-foreground">
            Você ainda não tem pontos. Faça pedidos para acumular!
          </p>
        )}

        {points > 0 && pointsUsed === 0 && (
          <>
            <p className="text-sm text-muted-foreground mb-3">
              Use seus pontos! {availablePoints} pontos = R$ {maxDiscount.toFixed(2)} de desconto
            </p>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="number"
                  placeholder="Quantos pontos?"
                  value={inputPoints}
                  onChange={(e) => setInputPoints(e.target.value)}
                  max={availablePoints}
                  min={1}
                />
              </div>
              <Button
                onClick={handleUsePoints}
                disabled={!inputPoints}
                style={{ backgroundColor: primaryColor, color: "white" }}
              >
                Usar
              </Button>
            </div>
          </>
        )}

        {pointsUsed > 0 && (
          <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                {pointsUsed} pontos aplicados
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemovePoints}
                className="h-7 text-xs"
              >
                Remover
              </Button>
            </div>
            <p className="text-sm text-green-600 dark:text-green-400">
              Desconto: R$ {currentDiscount.toFixed(2)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, UtensilsCrossed, ShoppingBag } from "lucide-react";
import { KioskConfig } from "@/hooks/useKioskConfig";

interface Props {
  primaryColor: string;
  consumptionType: "dine_in" | "takeaway";
  tableNumber: string;
  onChangeType: (t: "dine_in" | "takeaway") => void;
  onChangeTable: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  kioskConfig?: KioskConfig | null;
}

export function KioskConsumptionType({ primaryColor, consumptionType, tableNumber, onChangeType, onChangeTable, onBack, onNext, kioskConfig }: Props) {
  const options: { key: "dine_in" | "takeaway"; label: string; icon: any; configKey: keyof KioskConfig }[] = [
    { key: "dine_in", label: "Comer no local", icon: UtensilsCrossed, configKey: "order_dine_in" },
    { key: "takeaway", label: "Para viagem", icon: ShoppingBag, configKey: "order_takeaway" },
  ];

  const filteredOptions = kioskConfig
    ? options.filter(o => kioskConfig[o.configKey] !== false)
    : options;

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-4 p-6 border-b bg-card">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-14 w-14 rounded-full">
          <ArrowLeft className="h-8 w-8" />
        </Button>
        <h2 className="text-2xl font-bold text-foreground">Como deseja consumir?</h2>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 gap-8 max-w-lg mx-auto w-full">
        {filteredOptions.map(opt => (
          <button
            key={opt.key}
            onClick={() => onChangeType(opt.key)}
            className={`w-full p-8 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all ${
              consumptionType === opt.key ? "border-2 shadow-lg" : "border-muted hover:border-muted-foreground/30"
            }`}
            style={consumptionType === opt.key ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` } : {}}
          >
            <opt.icon className="h-16 w-16" style={{ color: consumptionType === opt.key ? primaryColor : undefined }} />
            <span className="text-2xl font-bold text-foreground">{opt.label}</span>
          </button>
        ))}

        {consumptionType === "dine_in" && (
          <div className="w-full space-y-2">
            <Label className="text-lg">Número da mesa (opcional)</Label>
            <Input
              value={tableNumber}
              onChange={(e) => onChangeTable(e.target.value.replace(/\D/g, ""))}
              placeholder="Ex: 5"
              className="text-2xl h-16 text-center"
              inputMode="numeric"
              maxLength={3}
            />
          </div>
        )}
      </div>

      <div className="border-t bg-card p-6">
        <div className="max-w-lg mx-auto">
          <Button onClick={onNext} className="w-full h-16 text-xl font-bold rounded-xl text-white" style={{ backgroundColor: primaryColor }}>
            Ir para Pagamento
          </Button>
        </div>
      </div>
    </div>
  );
}

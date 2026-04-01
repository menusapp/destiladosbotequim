import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, UtensilsCrossed, ShoppingBag, Truck, Store, ChefHat } from "lucide-react";
import { KioskConfig } from "@/hooks/useKioskConfig";

export type ConsumptionMode = "counter" | "table" | "takeaway" | "delivery";

interface Props {
  primaryColor: string;
  consumptionMode: ConsumptionMode;
  tableNumber: string;
  onChangeMode: (m: ConsumptionMode) => void;
  onChangeTable: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  kioskConfig?: KioskConfig | null;
}

export function KioskConsumptionType({ primaryColor, consumptionMode, tableNumber, onChangeMode, onChangeTable, onBack, onNext, kioskConfig }: Props) {
  const [subStep, setSubStep] = useState<"main" | "dine_in_sub">("main");

  const mainOptions = [
    { key: "dine_in" as const, label: "Comer no local", icon: UtensilsCrossed, configKey: "order_dine_in" as keyof KioskConfig },
    { key: "takeaway" as const, label: "Para viagem", icon: ShoppingBag, configKey: "order_takeaway" as keyof KioskConfig },
    { key: "delivery" as const, label: "Entrega", icon: Truck, configKey: "order_delivery" as keyof KioskConfig },
  ];

  const filteredMain = kioskConfig
    ? mainOptions.filter(o => kioskConfig[o.configKey] !== false)
    : mainOptions;

  const dineInSubOptions = [
    { key: "counter" as const, label: "Retirar no balcão", description: "Você será avisado quando estiver pronto", icon: Store },
    { key: "table" as const, label: "Levar na mesa", description: "Informe o número da sua mesa", icon: ChefHat },
  ];

  const canProceed = () => {
    if (subStep === "main") {
      // For main-level selections (takeaway, delivery), mode must be set
      return consumptionMode === "takeaway" || consumptionMode === "delivery";
    }
    // For dine-in sub, mode must be selected and table number required if table
    if (consumptionMode === "table" && !tableNumber.trim()) return false;
    return consumptionMode === "counter" || consumptionMode === "table";
  };

  const handleMainSelect = (key: string) => {
    if (key === "dine_in") {
      setSubStep("dine_in_sub");
      return;
    }
    onChangeMode(key as ConsumptionMode);
  };

  const handleSubSelect = (key: ConsumptionMode) => {
    onChangeMode(key);
  };

  const handleBack = () => {
    if (subStep === "dine_in_sub") {
      setSubStep("main");
      return;
    }
    onBack();
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex items-center gap-4 p-5 border-b bg-card shrink-0">
        <Button variant="ghost" size="icon" onClick={handleBack} className="h-12 w-12 rounded-full">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h2 className="text-xl font-bold text-foreground">
          {subStep === "dine_in_sub" ? "Comer no local" : "Como deseja consumir?"}
        </h2>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5 max-w-lg mx-auto w-full">
        {subStep === "main" && filteredMain.map(opt => {
          const isSelected = (opt.key === "dine_in" && (consumptionMode === "counter" || consumptionMode === "table"))
            || (opt.key === "takeaway" && consumptionMode === "takeaway")
            || (opt.key === "delivery" && consumptionMode === "delivery");

          return (
            <button
              key={opt.key}
              onClick={() => handleMainSelect(opt.key)}
              className={`w-full p-6 rounded-2xl border-2 flex items-center gap-5 transition-all ${
                isSelected ? "shadow-lg" : "border-muted hover:border-muted-foreground/30 hover:shadow-md"
              }`}
              style={isSelected ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` } : {}}
            >
              <div className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: isSelected ? primaryColor : undefined }}>
                <opt.icon className="h-7 w-7" style={{ color: isSelected ? "#fff" : undefined }} />
              </div>
              <span className="text-xl font-bold text-foreground">{opt.label}</span>
            </button>
          );
        })}

        {subStep === "dine_in_sub" && dineInSubOptions.map(opt => (
          <button
            key={opt.key}
            onClick={() => handleSubSelect(opt.key)}
            className={`w-full p-6 rounded-2xl border-2 flex items-center gap-5 transition-all ${
              consumptionMode === opt.key ? "shadow-lg" : "border-muted hover:border-muted-foreground/30 hover:shadow-md"
            }`}
            style={consumptionMode === opt.key ? { borderColor: primaryColor, backgroundColor: `${primaryColor}10` } : {}}
          >
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: consumptionMode === opt.key ? primaryColor : undefined }}>
              <opt.icon className="h-7 w-7" style={{ color: consumptionMode === opt.key ? "#fff" : undefined }} />
            </div>
            <div className="text-left">
              <span className="text-xl font-bold text-foreground block">{opt.label}</span>
              <span className="text-sm text-muted-foreground">{opt.description}</span>
            </div>
          </button>
        ))}

        {consumptionMode === "table" && subStep === "dine_in_sub" && (
          <div className="w-full space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <Label className="text-lg font-semibold">Número da mesa *</Label>
            <Input
              value={tableNumber}
              onChange={(e) => onChangeTable(e.target.value.replace(/\D/g, ""))}
              placeholder="Ex: 5"
              className="text-2xl h-16 text-center rounded-xl"
              inputMode="numeric"
              maxLength={3}
              autoFocus
            />
          </div>
        )}

        {consumptionMode === "counter" && subStep === "dine_in_sub" && (
          <div className="w-full p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800 animate-in fade-in slide-in-from-top-2 duration-200">
            <p className="text-sm text-blue-700 dark:text-blue-300 text-center">
              📱 Você será avisado por WhatsApp quando seu pedido estiver pronto para retirada.
            </p>
          </div>
        )}
      </div>

      <div className="border-t bg-card p-5 shrink-0">
        <div className="max-w-lg mx-auto">
          <Button
            onClick={onNext}
            className="w-full h-14 text-lg font-bold rounded-xl text-white"
            style={{ backgroundColor: primaryColor }}
            disabled={!canProceed()}
          >
            Continuar
          </Button>
        </div>
      </div>
    </div>
  );
}

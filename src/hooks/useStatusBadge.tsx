import { Badge } from "@/components/ui/badge";
import { Clock, Check } from "lucide-react";

export const useStatusBadge = () => {
  const getOrderStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "Pendente", variant: "secondary" as const, icon: Clock },
      accepted: { label: "Aceito", variant: "default" as const, icon: Check },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getBillStatusBadge = (status: string) => {
    const variants = {
      paid: { label: "Paga", variant: "default" as const },
      on_the_way: { label: "A Caminho", variant: "outline" as const },
      requested: { label: "Pendente", variant: "secondary" as const },
    };

    const config = variants[status as keyof typeof variants] || variants.requested;
    const Icon = status === "paid" || status === "on_the_way" ? Check : Clock;

    return (
      <Badge variant={config.variant}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  return { getOrderStatusBadge, getBillStatusBadge };
};

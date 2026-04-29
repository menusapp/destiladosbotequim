import { useMemo, useState } from "react";
import { TrendingUp, ArrowRight } from "lucide-react";

interface SavingsSimulatorProps {
  primaryColor?: string;
  primaryColorEnd?: string;
  registerUrl: string;
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export default function SavingsSimulator({
  primaryColor = "#F97316",
  primaryColorEnd = "#FB923C",
  registerUrl,
}: SavingsSimulatorProps) {
  const [orders, setOrders] = useState(80);
  const [ticket, setTicket] = useState(75);

  const { current, withMenus, gain } = useMemo(() => {
    const monthly = orders * ticket * 30;
    const uplift = monthly * 0.32; // 32% uplift estimate
    return { current: monthly, withMenus: monthly + uplift, gain: uplift };
  }, [orders, ticket]);

  const ordersPct = ((orders - 5) / (150 - 5)) * 100;
  const ticketPct = ((ticket - 15) / (150 - 15)) * 100;
  const gradient = `linear-gradient(135deg, ${primaryColor}, ${primaryColorEnd})`;

  return (
    <div className="grid md:grid-cols-2 rounded-2xl overflow-hidden border border-[#E2E8F0] bg-white shadow-xl">
      {/* Left: inputs */}
      <div className="space-y-8 p-6 md:p-8">
        <div>
          <h3 className="text-base font-semibold text-[#0F172A]">Seu negócio hoje</h3>
          <p className="mt-0.5 text-sm text-[#64748B]">Ajuste os valores para o seu contexto.</p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-[#64748B]">Pedidos por dia</span>
            <span className="text-sm font-bold text-[#0F172A]">{orders} pedidos</span>
          </div>
          <div className="relative h-2 w-full rounded-full bg-[#F1F5F9]">
            <div
              className="absolute left-0 top-0 h-2 rounded-full"
              style={{ width: `${ordersPct}%`, background: gradient }}
            />
            <input
              type="range"
              min={5}
              max={150}
              step={1}
              value={orders}
              onChange={(e) => setOrders(Number(e.target.value))}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <div
              className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 bg-white shadow pointer-events-none"
              style={{ left: `calc(${ordersPct}% - 8px)`, borderColor: primaryColor }}
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-[#64748B]">Ticket médio</span>
            <span className="text-sm font-bold text-[#0F172A]">R${ticket}</span>
          </div>
          <div className="relative h-2 w-full rounded-full bg-[#F1F5F9]">
            <div
              className="absolute left-0 top-0 h-2 rounded-full"
              style={{ width: `${ticketPct}%`, background: gradient }}
            />
            <input
              type="range"
              min={15}
              max={150}
              step={5}
              value={ticket}
              onChange={(e) => setTicket(Number(e.target.value))}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <div
              className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 bg-white shadow pointer-events-none"
              style={{ left: `calc(${ticketPct}% - 8px)`, borderColor: primaryColor }}
            />
          </div>
        </div>

        <div className="rounded-xl bg-[#F5F5F0] p-4">
          <p className="text-xs text-[#64748B]">Receita mensal atual estimada</p>
          <p className="mt-1 text-2xl font-bold text-[#0F172A]">{fmtBRL(current)}</p>
        </div>
      </div>

      {/* Right: result */}
      <div
        className="flex flex-col items-center justify-center gap-6 p-6 md:p-8 text-white"
        style={{ background: gradient }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
          <TrendingUp className="h-7 w-7 text-white" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-white/80">Ganho potencial por mês</p>
          <p className="mt-1 text-4xl font-extrabold tracking-tight">+{fmtBRL(gain)}</p>
          <p className="mt-2 text-sm text-white/80">com cardápio digital e robô IA</p>
        </div>
        <div className="w-full space-y-2 rounded-xl bg-white/15 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-white/85">Receita atual</span>
            <span className="font-semibold">{fmtBRL(current)}</span>
          </div>
          <div className="flex justify-between border-t border-white/20 pt-2">
            <span className="text-white/85">Com Menu's</span>
            <span className="font-bold">{fmtBRL(withMenus)}</span>
          </div>
        </div>
        <a
          href={registerUrl}
          className="inline-flex items-center justify-center gap-2 h-11 rounded-md px-8 w-full bg-white hover:bg-white/95 font-semibold shadow-lg transition-all active:scale-[0.97]"
          style={{ color: primaryColor }}
        >
          Quero esse resultado <ArrowRight className="h-4 w-4" />
        </a>
        <p className="text-center text-xs text-white/75">7 dias grátis · sem cartão de crédito</p>
      </div>
    </div>
  );
}

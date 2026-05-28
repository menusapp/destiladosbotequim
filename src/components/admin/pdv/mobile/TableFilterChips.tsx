import { cn } from "@/lib/utils";

export type TableFilter = "all" | "occupied" | "free" | "pending";

interface TableFilterChipsProps {
  value: TableFilter;
  onChange: (v: TableFilter) => void;
  counts: {
    all: number;
    occupied: number;
    free: number;
    pending: number;
  };
}

const chips: { id: TableFilter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "occupied", label: "Ocupadas" },
  { id: "free", label: "Livres" },
  { id: "pending", label: "Pendentes" },
];

export function TableFilterChips({ value, onChange, counts }: TableFilterChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
      {chips.map((c) => {
        const active = value === c.id;
        const count = counts[c.id];
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className={cn(
              "flex-shrink-0 h-9 px-3.5 rounded-full text-xs font-semibold border transition-all flex items-center gap-1.5",
              active
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-background text-foreground border-border hover:bg-muted active:scale-95"
            )}
          >
            <span>{c.label}</span>
            <span
              className={cn(
                "px-1.5 min-w-[1.25rem] h-5 rounded-full text-[10px] font-bold flex items-center justify-center",
                active ? "bg-primary-foreground/20" : "bg-muted"
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

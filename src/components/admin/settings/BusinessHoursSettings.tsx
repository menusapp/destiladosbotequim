import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Save } from "lucide-react";

interface DayHours {
  id?: string;
  day_of_week: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
}

const DAYS_SHORT = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

const BusinessHoursSettings = ({ restaurantId }: { restaurantId: string }) => {
  const [hours, setHours] = useState<DayHours[]>([]);
  const [autoOpenClose, setAutoOpenClose] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchHours();
  }, [restaurantId]);

  const fetchHours = async () => {
    try {
      const { data: restaurantData } = await supabase
        .from("restaurants")
        .select("auto_open_close")
        .eq("id", restaurantId)
        .maybeSingle();

      setAutoOpenClose(restaurantData?.auto_open_close ?? false);

      const { data, error } = await supabase
        .from("business_hours")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("day_of_week");

      if (error) throw error;

      const allDays: DayHours[] = DAYS_SHORT.map(day => {
        const existing = data?.find(d => d.day_of_week === day.value);
        if (existing) {
          return {
            id: existing.id,
            day_of_week: existing.day_of_week,
            is_open: existing.is_open,
            open_time: existing.open_time || "08:00",
            close_time: existing.close_time || "22:00",
          };
        }
        return {
          day_of_week: day.value,
          is_open: day.value !== 0,
          open_time: "08:00",
          close_time: "22:00",
        };
      });

      setHours(allDays);
    } catch (error) {
      toast.error("Erro ao carregar horários");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDayChange = (dayIndex: number, field: keyof DayHours, value: any) => {
    setHours(prev => prev.map(h => 
      h.day_of_week === dayIndex ? { ...h, [field]: value } : h
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase
        .from("restaurants")
        .update({ auto_open_close: autoOpenClose })
        .eq("id", restaurantId);

      for (const day of hours) {
        if (day.id) {
          await supabase
            .from("business_hours")
            .update({
              is_open: day.is_open,
              open_time: day.open_time,
              close_time: day.close_time,
            })
            .eq("id", day.id);
        } else {
          await supabase
            .from("business_hours")
            .insert({
              restaurant_id: restaurantId,
              day_of_week: day.day_of_week,
              is_open: day.is_open,
              open_time: day.open_time,
              close_time: day.close_time,
            });
        }
      }

      toast.success("Horários salvos!");
      await fetchHours();
    } catch (error) {
      toast.error("Erro ao salvar horários");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Carregando horários...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with auto toggle and save */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.025em]">Horário de Funcionamento</h2>
          <p className="text-muted-foreground font-light text-sm">Configure os horários de abertura e fechamento</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <Label htmlFor="auto-toggle" className="text-xs font-medium cursor-pointer whitespace-nowrap">Auto abrir/fechar</Label>
            <Switch
              id="auto-toggle"
              checked={autoOpenClose}
              onCheckedChange={setAutoOpenClose}
            />
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {/* Compact table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[auto_60px_1fr] items-center gap-0 text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-2 border-b">
          <span className="w-12">Dia</span>
          <span className="text-center">Aberto</span>
          <span className="text-center">Horário</span>
        </div>
        {hours.map((day) => (
          <div 
            key={day.day_of_week} 
            className={`grid grid-cols-[auto_60px_1fr] items-center gap-0 px-3 py-2 border-b last:border-b-0 transition-colors ${
              !day.is_open ? "bg-muted/30" : ""
            }`}
          >
            <span className="w-12 text-sm font-medium">
              {DAYS_SHORT.find(d => d.value === day.day_of_week)?.label}
            </span>
            <div className="flex justify-center">
              <Switch
                checked={day.is_open}
                onCheckedChange={(checked) => handleDayChange(day.day_of_week, "is_open", checked)}
              />
            </div>
            <div className="flex items-center justify-center gap-2">
              {day.is_open ? (
                <>
                  <Input
                    type="time"
                    value={day.open_time}
                    onChange={(e) => handleDayChange(day.day_of_week, "open_time", e.target.value)}
                    className="w-24 h-8 text-xs"
                  />
                  <span className="text-xs text-muted-foreground">às</span>
                  <Input
                    type="time"
                    value={day.close_time}
                    onChange={(e) => handleDayChange(day.day_of_week, "close_time", e.target.value)}
                    className="w-24 h-8 text-xs"
                  />
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Fechado</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BusinessHoursSettings;

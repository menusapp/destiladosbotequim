import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
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

const ReservationHoursSettings = ({ restaurantId }: { restaurantId: string }) => {
  const [hours, setHours] = useState<DayHours[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchHours();
  }, [restaurantId]);

  const fetchHours = async () => {
    try {
      const { data, error } = await supabase
        .from("reservation_hours")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("day_of_week");

      if (error) throw error;

      const allDays: DayHours[] = DAYS_SHORT.map(day => {
        const existing = data?.find((d: any) => d.day_of_week === day.value);
        if (existing) {
          return {
            id: existing.id,
            day_of_week: existing.day_of_week,
            is_open: existing.is_open ?? true,
            open_time: existing.open_time || "11:00",
            close_time: existing.close_time || "22:00",
          };
        }
        return {
          day_of_week: day.value,
          is_open: day.value !== 0,
          open_time: "11:00",
          close_time: "22:00",
        };
      });

      setHours(allDays);
    } catch (error) {
      toast.error("Erro ao carregar horários de reserva");
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
      for (const day of hours) {
        if (day.id) {
          await supabase
            .from("reservation_hours")
            .update({
              is_open: day.is_open,
              open_time: day.open_time,
              close_time: day.close_time,
            })
            .eq("id", day.id);
        } else {
          await supabase
            .from("reservation_hours")
            .insert({
              restaurant_id: restaurantId,
              day_of_week: day.day_of_week,
              is_open: day.is_open,
              open_time: day.open_time,
              close_time: day.close_time,
            });
        }
      }

      toast.success("Horários de reserva salvos!");
      await fetchHours();
    } catch (error) {
      toast.error("Erro ao salvar horários de reserva");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4">Carregando horários...</p>;
  }

  return (
    <div className="pt-4 border-t space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <div>
            <Label className="font-medium">Horários Específicos para Reservas</Label>
            <p className="text-xs text-muted-foreground">
              Configure os dias e horários em que as reservas estarão disponíveis
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          <Save className="h-3.5 w-3.5" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      {/* Compact table — same layout as BusinessHoursSettings */}
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
                <span className="text-xs text-muted-foreground">Sem reservas</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReservationHoursSettings;

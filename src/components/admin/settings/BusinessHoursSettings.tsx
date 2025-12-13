import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Calendar } from "lucide-react";

interface DayHours {
  id?: string;
  day_of_week: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
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
      // Fetch restaurant auto_open_close setting
      const { data: restaurantData } = await supabase
        .from("restaurants")
        .select("auto_open_close")
        .eq("id", restaurantId)
        .maybeSingle();

      setAutoOpenClose(restaurantData?.auto_open_close ?? false);

      // Fetch business hours
      const { data, error } = await supabase
        .from("business_hours")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("day_of_week");

      if (error) throw error;

      // Initialize all days if not present
      const existingDays = new Set(data?.map(d => d.day_of_week) || []);
      const allDays: DayHours[] = DAYS_OF_WEEK.map(day => {
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
          is_open: day.value !== 0, // Fechado aos domingos por padrão
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
      // Update auto_open_close setting
      await supabase
        .from("restaurants")
        .update({ auto_open_close: autoOpenClose })
        .eq("id", restaurantId);

      // Upsert all hours
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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Horário de Funcionamento</h2>
        <p className="text-muted-foreground">Configure os horários de abertura e fechamento automático</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Abertura/Fechamento Automático
          </CardTitle>
          <CardDescription>
            Quando ativado, o restaurante abrirá e fechará automaticamente nos horários configurados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto-open-close" className="font-medium">Ativar automação</Label>
              <p className="text-sm text-muted-foreground">
                O cardápio será aberto/fechado automaticamente
              </p>
            </div>
            <Switch
              id="auto-open-close"
              checked={autoOpenClose}
              onCheckedChange={setAutoOpenClose}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Horários por Dia
          </CardTitle>
          <CardDescription>
            Configure o horário de funcionamento para cada dia da semana
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hours.map((day) => (
            <div 
              key={day.day_of_week} 
              className={`flex items-center justify-between p-4 rounded-lg border ${
                day.is_open ? "bg-background" : "bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-4 flex-1">
                <Switch
                  checked={day.is_open}
                  onCheckedChange={(checked) => handleDayChange(day.day_of_week, "is_open", checked)}
                />
                <span className="font-medium w-32">
                  {DAYS_OF_WEEK.find(d => d.value === day.day_of_week)?.label}
                </span>
              </div>

              {day.is_open && (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={day.open_time}
                    onChange={(e) => handleDayChange(day.day_of_week, "open_time", e.target.value)}
                    className="w-28"
                  />
                  <span className="text-muted-foreground">às</span>
                  <Input
                    type="time"
                    value={day.close_time}
                    onChange={(e) => handleDayChange(day.day_of_week, "close_time", e.target.value)}
                    className="w-28"
                  />
                </div>
              )}

              {!day.is_open && (
                <span className="text-muted-foreground">Fechado</span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? "Salvando..." : "Salvar Horários"}
      </Button>
    </div>
  );
};

export default BusinessHoursSettings;

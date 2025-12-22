import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Plus, Trash2, Edit, CircleDot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import RadiusMapPicker from "./RadiusMapPicker";

interface DeliveryZone {
  id: string;
  zone_name: string;
  zip_codes: string[];
  neighborhoods: string[];
  delivery_fee: number;
  min_order_value: number;
  estimated_time_minutes: number;
  is_active: boolean;
  zone_type: "zip_codes" | "radius";
  center_lat: number | null;
  center_lng: number | null;
  radius_km: number | null;
}

const DeliveryZonesSettings = ({ restaurantId }: { restaurantId: string }) => {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  
  // Form state
  const [zoneName, setZoneName] = useState("");
  const [zoneType, setZoneType] = useState<"zip_codes" | "radius">("zip_codes");
  const [zipCodesInput, setZipCodesInput] = useState("");
  const [neighborhoodsInput, setNeighborhoodsInput] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [minOrderValue, setMinOrderValue] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(30);
  
  // Radius zone state
  const [centerLat, setCenterLat] = useState<number | null>(null);
  const [centerLng, setCenterLng] = useState<number | null>(null);
  const [radiusKm, setRadiusKm] = useState(5);

  useEffect(() => {
    fetchZones();
  }, [restaurantId]);

  const fetchZones = async () => {
    try {
      const { data, error } = await supabase
        .from("delivery_zones")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("zone_name");

      if (error) throw error;
      setZones((data || []).map(z => ({
        ...z,
        zone_type: (z.zone_type === "radius" ? "radius" : "zip_codes") as "zip_codes" | "radius",
      })));
    } catch (error) {
      toast.error("Erro ao carregar regiões");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setZoneName("");
    setZoneType("zip_codes");
    setZipCodesInput("");
    setNeighborhoodsInput("");
    setDeliveryFee(0);
    setMinOrderValue(0);
    setEstimatedTime(30);
    setCenterLat(null);
    setCenterLng(null);
    setRadiusKm(5);
    setEditingZone(null);
  };

  const openEditDialog = (zone: DeliveryZone) => {
    setEditingZone(zone);
    setZoneName(zone.zone_name);
    setZoneType(zone.zone_type || "zip_codes");
    setZipCodesInput(zone.zip_codes?.join(", ") || "");
    setNeighborhoodsInput(zone.neighborhoods?.join(", ") || "");
    setDeliveryFee(zone.delivery_fee);
    setMinOrderValue(zone.min_order_value);
    setEstimatedTime(zone.estimated_time_minutes);
    setCenterLat(zone.center_lat);
    setCenterLng(zone.center_lng);
    setRadiusKm(zone.radius_km || 5);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!zoneName.trim()) {
      toast.error("Digite o nome da região");
      return;
    }

    if (zoneType === "zip_codes") {
      const zipCodes = zipCodesInput.split(",").map(z => z.trim()).filter(Boolean);
      const neighborhoods = neighborhoodsInput.split(",").map(n => n.trim()).filter(Boolean);

      if (zipCodes.length === 0 && neighborhoods.length === 0) {
        toast.error("Adicione pelo menos um CEP ou bairro");
        return;
      }
    } else {
      if (!centerLat || !centerLng) {
        toast.error("Clique no mapa para definir o ponto central");
        return;
      }
    }

    const zipCodes = zipCodesInput.split(",").map(z => z.trim()).filter(Boolean);
    const neighborhoods = neighborhoodsInput.split(",").map(n => n.trim()).filter(Boolean);

    try {
      const zoneData = {
        zone_name: zoneName,
        zone_type: zoneType,
        zip_codes: zoneType === "zip_codes" ? zipCodes : [],
        neighborhoods: zoneType === "zip_codes" ? neighborhoods : [],
        delivery_fee: deliveryFee,
        min_order_value: minOrderValue,
        estimated_time_minutes: estimatedTime,
        center_lat: zoneType === "radius" ? centerLat : null,
        center_lng: zoneType === "radius" ? centerLng : null,
        radius_km: zoneType === "radius" ? radiusKm : null,
      };

      if (editingZone) {
        const { error } = await supabase
          .from("delivery_zones")
          .update(zoneData)
          .eq("id", editingZone.id);

        if (error) throw error;
        toast.success("Região atualizada!");
      } else {
        const { error } = await supabase
          .from("delivery_zones")
          .insert({
            restaurant_id: restaurantId,
            ...zoneData,
          });

        if (error) throw error;
        toast.success("Região criada!");
      }

      setDialogOpen(false);
      resetForm();
      await fetchZones();
    } catch (error) {
      toast.error("Erro ao salvar região");
      console.error(error);
    }
  };

  const handleDelete = async (zoneId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta região?")) return;

    try {
      const { error } = await supabase
        .from("delivery_zones")
        .delete()
        .eq("id", zoneId);

      if (error) throw error;
      toast.success("Região excluída!");
      await fetchZones();
    } catch (error) {
      toast.error("Erro ao excluir região");
      console.error(error);
    }
  };

  const toggleActive = async (zone: DeliveryZone) => {
    try {
      const { error } = await supabase
        .from("delivery_zones")
        .update({ is_active: !zone.is_active })
        .eq("id", zone.id);

      if (error) throw error;
      await fetchZones();
    } catch (error) {
      toast.error("Erro ao atualizar região");
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Carregando regiões...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Regiões de Entrega</h2>
          <p className="text-muted-foreground">Configure as regiões atendidas e taxas de entrega</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Região
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingZone ? "Editar Região" : "Nova Região de Entrega"}</DialogTitle>
              <DialogDescription>
                Configure a área de cobertura e taxas desta região
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="zone-name">Nome da Região</Label>
                <Input
                  id="zone-name"
                  placeholder="Ex: Centro, Zona Sul"
                  value={zoneName}
                  onChange={(e) => setZoneName(e.target.value)}
                />
              </div>

              {/* Zone Type Selector */}
              <div className="space-y-3">
                <Label>Tipo de Zona</Label>
                <RadioGroup
                  value={zoneType}
                  onValueChange={(v) => setZoneType(v as "zip_codes" | "radius")}
                  className="grid grid-cols-2 gap-4"
                >
                  <div>
                    <RadioGroupItem
                      value="zip_codes"
                      id="zone-type-zip"
                      className="peer sr-only"
                    />
                    <Label
                      htmlFor="zone-type-zip"
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                    >
                      <MapPin className="mb-2 h-6 w-6" />
                      <span className="text-sm font-medium">CEP/Bairro</span>
                    </Label>
                  </div>
                  <div className="relative">
                    <RadioGroupItem
                      value="radius"
                      id="zone-type-radius"
                      className="peer sr-only"
                      disabled
                    />
                    <Label
                      htmlFor="zone-type-radius"
                      className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-muted/50 p-4 cursor-not-allowed opacity-60"
                    >
                      <CircleDot className="mb-2 h-6 w-6 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">Raio no Mapa</span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded mt-1">Em breve</span>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* CEP/Neighborhood fields */}
              {zoneType === "zip_codes" && (
                <>
                  <div>
                    <Label htmlFor="zip-codes">CEPs (separados por vírgula)</Label>
                    <Input
                      id="zip-codes"
                      placeholder="01310-100, 01311-000, 01312-000"
                      value={zipCodesInput}
                      onChange={(e) => setZipCodesInput(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Use prefixos como "17470" para aceitar todos CEPs que começam com esse número
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="neighborhoods">Bairros (separados por vírgula)</Label>
                    <Input
                      id="neighborhoods"
                      placeholder="Centro, Consolação, Bela Vista"
                      value={neighborhoodsInput}
                      onChange={(e) => setNeighborhoodsInput(e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* Radius map picker */}
              {zoneType === "radius" && (
                <RadiusMapPicker
                  centerLat={centerLat}
                  centerLng={centerLng}
                  radiusKm={radiusKm}
                  onCenterChange={(lat, lng) => {
                    setCenterLat(lat);
                    setCenterLng(lng);
                  }}
                  onRadiusChange={setRadiusKm}
                />
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="delivery-fee">Taxa de Entrega (R$)</Label>
                  <Input
                    id="delivery-fee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="min-order">Pedido Mínimo (R$)</Label>
                  <Input
                    id="min-order"
                    type="number"
                    min="0"
                    step="0.01"
                    value={minOrderValue}
                    onChange={(e) => setMinOrderValue(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="estimated-time">Tempo Estimado (minutos)</Label>
                <Input
                  id="estimated-time"
                  type="number"
                  min="1"
                  value={estimatedTime}
                  onChange={(e) => setEstimatedTime(parseInt(e.target.value) || 30)}
                />
              </div>

              <Button onClick={handleSave} className="w-full">
                {editingZone ? "Atualizar Região" : "Criar Região"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {zones.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma região cadastrada</h3>
            <p className="text-muted-foreground mb-4">
              Adicione regiões de entrega para definir taxas e áreas atendidas
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {zones.map((zone) => (
            <Card key={zone.id} className={!zone.is_active ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{zone.zone_name}</h3>
                      <Badge variant="outline" className="text-xs">
                        {zone.zone_type === "radius" ? (
                          <><CircleDot className="h-3 w-3 mr-1" /> Raio</>
                        ) : (
                          <><MapPin className="h-3 w-3 mr-1" /> CEP</>
                        )}
                      </Badge>
                      {!zone.is_active && (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </div>
                    
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {zone.zone_type === "radius" ? (
                        <p>
                          <span className="font-medium">Raio:</span>{" "}
                          {zone.radius_km} km
                        </p>
                      ) : (
                        <>
                          {zone.neighborhoods?.length > 0 && (
                            <p>
                              <span className="font-medium">Bairros:</span>{" "}
                              {zone.neighborhoods.join(", ")}
                            </p>
                          )}
                          {zone.zip_codes?.length > 0 && (
                            <p>
                              <span className="font-medium">CEPs:</span>{" "}
                              {zone.zip_codes.join(", ")}
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex gap-4 mt-3 text-sm">
                      <span>
                        <span className="font-medium">Taxa:</span>{" "}
                        R$ {zone.delivery_fee.toFixed(2)}
                      </span>
                      <span>
                        <span className="font-medium">Mínimo:</span>{" "}
                        R$ {zone.min_order_value.toFixed(2)}
                      </span>
                      <span>
                        <span className="font-medium">Tempo:</span>{" "}
                        {zone.estimated_time_minutes} min
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={zone.is_active}
                      onCheckedChange={() => toggleActive(zone)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(zone)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(zone.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DeliveryZonesSettings;

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Circle, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Search, MapPin } from "lucide-react";

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface RadiusMapPickerProps {
  centerLat: number | null;
  centerLng: number | null;
  radiusKm: number;
  onCenterChange: (lat: number, lng: number) => void;
  onRadiusChange: (km: number) => void;
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapCenterUpdater({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng) {
      map.setView([lat, lng], map.getZoom());
    }
  }, [lat, lng, map]);
  return null;
}

const RadiusMapPicker = ({
  centerLat,
  centerLng,
  radiusKm,
  onCenterChange,
  onRadiusChange,
}: RadiusMapPickerProps) => {
  const [searchAddress, setSearchAddress] = useState("");
  const [searching, setSearching] = useState(false);

  // Default center: São Paulo, Brazil
  const defaultLat = centerLat || -23.5505;
  const defaultLng = centerLng || -46.6333;

  const handleSearch = async () => {
    if (!searchAddress.trim()) return;

    setSearching(true);
    try {
      // Use Nominatim (OpenStreetMap) for geocoding - free, no API key required
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchAddress + ", Brasil"
        )}&limit=1`,
        {
          headers: {
            "Accept-Language": "pt-BR",
          },
        }
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        onCenterChange(parseFloat(lat), parseFloat(lon));
      } else {
        console.warn("Endereço não encontrado");
      }
    } catch (error) {
      console.error("Erro ao buscar endereço:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    onCenterChange(lat, lng);
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            placeholder="Buscar endereço (ex: Av. Paulista, São Paulo)"
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleSearch}
          disabled={searching}
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* Map */}
      <div className="h-[300px] rounded-lg overflow-hidden border">
        <MapContainer
          center={[defaultLat, defaultLng]}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onClick={handleMapClick} />
          {centerLat && centerLng && (
            <>
              <MapCenterUpdater lat={centerLat} lng={centerLng} />
              <Marker position={[centerLat, centerLng]} />
              <Circle
                center={[centerLat, centerLng]}
                radius={radiusKm * 1000} // Convert km to meters
                pathOptions={{
                  color: "hsl(var(--primary))",
                  fillColor: "hsl(var(--primary))",
                  fillOpacity: 0.2,
                }}
              />
            </>
          )}
        </MapContainer>
      </div>

      {/* Instructions */}
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <MapPin className="h-3 w-3" />
        Clique no mapa para definir o ponto central da região
      </p>

      {/* Radius slider */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Raio de entrega</Label>
          <span className="text-sm font-medium">{radiusKm} km</span>
        </div>
        <Slider
          value={[radiusKm]}
          onValueChange={([value]) => onRadiusChange(value)}
          min={1}
          max={50}
          step={0.5}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1 km</span>
          <span>50 km</span>
        </div>
      </div>

      {/* Coordinates display */}
      {centerLat && centerLng && (
        <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
          Coordenadas: {centerLat.toFixed(6)}, {centerLng.toFixed(6)}
        </div>
      )}
    </div>
  );
};

export default RadiusMapPicker;

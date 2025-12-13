import { useEffect, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Loader2 } from "lucide-react";

interface RadiusMapPickerProps {
  centerLat: number | null;
  centerLng: number | null;
  radiusKm: number;
  onCenterChange: (lat: number, lng: number) => void;
  onRadiusChange: (km: number) => void;
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
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapRef, setMapRef] = useState<any>(null);

  // Default center: São Paulo, Brazil
  const defaultLat = centerLat || -23.5505;
  const defaultLng = centerLng || -46.6333;

  // Initialize map after component mounts
  useEffect(() => {
    let map: any = null;
    let marker: any = null;
    let circle: any = null;

    const initMap = async () => {
      try {
        const L = (await import("leaflet")).default;
        
        // Fix Leaflet default marker icon issue
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
          iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        });

        const container = document.getElementById("radius-map-container");
        if (!container) return;

        // Create map
        map = L.map(container).setView([defaultLat, defaultLng], 13);
        
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        // Add click handler
        map.on("click", (e: any) => {
          const { lat, lng } = e.latlng;
          onCenterChange(lat, lng);
        });

        // If we have a center, add marker and circle
        if (centerLat && centerLng) {
          marker = L.marker([centerLat, centerLng]).addTo(map);
          circle = L.circle([centerLat, centerLng], {
            radius: radiusKm * 1000,
            color: "hsl(24, 90%, 50%)",
            fillColor: "hsl(24, 90%, 50%)",
            fillOpacity: 0.2,
          }).addTo(map);
        }

        setMapRef({ map, marker, circle, L });
        setMapLoaded(true);
      } catch (error) {
        console.error("Error loading map:", error);
      }
    };

    initMap();

    return () => {
      if (map) {
        map.remove();
      }
    };
  }, []);

  // Update marker and circle when center or radius changes
  useEffect(() => {
    if (!mapRef || !mapRef.map) return;

    const { map, L } = mapRef;

    // Remove existing marker and circle
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker || layer instanceof L.Circle) {
        map.removeLayer(layer);
      }
    });

    // Add new marker and circle if we have coordinates
    if (centerLat && centerLng) {
      L.marker([centerLat, centerLng]).addTo(map);
      L.circle([centerLat, centerLng], {
        radius: radiusKm * 1000,
        color: "hsl(24, 90%, 50%)",
        fillColor: "hsl(24, 90%, 50%)",
        fillOpacity: 0.2,
      }).addTo(map);

      map.setView([centerLat, centerLng], map.getZoom());
    }
  }, [centerLat, centerLng, radiusKm, mapRef]);

  const handleSearch = async () => {
    if (!searchAddress.trim()) return;

    setSearching(true);
    try {
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
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {/* Map */}
      <div className="h-[300px] rounded-lg overflow-hidden border relative">
        {!mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <div id="radius-map-container" className="h-full w-full" />
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

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Loader2, LocateFixed } from "lucide-react";

/**
 * Seletor de raio de entrega no mapa (OpenStreetMap/Leaflet + Nominatim —
 * gratuitos, sem chave de API).
 *
 * Fluxo:
 *  1. Busca a cidade/local → sugestões aparecem abaixo → clicar/Enter apenas
 *     NAVEGA o mapa até lá (não marca nada).
 *  2. Clica no botão de localização (pino) → o próximo clique no mapa define
 *     o CENTRO da zona.
 *  3. O slider ajusta o raio em km e o círculo abre/fecha ao vivo.
 */

interface RadiusMapPickerProps {
  centerLat: number | null;
  centerLng: number | null;
  radiusKm: number;
  onCenterChange: (lat: number, lng: number) => void;
  onRadiusChange: (km: number) => void;
}

interface Suggestion {
  display_name: string;
  lat: string;
  lon: string;
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
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [pinMode, setPinMode] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const pinModeRef = useRef(false);
  const onCenterChangeRef = useRef(onCenterChange);
  onCenterChangeRef.current = onCenterChange;
  const searchAbortRef = useRef<AbortController | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  pinModeRef.current = pinMode;

  // ---- Inicialização do mapa (uma vez) ----
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        if (cancelled || !containerRef.current || mapRef.current) return;
        LRef.current = L;

        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
          iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
          shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
        });

        // Centro inicial: zona existente ou Brasil (visão ampla)
        const hasCenter = centerLat != null && centerLng != null;
        const map = L.map(containerRef.current).setView(
          hasCenter ? [centerLat!, centerLng!] : [-15.78, -47.93],
          hasCenter ? 12 : 4
        );

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        // Clique só marca o centro quando o modo pino está ARMADO.
        map.on("click", (e: any) => {
          if (!pinModeRef.current) return;
          const { lat, lng } = e.latlng;
          onCenterChangeRef.current(lat, lng);
          setPinMode(false);
        });

        mapRef.current = map;
        setMapLoaded(true);
      } catch (error) {
        console.error("Error loading map:", error);
      }
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cursor de mira enquanto o modo pino está armado
  useEffect(() => {
    const el = mapRef.current?.getContainer?.();
    if (el) el.style.cursor = pinMode ? "crosshair" : "";
  }, [pinMode, mapLoaded]);

  // ---- Marcador + círculo seguem centro/raio ----
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L || !mapLoaded) return;

    if (centerLat == null || centerLng == null) {
      if (markerRef.current) { map.removeLayer(markerRef.current); markerRef.current = null; }
      if (circleRef.current) { map.removeLayer(circleRef.current); circleRef.current = null; }
      return;
    }

    const pos: [number, number] = [centerLat, centerLng];

    if (!markerRef.current) {
      markerRef.current = L.marker(pos).addTo(map);
    } else {
      markerRef.current.setLatLng(pos);
    }

    if (!circleRef.current) {
      circleRef.current = L.circle(pos, {
        radius: radiusKm * 1000,
        color: "hsl(24, 90%, 50%)",
        fillColor: "hsl(24, 90%, 50%)",
        fillOpacity: 0.2,
      }).addTo(map);
    } else {
      circleRef.current.setLatLng(pos);
      circleRef.current.setRadius(radiusKm * 1000);
    }
  }, [centerLat, centerLng, radiusKm, mapLoaded]);

  // Ao definir um novo centro, enquadra o círculo inteiro na tela.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || centerLat == null || centerLng == null) return;
    if (circleRef.current) {
      map.fitBounds(circleRef.current.getBounds(), { padding: [24, 24] });
    } else {
      map.setView([centerLat, centerLng], 13);
    }
    // Reenquadra só quando o CENTRO muda (não a cada ajuste de raio).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerLat, centerLng, mapLoaded]);

  // ---- Busca (Nominatim) com sugestões ----
  const fetchSuggestions = async (query: string) => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    searchAbortRef.current?.abort();
    const ctrl = new AbortController();
    searchAbortRef.current = ctrl;
    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&countrycodes=br&limit=5&q=${encodeURIComponent(query)}`,
        { headers: { "Accept-Language": "pt-BR" }, signal: ctrl.signal }
      );
      const data = await response.json();
      setSuggestions(Array.isArray(data) ? data : []);
      setShowSuggestions(true);
    } catch (error: any) {
      if (error?.name !== "AbortError") console.error("Erro ao buscar endereço:", error);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchInput = (value: string) => {
    setSearchAddress(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => fetchSuggestions(value), 450);
  };

  // Escolher uma sugestão apenas NAVEGA até o local (não marca o centro).
  const handleSelectSuggestion = (s: Suggestion) => {
    setShowSuggestions(false);
    setSearchAddress(s.display_name.split(",").slice(0, 2).join(","));
    const map = mapRef.current;
    if (map) map.flyTo([parseFloat(s.lat), parseFloat(s.lon)], 12, { duration: 1.2 });
  };

  const handleEnter = () => {
    if (suggestions.length > 0) {
      handleSelectSuggestion(suggestions[0]);
    } else {
      fetchSuggestions(searchAddress);
    }
  };

  return (
    <div className="space-y-4">
      {/* Busca com sugestões */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Input
              placeholder="Buscar cidade ou endereço (ex: Bauru)"
              value={searchAddress}
              onChange={(e) => handleSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleEnter();
                }
                if (e.key === "Escape") setShowSuggestions(false);
              }}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-[1100] rounded-md border bg-popover shadow-md overflow-hidden">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground border-b last:border-b-0"
                    onClick={() => handleSelectSuggestion(s)}
                  >
                    <MapPin className="h-3 w-3 inline mr-1.5 text-muted-foreground" />
                    {s.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleEnter}
            disabled={searching}
            title="Buscar"
          >
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Mapa + botão do pino */}
      <div className="h-[320px] rounded-lg overflow-hidden border relative">
        {!mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
        <Button
          type="button"
          size="sm"
          variant={pinMode ? "default" : "secondary"}
          className="absolute top-2 right-2 z-[1000] shadow-md"
          onClick={() => setPinMode((v) => !v)}
          title={pinMode ? "Clique no mapa para marcar o centro" : "Ativar modo de marcação"}
        >
          <LocateFixed className="h-4 w-4 mr-1.5" />
          {pinMode ? "Clique no mapa..." : "Marcar centro"}
        </Button>
      </div>

      {/* Instruções */}
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <MapPin className="h-3 w-3" />
        {centerLat == null
          ? "Busque a cidade, clique em \"Marcar centro\" e depois clique no ponto central da região de entrega."
          : "Centro definido. Ajuste o raio abaixo ou clique em \"Marcar centro\" para reposicionar."}
      </p>

      {/* Raio */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Raio de entrega</Label>
          <span className="text-sm font-medium">{radiusKm} km</span>
        </div>
        <Slider
          value={[radiusKm]}
          onValueChange={([value]) => onRadiusChange(value)}
          min={0.5}
          max={50}
          step={0.5}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0,5 km</span>
          <span>50 km</span>
        </div>
      </div>

      {/* Coordenadas */}
      {centerLat != null && centerLng != null && (
        <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
          Coordenadas do centro: {centerLat.toFixed(6)}, {centerLng.toFixed(6)}
        </div>
      )}
    </div>
  );
};

export default RadiusMapPicker;

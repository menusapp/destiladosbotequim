import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Trash2, AlertCircle } from "lucide-react";

interface DeliveryZone {
  id: string;
  zone_name: string;
  zip_codes: string[];
  neighborhoods: string[];
  delivery_fee: number;
  min_order_value: number;
  estimated_time_minutes: number;
  is_active: boolean;
  zone_type: string;
  center_lat: number | null;
  center_lng: number | null;
  radius_km: number | null;
}

interface AddressStepProps {
  onBack: () => void;
  onContinue: (data: any) => void;
  restaurantSlug?: string;
  restaurantId?: string;
}

// Haversine formula to calculate distance between two coordinates
const getDistanceKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Verificar se cidade do cliente corresponde à zona de raio (comparação por nome)
const cityMatchesRadiusZone = (customerCity: string, zoneName: string): boolean => {
  if (!customerCity || !zoneName) return false;
  
  const normalizedCity = customerCity.toLowerCase().trim();
  const normalizedZone = zoneName.toLowerCase().trim();
  
  // Verificar se o nome da cidade está contido no nome da zona ou vice-versa
  // Ex: "Duartina" matches "Duartina Cidade" ou "Zona Duartina"
  return normalizedZone.includes(normalizedCity) || normalizedCity.includes(normalizedZone.split(' ')[0]);
};

export const AddressStep = ({ onBack, onContinue, restaurantSlug, restaurantId }: AddressStepProps) => {
  const [customerName, setCustomerName] = useState("");
  const [customerCPF, setCustomerCPF] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saveForLater, setSaveForLater] = useState(false);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [matchedZone, setMatchedZone] = useState<DeliveryZone | null>(null);
  const [zoneError, setZoneError] = useState<string | null>(null);
  const [validatingZone, setValidatingZone] = useState(false);
  const [newAddress, setNewAddress] = useState({
    zip_code: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
  });

  // Carregar zonas de entrega ativas
  useEffect(() => {
    const fetchDeliveryZones = async () => {
      if (!restaurantId) return;
      
      const { data } = await supabase
        .from("delivery_zones")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true);
      
      if (data) {
        setDeliveryZones(data);
      }
    };
    
    fetchDeliveryZones();
  }, [restaurantId]);

  // Carregar dados do usuário logado ou sessionStorage
  useEffect(() => {
    const loadUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, cpf, phone")
          .eq("id", user.id)
          .single();
        
        if (profile) {
          if (profile.full_name) setCustomerName(profile.full_name);
          if (profile.cpf) setCustomerCPF(profile.cpf);
          if (profile.phone) setCustomerPhone(profile.phone);
          return;
        }
      }
      
      // Fallback: sessionStorage
      if (restaurantSlug) {
        const storedName = sessionStorage.getItem(`delivery-customer-${restaurantSlug}`);
        const storedCPF = sessionStorage.getItem(`delivery-cpf-${restaurantSlug}`);
        
        if (storedName) setCustomerName(storedName);
        if (storedCPF) setCustomerCPF(storedCPF);
      }
    };
    
    loadUserData();
  }, [restaurantSlug]);

  // Validar CEP contra zonas de entrega (suporta CEP/bairro e raio)
  const validateAddress = useCallback(async (zipCode: string, neighborhood?: string, city?: string, state?: string) => {
    const cleanZip = zipCode.replace(/\D/g, "");
    
    // Se não há zonas configuradas, permitir qualquer CEP
    if (deliveryZones.length === 0) {
      setMatchedZone(null);
      setZoneError(null);
      return true;
    }
    
    setValidatingZone(true);
    
    try {
      // Primeiro, verificar zonas do tipo CEP/bairro
      const zipZone = deliveryZones.find(z => 
        z.zone_type !== "radius" && (
          z.zip_codes?.some(prefix => {
            const cleanPrefix = prefix.replace(/\D/g, "");
            return cleanZip.startsWith(cleanPrefix);
          }) ||
          z.neighborhoods?.some(n => {
            const targetNeighborhood = neighborhood || "";
            return targetNeighborhood.toLowerCase().includes(n.toLowerCase()) ||
                   n.toLowerCase().includes(targetNeighborhood.toLowerCase());
          })
        )
      );
      
      if (zipZone) {
        setMatchedZone(zipZone);
        setZoneError(null);
        return true;
      }
      
      // Verificar zonas do tipo raio usando comparação de cidade (instantâneo)
      const radiusZones = deliveryZones.filter(z => z.zone_type === "radius");
      
      if (radiusZones.length > 0 && city) {
        for (const zone of radiusZones) {
          if (cityMatchesRadiusZone(city, zone.zone_name)) {
            setMatchedZone(zone);
            setZoneError(null);
            return true;
          }
        }
      }
      
      setMatchedZone(null);
      setZoneError("Não entregamos nessa região. Por favor, escolha retirada no estabelecimento.");
      return false;
    } finally {
      setValidatingZone(false);
    }
  }, [deliveryZones]);

  const fetchSavedAddresses = async () => {
    const { data } = await supabase
      .from("customer_addresses")
      .select("*")
      .eq("customer_cpf", customerCPF)
      .order("is_default", { ascending: false });

    if (data && data.length > 0) {
      setSavedAddresses(data);
      setCustomerName(data[0].customer_name);
      setCustomerPhone(data[0].customer_phone);
      setSelectedAddress(data[0]);
      setShowNewForm(false);
      
      // Validar CEP do endereço selecionado
      validateAddress(data[0].zip_code, data[0].neighborhood, data[0].city, data[0].state);
    } else {
      setSavedAddresses([]);
      setShowNewForm(true);
    }
  };

  useEffect(() => {
    if (customerCPF.length === 11) {
      fetchSavedAddresses();
    }
  }, [customerCPF]);

  const handleZipCodeBlur = async () => {
    if (newAddress.zip_code.length === 8) {
      try {
        const response = await fetch(
          `https://viacep.com.br/ws/${newAddress.zip_code}/json/`
        );
        const data = await response.json();

        if (!data.erro) {
          const updatedAddress = {
            ...newAddress,
            street: data.logradouro || newAddress.street,
            neighborhood: data.bairro || newAddress.neighborhood,
            city: data.localidade || newAddress.city,
            state: data.uf || newAddress.state,
          };
          
          setNewAddress(updatedAddress);
          
          // Validar CEP contra zonas de entrega
          validateAddress(
            newAddress.zip_code, 
            updatedAddress.neighborhood, 
            updatedAddress.city, 
            updatedAddress.state
          );
          
        }
      } catch (error) {
        console.error("Erro ao buscar CEP:", error);
      }
    }
  };

  // Revalidar quando neighborhood é preenchido (para validação por bairro)
  useEffect(() => {
    if (newAddress.neighborhood && newAddress.city && deliveryZones.length > 0) {
      validateAddress(newAddress.zip_code, newAddress.neighborhood, newAddress.city, newAddress.state);
    }
  }, [newAddress.neighborhood, newAddress.city, deliveryZones, validateAddress]);

  // Validar quando seleciona endereço salvo
  useEffect(() => {
    if (selectedAddress && deliveryZones.length > 0) {
      validateAddress(selectedAddress.zip_code, selectedAddress.neighborhood, selectedAddress.city, selectedAddress.state);
    }
  }, [selectedAddress, deliveryZones, validateAddress]);

  const handleDeleteAddress = async (id: string) => {
    const { error } = await supabase
      .from("customer_addresses")
      .delete()
      .eq("id", id);

    if (!error) {
      setSavedAddresses(savedAddresses.filter((a) => a.id !== id));
      if (selectedAddress?.id === id) {
        setSelectedAddress(null);
        setShowNewForm(true);
        setMatchedZone(null);
        setZoneError(null);
      }
    }
  };

  const handleContinue = () => {
    if (!customerName || !customerCPF || !customerPhone) {
      return;
    }

    const addressToUse = showNewForm ? newAddress : selectedAddress;

    if (
      !addressToUse.street ||
      !addressToUse.number ||
      !addressToUse.neighborhood ||
      !addressToUse.city ||
      !addressToUse.state
    ) {
      return;
    }

    // Validar zona de entrega antes de continuar
    if (deliveryZones.length > 0 && !matchedZone) {
      return;
    }

    onContinue({
      customerName,
      customerCPF,
      customerPhone,
      address: addressToUse,
      saveForLater: showNewForm && saveForLater,
      isFirstAddress: savedAddresses.length === 0,
      deliveryZone: matchedZone, // Passar zona encontrada para usar taxa correta
    });
  };

  return (
    <div className="p-4 space-y-6">
      {/* Zone Error Alert */}
      {zoneError && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <p className="text-sm text-destructive font-medium">{zoneError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validating Zone */}
      {validatingZone && (
        <Card className="border-muted">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Verificando região de entrega...</p>
          </CardContent>
        </Card>
      )}

      {/* Matched Zone Info */}
      {matchedZone && !validatingZone && (
        <Card className="border-green-500 bg-green-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-700">
                  Entregamos na sua região! ({matchedZone.zone_name})
                </p>
                <p className="text-xs text-green-600">
                  Taxa: R$ {matchedZone.delivery_fee.toFixed(2)} • 
                  Tempo estimado: {matchedZone.estimated_time_minutes} min
                  {matchedZone.min_order_value > 0 && ` • Pedido mínimo: R$ ${matchedZone.min_order_value.toFixed(2)}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer Data */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Nome completo</Label>
          <Input
            id="name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Seu nome"
          />
        </div>

        <div>
          <Label htmlFor="cpf">CPF</Label>
          <Input
            id="cpf"
            value={customerCPF}
            onChange={(e) => setCustomerCPF(e.target.value.replace(/\D/g, ""))}
            placeholder="00000000000"
            maxLength={11}
          />
        </div>

        <div>
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="(00) 00000-0000"
          />
        </div>
      </div>

      {/* Saved Addresses */}
      {savedAddresses.length > 0 && !showNewForm && (
        <div className="space-y-3">
          <h3 className="font-bold text-foreground">Seus endereços</h3>
          {savedAddresses.map((addr) => (
            <Card
              key={addr.id}
              className={`cursor-pointer transition-colors ${
                selectedAddress?.id === addr.id
                  ? "border-primary bg-primary/5"
                  : "hover:border-primary/50"
              }`}
              onClick={() => {
                setSelectedAddress(addr);
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="w-4 h-4" />
                      <p className="font-medium">
                        {addr.street}, {addr.number}
                      </p>
                    </div>
                    {addr.complement && (
                      <p className="text-sm text-muted-foreground ml-6">
                        {addr.complement}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground ml-6">
                      {addr.neighborhood} - {addr.city}/{addr.state}
                    </p>
                    <p className="text-sm text-muted-foreground ml-6">
                      CEP: {addr.zip_code}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteAddress(addr.id);
                    }}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setShowNewForm(true);
              setSelectedAddress(null);
              setMatchedZone(null);
              setZoneError(null);
            }}
          >
            + Usar outro endereço
          </Button>
        </div>
      )}

      {/* New Address Form */}
      {(savedAddresses.length === 0 || showNewForm) && (
        <div className="space-y-4">
          <h3 className="font-bold text-foreground">Endereço de entrega</h3>

          <div>
            <Label htmlFor="zipCode">CEP</Label>
            <Input
              id="zipCode"
              value={newAddress.zip_code}
              onChange={(e) =>
                setNewAddress({
                  ...newAddress,
                  zip_code: e.target.value.replace(/\D/g, ""),
                })
              }
              onBlur={handleZipCodeBlur}
              placeholder="00000000"
              maxLength={8}
            />
          </div>

          <div>
            <Label htmlFor="street">Rua</Label>
            <Input
              id="street"
              value={newAddress.street}
              onChange={(e) =>
                setNewAddress({ ...newAddress, street: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="number">Número</Label>
              <Input
                id="number"
                value={newAddress.number}
                onChange={(e) =>
                  setNewAddress({ ...newAddress, number: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="complement">Complemento</Label>
              <Input
                id="complement"
                value={newAddress.complement}
                onChange={(e) =>
                  setNewAddress({ ...newAddress, complement: e.target.value })
                }
                placeholder="Opcional"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="neighborhood">Bairro</Label>
            <Input
              id="neighborhood"
              value={newAddress.neighborhood}
              onChange={(e) =>
                setNewAddress({ ...newAddress, neighborhood: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">Cidade</Label>
              <Input
                id="city"
                value={newAddress.city}
                onChange={(e) =>
                  setNewAddress({ ...newAddress, city: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="state">Estado</Label>
              <Input
                id="state"
                value={newAddress.state}
                onChange={(e) =>
                  setNewAddress({
                    ...newAddress,
                    state: e.target.value.toUpperCase(),
                  })
                }
                maxLength={2}
                placeholder="UF"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={saveForLater} onCheckedChange={setSaveForLater} />
            <Label>Salvar para próximos pedidos</Label>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Voltar
        </Button>
        <Button 
          onClick={handleContinue} 
          className="flex-1"
          disabled={(deliveryZones.length > 0 && !matchedZone) || validatingZone}
        >
          {validatingZone ? "Verificando..." : "Continuar"}
        </Button>
      </div>
    </div>
  );
};

export default AddressStep;

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, Trash2, AlertCircle } from "lucide-react";
import { validatePhone } from "@/lib/cpfValidator";

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
  primaryColor?: string;
}

// ---------------------------------------------------------------------------
// Geocodificação (Nominatim/OpenStreetMap, gratuito) usada pela validação de
// zona por RAIO NO MAPA. Cache em memória evita repetir a mesma consulta a
// cada revalidação do endereço.
// ---------------------------------------------------------------------------
const geocodeCache = new Map<string, { lat: number; lon: number } | null>();

async function geocodeFirst(params: string): Promise<{ lat: number; lon: number } | null> {
  if (geocodeCache.has(params)) return geocodeCache.get(params) ?? null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&${params}`,
      { headers: { "Accept-Language": "pt-BR" } }
    );
    const data = await res.json();
    const first =
      Array.isArray(data) && data[0]
        ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
        : null;
    geocodeCache.set(params, first);
    return first;
  } catch {
    // Falha de rede: não cacheia, tenta de novo na próxima validação.
    return null;
  }
}

/** Distância em km entre dois pontos (fórmula de Haversine). */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}


export const AddressStep = ({ onBack, onContinue, restaurantSlug, restaurantId, primaryColor }: AddressStepProps) => {
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
  const [fieldErrors, setFieldErrors] = useState<{
    name?: boolean;
    cpf?: boolean;
    phone?: boolean;
    street?: boolean;
    number?: boolean;
    neighborhood?: boolean;
    city?: boolean;
    state?: boolean;
    zipCode?: boolean;
  }>({});
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
      
      // Fallback: localStorage (incluindo telefone)
      if (restaurantSlug) {
        const storedName = localStorage.getItem(`delivery-customer-${restaurantSlug}`);
        const storedCPF = localStorage.getItem(`delivery-cpf-${restaurantSlug}`);
        const storedPhone = localStorage.getItem(`delivery-phone-${restaurantSlug}`);
        
        if (storedName) setCustomerName(storedName);
        if (storedCPF) setCustomerCPF(storedCPF);
        if (storedPhone) setCustomerPhone(storedPhone);
      }
    };
    
    loadUserData();
  }, [restaurantSlug]);

  // Estado para controlar se telefone veio do cadastro (readonly)
  const [phoneFromCustomer, setPhoneFromCustomer] = useState(false);

  // Quando CPF é preenchido, buscar dados do cliente na tabela customers
  // SEMPRE priorizar telefone do cadastro customers (fonte da verdade para WhatsApp)
  useEffect(() => {
    const fetchCustomerData = async () => {
      if (customerCPF.length !== 11 || !restaurantId) return;
      
      const { data: customerRows } = await (supabase as any).rpc("get_customer_by_cpf", {
        p_cpf: customerCPF,
      });
      const customer = Array.isArray(customerRows) ? customerRows[0] : customerRows;
      
      if (customer) {
        if (customer.name && !customerName) setCustomerName(customer.name);
        // SEMPRE usar telefone do cadastro se existir (prioridade máxima)
        if (customer.phone) {
          setCustomerPhone(customer.phone);
          setPhoneFromCustomer(true);
        } else {
          setPhoneFromCustomer(false);
        }
      } else {
        setPhoneFromCustomer(false);
      }
    };
    
    fetchCustomerData();
  }, [customerCPF, restaurantId]);

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

      // Zonas por RAIO NO MAPA: geocodifica o endereço do cliente
      // (CEP → bairro → cidade, via Nominatim/OSM, gratuito) e confere se a
      // distância até o centro de alguma zona cabe no raio configurado.
      const radiusZones = deliveryZones.filter(
        (z) =>
          z.zone_type === "radius" &&
          z.center_lat != null &&
          z.center_lng != null &&
          z.radius_km != null
      );
      if (radiusZones.length > 0) {
        const attempts: string[] = [];
        if (cleanZip.length === 8) attempts.push(`country=Brazil&postalcode=${cleanZip}`);
        if (neighborhood && city)
          attempts.push(`q=${encodeURIComponent(`${neighborhood}, ${city}${state ? ` - ${state}` : ""}, Brasil`)}`);
        if (city) attempts.push(`q=${encodeURIComponent(`${city}${state ? ` - ${state}` : ""}, Brasil`)}`);

        let point: { lat: number; lon: number } | null = null;
        for (const params of attempts) {
          point = await geocodeFirst(params);
          if (point) break;
        }

        if (point) {
          const matches = radiusZones
            .filter(
              (z) =>
                haversineKm(point!.lat, point!.lon, Number(z.center_lat), Number(z.center_lng)) <=
                Number(z.radius_km)
            )
            // Várias zonas cobrindo o ponto → fica a de menor taxa (melhor p/ cliente)
            .sort((a, b) => Number(a.delivery_fee || 0) - Number(b.delivery_fee || 0));
          if (matches.length > 0) {
            setMatchedZone(matches[0]);
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
    const { data: rawData } = await (supabase as any).rpc("list_customer_addresses", {
      p_cpf: customerCPF,
      p_phone: customerPhone || null,
    });
    const data = Array.isArray(rawData)
      ? [...rawData].sort((a: any, b: any) => (b.is_default === true ? 1 : 0) - (a.is_default === true ? 1 : 0))
      : rawData;

    if (data && data.length > 0) {
      setSavedAddresses(data);
      // Só usar nome do endereço se não tiver nome preenchido
      if (!customerName) setCustomerName(data[0].customer_name);
      // NÃO sobrescrever telefone do cadastro customers - só usar do endereço se não tiver telefone
      if (!customerPhone && !phoneFromCustomer) setCustomerPhone(data[0].customer_phone);
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
    const errors: typeof fieldErrors = {};
    
    if (!customerName) errors.name = true;
    if (!customerCPF || customerCPF.length !== 11) errors.cpf = true;
    const phoneRaw = customerPhone.replace(/\D/g, "");
    if (!phoneRaw) {
      errors.phone = true;
    } else if (!validatePhone(phoneRaw)) {
      errors.phone = true;
    }

    const addressToUse = showNewForm ? newAddress : selectedAddress;
    
    if (showNewForm || !selectedAddress) {
      if (!newAddress.zip_code) errors.zipCode = true;
      if (!newAddress.street) errors.street = true;
      if (!newAddress.number) errors.number = true;
      if (!newAddress.neighborhood) errors.neighborhood = true;
      if (!newAddress.city) errors.city = true;
      if (!newAddress.state) errors.state = true;
    }
    
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    // Validar zona de entrega antes de continuar
    if (deliveryZones.length > 0 && !matchedZone) {
      return;
    }

    // Salvar dados no localStorage para próximos pedidos
    if (restaurantSlug) {
      localStorage.setItem(`delivery-customer-${restaurantSlug}`, customerName);
      localStorage.setItem(`delivery-cpf-${restaurantSlug}`, customerCPF);
      localStorage.setItem(`delivery-phone-${restaurantSlug}`, customerPhone);
    }

    onContinue({
      customerName,
      customerCPF,
      customerPhone,
      address: addressToUse,
      saveForLater: showNewForm && saveForLater,
      isFirstAddress: savedAddresses.length === 0,
      deliveryZone: matchedZone,
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
          <Label htmlFor="name" className={fieldErrors.name ? "text-red-500" : ""}>
            Nome completo
          </Label>
          <Input
            id="name"
            value={customerName}
            onChange={(e) => {
              setCustomerName(e.target.value.slice(0, 35));
              if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: false }));
            }}
            placeholder="Seu nome"
            maxLength={35}
            className={fieldErrors.name ? "border-red-300 bg-red-50/50" : ""}
          />
          {fieldErrors.name && (
            <p className="text-xs text-red-500 mt-1">Preencher aqui</p>
          )}
        </div>

        <div>
          <Label htmlFor="cpf" className={fieldErrors.cpf ? "text-red-500" : ""}>
            CPF
          </Label>
          <Input
            id="cpf"
            value={customerCPF}
            onChange={(e) => {
              setCustomerCPF(e.target.value.replace(/\D/g, ""));
              if (fieldErrors.cpf) setFieldErrors(prev => ({ ...prev, cpf: false }));
            }}
            placeholder="00000000000"
            maxLength={11}
            className={fieldErrors.cpf ? "border-red-300 bg-red-50/50" : ""}
          />
          {fieldErrors.cpf && (
            <p className="text-xs text-red-500 mt-1">Preencher aqui</p>
          )}
        </div>

        <div>
          <Label htmlFor="phone" className={fieldErrors.phone ? "text-red-500" : ""}>
            Telefone {phoneFromCustomer && <span className="text-xs text-muted-foreground">(do cadastro)</span>}
          </Label>
          <Input
            id="phone"
            value={customerPhone}
            onChange={(e) => {
              if (!phoneFromCustomer) {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                let formatted = digits;
                if (digits.length > 2 && digits.length <= 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
                else if (digits.length > 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
                setCustomerPhone(formatted);
                if (fieldErrors.phone) setFieldErrors(prev => ({ ...prev, phone: false }));
              }
            }}
            placeholder="(00) 00000-0000"
            maxLength={15}
            inputMode="tel"
            className={`${fieldErrors.phone ? "border-red-300 bg-red-50/50" : ""} ${phoneFromCustomer ? "bg-muted/50" : ""}`}
            readOnly={phoneFromCustomer}
          />
          {phoneFromCustomer && (
            <p className="text-xs text-muted-foreground mt-1">
              Telefone do seu cadastro. Para alterar, acesse seu perfil.
            </p>
          )}
          {fieldErrors.phone && !phoneFromCustomer && (
            <p className="text-xs text-red-500 mt-1">Telefone inválido. Verifique o DDD e número.</p>
          )}
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
            <Label htmlFor="zipCode" className={fieldErrors.zipCode ? "text-red-500" : ""}>
              CEP
            </Label>
            <Input
              id="zipCode"
              value={newAddress.zip_code}
              onChange={(e) => {
                setNewAddress({
                  ...newAddress,
                  zip_code: e.target.value.replace(/\D/g, ""),
                });
                if (fieldErrors.zipCode) setFieldErrors(prev => ({ ...prev, zipCode: false }));
              }}
              onBlur={handleZipCodeBlur}
              placeholder="00000000"
              maxLength={8}
              className={fieldErrors.zipCode ? "border-red-300 bg-red-50/50" : ""}
            />
            {fieldErrors.zipCode && (
              <p className="text-xs text-red-500 mt-1">Preencher aqui</p>
            )}
          </div>

          <div>
            <Label htmlFor="street" className={fieldErrors.street ? "text-red-500" : ""}>
              Rua
            </Label>
            <Input
              id="street"
              value={newAddress.street}
              onChange={(e) => {
                setNewAddress({ ...newAddress, street: e.target.value });
                if (fieldErrors.street) setFieldErrors(prev => ({ ...prev, street: false }));
              }}
              className={fieldErrors.street ? "border-red-300 bg-red-50/50" : ""}
            />
            {fieldErrors.street && (
              <p className="text-xs text-red-500 mt-1">Preencher aqui</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="number" className={fieldErrors.number ? "text-red-500" : ""}>
                Número
              </Label>
              <Input
                id="number"
                value={newAddress.number}
                onChange={(e) => {
                  setNewAddress({ ...newAddress, number: e.target.value });
                  if (fieldErrors.number) setFieldErrors(prev => ({ ...prev, number: false }));
                }}
                className={fieldErrors.number ? "border-red-300 bg-red-50/50" : ""}
              />
              {fieldErrors.number && (
                <p className="text-xs text-red-500 mt-1">Preencher aqui</p>
              )}
            </div>
            <div>
              <Label htmlFor="complement">Complemento (opcional)</Label>
              <Input
                id="complement"
                value={newAddress.complement}
                onChange={(e) =>
                  setNewAddress({ ...newAddress, complement: e.target.value })
                }
                placeholder="Ex: Casa, Apartamento, Bloco B"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="neighborhood" className={fieldErrors.neighborhood ? "text-red-500" : ""}>
              Bairro
            </Label>
            <Input
              id="neighborhood"
              value={newAddress.neighborhood}
              onChange={(e) => {
                setNewAddress({ ...newAddress, neighborhood: e.target.value });
                if (fieldErrors.neighborhood) setFieldErrors(prev => ({ ...prev, neighborhood: false }));
              }}
              className={fieldErrors.neighborhood ? "border-red-300 bg-red-50/50" : ""}
            />
            {fieldErrors.neighborhood && (
              <p className="text-xs text-red-500 mt-1">Preencher aqui</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city" className={fieldErrors.city ? "text-red-500" : ""}>
                Cidade
              </Label>
              <Input
                id="city"
                value={newAddress.city}
                onChange={(e) => {
                  setNewAddress({ ...newAddress, city: e.target.value });
                  if (fieldErrors.city) setFieldErrors(prev => ({ ...prev, city: false }));
                }}
                className={fieldErrors.city ? "border-red-300 bg-red-50/50" : ""}
              />
              {fieldErrors.city && (
                <p className="text-xs text-red-500 mt-1">Preencher aqui</p>
              )}
            </div>
            <div>
              <Label htmlFor="state" className={fieldErrors.state ? "text-red-500" : ""}>
                Estado
              </Label>
              <Input
                id="state"
                value={newAddress.state}
                onChange={(e) => {
                  setNewAddress({
                    ...newAddress,
                    state: e.target.value.toUpperCase(),
                  });
                  if (fieldErrors.state) setFieldErrors(prev => ({ ...prev, state: false }));
                }}
                maxLength={2}
                placeholder="UF"
                className={fieldErrors.state ? "border-red-300 bg-red-50/50" : ""}
              />
              {fieldErrors.state && (
                <p className="text-xs text-red-500 mt-1">Preencher aqui</p>
              )}
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
          style={primaryColor ? { backgroundColor: primaryColor, borderColor: primaryColor } : undefined}
        >
          {validatingZone ? "Verificando..." : "Continuar"}
        </Button>
      </div>
    </div>
  );
};

export default AddressStep;

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { MapPin, Trash2 } from "lucide-react";

interface AddressStepProps {
  onBack: () => void;
  onContinue: (data: any) => void;
  restaurantSlug?: string;
}

export const AddressStep = ({ onBack, onContinue, restaurantSlug }: AddressStepProps) => {
  const [customerName, setCustomerName] = useState("");
  const [customerCPF, setCustomerCPF] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [saveForLater, setSaveForLater] = useState(false);
  const [newAddress, setNewAddress] = useState({
    zip_code: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
  });

  // Carregar dados do sessionStorage
  useEffect(() => {
    if (restaurantSlug) {
      const storedName = sessionStorage.getItem(`delivery-customer-${restaurantSlug}`);
      const storedCPF = sessionStorage.getItem(`delivery-cpf-${restaurantSlug}`);
      
      if (storedName) setCustomerName(storedName);
      if (storedCPF) setCustomerCPF(storedCPF);
    }
  }, [restaurantSlug]);

  useEffect(() => {
    if (customerCPF.length === 11) {
      fetchSavedAddresses();
    }
  }, [customerCPF]);

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
    } else {
      setSavedAddresses([]);
      setShowNewForm(true);
    }
  };

  const handleZipCodeBlur = async () => {
    if (newAddress.zip_code.length === 8) {
      try {
        const response = await fetch(
          `https://viacep.com.br/ws/${newAddress.zip_code}/json/`
        );
        const data = await response.json();

        if (!data.erro) {
          setNewAddress((prev) => ({
            ...prev,
            street: data.logradouro || prev.street,
            neighborhood: data.bairro || prev.neighborhood,
            city: data.localidade || prev.city,
            state: data.uf || prev.state,
          }));
          toast.success("CEP encontrado!");
        } else {
          toast.error("CEP não encontrado");
        }
      } catch (error) {
        toast.error("Erro ao buscar CEP");
      }
    }
  };

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
      }
      toast.success("Endereço removido");
    }
  };

  const handleContinue = () => {
    if (!customerName || !customerCPF || !customerPhone) {
      toast.error("Preencha seus dados");
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
      toast.error("Preencha o endereço completo");
      return;
    }

    onContinue({
      customerName,
      customerCPF,
      customerPhone,
      address: addressToUse,
      saveForLater: showNewForm && saveForLater,
      isFirstAddress: savedAddresses.length === 0,
    });
  };

  return (
    <div className="p-4 space-y-6">
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
              onClick={() => setSelectedAddress(addr)}
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
      <div className="flex gap-2 pt-4">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Voltar
        </Button>
        <Button onClick={handleContinue} className="flex-1">
          Continuar
        </Button>
      </div>
    </div>
  );
};

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plus, Trash2, User, Gift } from "lucide-react";
import { toast } from "sonner";

interface ProfileViewProps {
  customerName: string;
  customerCPF: string;
  restaurantId: string;
  onNameUpdate: (name: string) => void;
}

export const ProfileView = ({
  customerName,
  customerCPF,
  restaurantId,
  onNameUpdate,
}: ProfileViewProps) => {
  const [name, setName] = useState(customerName);
  const [phone, setPhone] = useState("");
  const [addresses, setAddresses] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zip_code: "",
  });

  useEffect(() => {
    fetchAddresses();
    fetchCoupons();
    fetchLoyaltyPoints();
  }, [customerCPF, restaurantId]);

  const fetchAddresses = async () => {
    const { data } = await supabase
      .from("customer_addresses")
      .select("*")
      .eq("customer_cpf", customerCPF)
      .order("is_default", { ascending: false });
    
    setAddresses(data || []);
    if (data && data.length > 0) {
      setPhone(data[0].customer_phone || "");
    }
  };

  const fetchCoupons = async () => {
    const { data } = await supabase
      .from("coupons")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .gte("valid_until", new Date().toISOString());
    
    setCoupons(data || []);
  };

  const fetchLoyaltyPoints = async () => {
    const { data } = await supabase
      .from("loyalty_points")
      .select("points_balance")
      .eq("customer_cpf", customerCPF)
      .eq("restaurant_id", restaurantId)
      .single();
    
    setLoyaltyPoints(data?.points_balance || 0);
  };

  const handleSaveName = () => {
    onNameUpdate(name);
    toast.success("Nome atualizado!");
  };

  const handleAddAddress = async () => {
    try {
      await supabase.from("customer_addresses").insert({
        customer_cpf: customerCPF,
        customer_name: name,
        customer_phone: phone,
        ...newAddress,
        is_default: addresses.length === 0,
      });

      setNewAddress({
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
        zip_code: "",
      });
      setShowAddAddress(false);
      fetchAddresses();
      toast.success("Endereço adicionado!");
    } catch (error) {
      toast.error("Erro ao adicionar endereço");
    }
  };

  const handleDeleteAddress = async (id: string) => {
    try {
      await supabase.from("customer_addresses").delete().eq("id", id);
      fetchAddresses();
      toast.success("Endereço removido!");
    } catch (error) {
      toast.error("Erro ao remover endereço");
    }
  };

  return (
    <ScrollArea className="h-[calc(100vh-120px)]">
      <div className="space-y-4 p-4 pb-20">
        {/* Informações Pessoais */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Informações Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <div className="flex gap-2">
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                />
                <Button onClick={handleSaveName} size="sm">
                  Salvar
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={customerCPF} disabled className="bg-muted" />
            </div>
          </CardContent>
        </Card>

        {/* Pontos de Fidelidade */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5" />
              Pontos de Fidelidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <div className="text-4xl font-bold text-primary mb-2">
                {loyaltyPoints}
              </div>
              <p className="text-sm text-muted-foreground">pontos disponíveis</p>
            </div>
          </CardContent>
        </Card>

        {/* Endereços Salvos */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Endereços Salvos
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddAddress(!showAddAddress)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {showAddAddress && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label htmlFor="street">Rua</Label>
                      <Input
                        id="street"
                        value={newAddress.street}
                        onChange={(e) =>
                          setNewAddress({ ...newAddress, street: e.target.value })
                        }
                      />
                    </div>
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
                          setNewAddress({
                            ...newAddress,
                            complement: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="neighborhood">Bairro</Label>
                      <Input
                        id="neighborhood"
                        value={newAddress.neighborhood}
                        onChange={(e) =>
                          setNewAddress({
                            ...newAddress,
                            neighborhood: e.target.value,
                          })
                        }
                      />
                    </div>
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
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleAddAddress} className="flex-1">
                      Adicionar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowAddAddress(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {addresses.map((address) => (
              <Card key={address.id}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {address.street}, {address.number}
                        </p>
                        {address.is_default && (
                          <Badge variant="secondary" className="text-xs">
                            Padrão
                          </Badge>
                        )}
                      </div>
                      {address.complement && (
                        <p className="text-sm text-muted-foreground">
                          {address.complement}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {address.neighborhood}, {address.city} - {address.state}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAddress(address.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {addresses.length === 0 && !showAddAddress && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum endereço salvo
              </p>
            )}
          </CardContent>
        </Card>

        {/* Seus Descontos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5" />
              Seus Descontos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {coupons.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum cupom disponível no momento
              </p>
            ) : (
              coupons.map((coupon) => (
                <Card key={coupon.id} className="bg-gradient-to-r from-primary/10 to-primary/5">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold text-lg">{coupon.code}</p>
                        <p className="text-sm text-muted-foreground">
                          {coupon.discount_type === "percentage"
                            ? `${coupon.discount_value}% de desconto`
                            : `R$ ${coupon.discount_value.toFixed(2)} de desconto`}
                        </p>
                      </div>
                      <Badge variant="secondary">Válido</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
};

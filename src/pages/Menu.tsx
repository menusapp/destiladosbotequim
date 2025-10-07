import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Plus, Minus, Receipt } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import CustomerInfoDialog from "@/components/menu/CustomerInfoDialog";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  available: boolean;
}

interface Category {
  id: string;
  name: string;
  products: Product[];
}

interface Restaurant {
  id: string;
  name: string;
  primary_color: string;
  secondary_color: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

const Menu = () => {
  const { restaurantSlug, tableNumber } = useParams();
  const navigate = useNavigate();
  
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const [customerCPF, setCustomerCPF] = useState("");
  const [tableId, setTableId] = useState<string | null>(null);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);

  useEffect(() => {
    // Verificar se já tem info do cliente no sessionStorage
    const savedName = sessionStorage.getItem(`customer_name_${tableNumber}`);
    const savedCPF = sessionStorage.getItem(`customer_cpf_${tableNumber}`);
    
    if (savedName && savedCPF) {
      setCustomerName(savedName);
      setCustomerCPF(savedCPF);
      fetchData();
    } else {
      setShowCustomerDialog(true);
      fetchData();
    }
  }, [restaurantSlug, tableNumber]);

  const fetchData = async () => {
    try {
      // Buscar restaurante
      const { data: restData, error: restError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("slug", restaurantSlug)
        .single();

      if (restError) throw restError;
      setRestaurant(restData);

      // Buscar mesa
      const { data: tableData, error: tableError } = await supabase
        .from("tables")
        .select("*")
        .eq("restaurant_id", restData.id)
        .eq("table_number", parseInt(tableNumber || "0"))
        .single();

      if (tableError) throw tableError;
      setTableId(tableData.id);

      // Buscar categorias e produtos
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select(`
          *,
          products(*)
        `)
        .eq("restaurant_id", restData.id)
        .order("display_order");

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);
    } catch (error: any) {
      toast.error("Erro ao carregar cardápio");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerInfoSubmit = (name: string, cpf: string) => {
    setCustomerName(name);
    setCustomerCPF(cpf);
    sessionStorage.setItem(`customer_name_${tableNumber}`, name);
    sessionStorage.setItem(`customer_cpf_${tableNumber}`, cpf);
    setShowCustomerDialog(false);
    toast.success("Bem-vindo! Faça seu pedido");
  };

  const addToCart = (product: Product) => {
    if (!customerName || !customerCPF) {
      setShowCustomerDialog(true);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    toast.success(`${product.name} adicionado ao carrinho`);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      const updated = prev.map((item) =>
        item.product.id === productId
          ? { ...item, quantity: Math.max(0, item.quantity + delta) }
          : item
      );
      return updated.filter((item) => item.quantity > 0);
    });
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  };

  const handleSendOrder = async () => {
    if (cart.length === 0) {
      toast.error("Adicione itens ao carrinho primeiro");
      return;
    }

    if (!tableId) {
      toast.error("Mesa não encontrada");
      return;
    }

    try {
      // Criar pedido
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          table_id: tableId,
          customer_name: customerName,
          customer_cpf: customerCPF,
          status: "pending",
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Criar itens do pedido
      const orderItems = cart.map((item) => ({
        order_id: order.id,
        product_id: item.product.id,
        quantity: item.quantity,
        price_at_order: item.product.price,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      toast.success("Pedido enviado! Aguarde o atendimento");
      setCart([]);
    } catch (error: any) {
      toast.error("Erro ao enviar pedido");
      console.error(error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando cardápio...</p>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Restaurante não encontrado</p>
      </div>
    );
  }

  return (
    <>
      <CustomerInfoDialog
        open={showCustomerDialog}
        onSubmit={handleCustomerInfoSubmit}
      />

      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background pb-24">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-6 shadow-lg">
          <h1 className="text-2xl font-bold">{restaurant.name}</h1>
          <p className="text-sm opacity-90">Mesa {tableNumber}</p>
          {customerName && (
            <p className="text-xs opacity-75 mt-1">Cliente: {customerName}</p>
          )}
        </div>

        {/* Botão Ver Comanda */}
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate(`/comanda/${restaurantSlug}/${tableNumber}`)}
          >
            <Receipt className="h-4 w-4 mr-2" />
            Ver Comanda
          </Button>
        </div>

        {/* Categorias e Produtos */}
        <div className="container mx-auto px-4 space-y-6">
          {categories.map((category) => (
            <Card key={category.id}>
              <CardHeader>
                <CardTitle className="text-xl">{category.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {category.products.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-start justify-between p-3 border rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">{product.name}</p>
                          {product.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {product.description}
                            </p>
                          )}
                        </div>
                        {!product.available && (
                          <Badge variant="secondary">Indisponível</Badge>
                        )}
                      </div>
                      <p className="text-lg font-bold text-primary mt-2">
                        R$ {product.price.toFixed(2)}
                      </p>
                    </div>
                    {product.available && (
                      <Button
                        size="sm"
                        onClick={() => addToCart(product)}
                        className="ml-4"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Carrinho Fixo */}
        {cart.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-lg p-4">
            <div className="container mx-auto space-y-3">
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="flex-1">{item.product.name}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(item.product.id, -1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center font-medium">
                        {item.quantity}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(item.product.id, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <span className="w-20 text-right font-semibold">
                        R$ {(item.product.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="font-bold">Total:</span>
                <span className="text-xl font-bold text-primary">
                  R$ {getCartTotal().toFixed(2)}
                </span>
              </div>
              <Button className="w-full" size="lg" onClick={handleSendOrder}>
                <ShoppingCart className="h-5 w-5 mr-2" />
                Enviar Pedido
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Menu;

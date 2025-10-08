import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Plus, Minus, Receipt } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import CustomerInfoDialog from "@/components/menu/CustomerInfoDialog";
import ProductDetailDialog from "@/components/menu/ProductDetailDialog";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  available: boolean;
  image_url: string | null;
}

interface ProductExtra {
  id: string;
  name: string;
  price: number;
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

interface CartItemExtra {
  id: string;
  name: string;
  price: number;
}

interface CartItem {
  id: string; // ID único para cada item do carrinho
  product: Product;
  quantity: number;
  extras: CartItemExtra[];
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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productExtras, setProductExtras] = useState<ProductExtra[]>([]);
  const [showProductDialog, setShowProductDialog] = useState(false);

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

  const handleProductClick = async (product: Product) => {
    if (!customerName || !customerCPF) {
      setShowCustomerDialog(true);
      return;
    }

    // Buscar extras do produto
    const { data: extrasData } = await supabase
      .from("product_extras")
      .select("*")
      .eq("product_id", product.id);

    setSelectedProduct(product);
    setProductExtras(extrasData || []);
    setShowProductDialog(true);
  };

  const addToCart = (product: Product, extras: ProductExtra[]) => {
    setCart((prev) => {
      // Verificar se já existe um item com o mesmo produto e mesmos extras
      const existing = prev.find((item) => 
        item.product.id === product.id && 
        JSON.stringify(item.extras.map(e => e.id).sort()) === JSON.stringify(extras.map(e => e.id).sort())
      );
      
      if (existing) {
        return prev.map((item) =>
          item.id === existing.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      
      // Criar novo item com ID único
      return [...prev, { 
        id: crypto.randomUUID(),
        product, 
        quantity: 1, 
        extras 
      }];
    });
    
    const extrasText = extras.length > 0 ? ` com ${extras.length} adicional(is)` : '';
    toast.success(`${product.name}${extrasText} adicionado ao carrinho`);
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) => {
      const updated = prev.map((item) =>
        item.id === itemId
          ? { ...item, quantity: Math.max(0, item.quantity + delta) }
          : item
      );
      return updated.filter((item) => item.quantity > 0);
    });
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => {
      const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
      return sum + (item.product.price + extrasTotal) * item.quantity;
    }, 0);
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

      // Criar itens do pedido com extras
      for (const item of cart) {
        const { data: orderItem, error: itemError } = await supabase
          .from("order_items")
          .insert({
            order_id: order.id,
            product_id: item.product.id,
            quantity: item.quantity,
            price_at_order: item.product.price,
          })
          .select()
          .single();

        if (itemError) throw itemError;

        // Inserir extras do item
        if (item.extras.length > 0) {
          const orderItemExtras = item.extras.map((extra) => ({
            order_item_id: orderItem.id,
            product_extra_id: extra.id,
            price_at_order: extra.price,
          }));

          const { error: extrasError } = await supabase
            .from("order_item_extras")
            .insert(orderItemExtras);

          if (extrasError) throw extrasError;
        }
      }

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

      <ProductDetailDialog
        product={selectedProduct}
        extras={productExtras}
        open={showProductDialog}
        onClose={() => setShowProductDialog(false)}
        onAddToCart={addToCart}
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
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer"
                    onClick={() => product.available && handleProductClick(product)}
                  >
                    {product.image_url && (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-20 h-20 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">{product.name}</p>
                          {product.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
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
                {cart.map((item) => {
                  const extrasTotal = item.extras.reduce((sum, e) => sum + e.price, 0);
                  const itemTotal = (item.product.price + extrasTotal) * item.quantity;
                  
                  return (
                    <div
                      key={item.id}
                      className="flex items-start justify-between text-sm border-b pb-2"
                    >
                      <div className="flex-1">
                        <span className="font-medium">{item.product.name}</span>
                        {item.extras.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            + {item.extras.map(e => e.name).join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateQuantity(item.id, -1);
                          }}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-medium">
                          {item.quantity}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateQuantity(item.id, 1);
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <span className="w-20 text-right font-semibold">
                          R$ {itemTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
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

import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Receipt } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import CustomerInfoDialog from "@/components/menu/CustomerInfoDialog";
import ComandaTypeDialog from "@/components/menu/ComandaTypeDialog";
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
  logo_url: string | null;
  primary_color: string;
  is_open: boolean;
}


interface CartItemExtra {
  id: string;
  name: string;
  price: number;
}

interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  extras: CartItemExtra[];
  notes?: string;
}

// Componente memoizado para produtos individuais
const ProductCard = memo(({ 
  product, 
  restaurantColor, 
  onProductClick 
}: { 
  product: Product; 
  restaurantColor: string; 
  onProductClick: (product: Product) => void;
}) => (
  <Card
    className="cursor-pointer hover:shadow-md transition-shadow"
    onClick={() => product.available && onProductClick(product)}
  >
    <CardContent className="p-4">
      <div className="flex items-start gap-3">
        {product.image_url && (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-24 h-24 object-cover rounded"
            loading="lazy"
          />
        )}
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-lg">{product.name}</p>
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
          <p 
            className="text-xl font-bold mt-2"
            style={{ color: restaurantColor }}
          >
            R$ {product.price.toFixed(2)}
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
));
ProductCard.displayName = "ProductCard";

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
  const [showComandaTypeDialog, setShowComandaTypeDialog] = useState(false);
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [comandaType, setComandaType] = useState<'individual' | 'coletiva' | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productExtras, setProductExtras] = useState<ProductExtra[]>([]);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  useEffect(() => {
    // Verificar se já tem info do cliente no sessionStorage
    const savedName = sessionStorage.getItem(`customer_name_${tableNumber}`);
    const savedCPF = sessionStorage.getItem(`customer_cpf_${tableNumber}`);
    const savedType = sessionStorage.getItem(`comanda_type_${tableNumber}`) as 'individual' | 'coletiva' | null;
    
    // Carregar carrinho do sessionStorage
    const savedCart = sessionStorage.getItem(`cart_${tableNumber}`);
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
    
    if (savedName && savedCPF && savedType) {
      setCustomerName(savedName);
      setCustomerCPF(savedCPF);
      setComandaType(savedType);
      fetchData();
    } else {
      setShowComandaTypeDialog(true);
      fetchData();
    }
  }, [restaurantSlug, tableNumber]);

  useEffect(() => {
    // Salvar carrinho no sessionStorage sempre que mudar
    sessionStorage.setItem(`cart_${tableNumber}`, JSON.stringify(cart));
  }, [cart, tableNumber]);

  const fetchData = useCallback(async () => {
    if (!restaurantSlug || !tableNumber) return;
    
    try {
      // Buscar restaurante primeiro
      const restResult = await supabase
        .from("restaurants")
        .select("id, name, logo_url, primary_color, is_open")
        .eq("slug", restaurantSlug)
        .maybeSingle();

      if (restResult.error) throw restResult.error;
      const restData = restResult.data;

      if (!restData) {
        toast.error("Restaurante não encontrado");
        navigate("/");
        return;
      }

      if (!restData.is_open) {
        toast.error("Restaurante está fechado no momento");
        navigate("/");
        return;
      }

      setRestaurant(restData);

      // Agora buscar mesa e categorias DO RESTAURANTE ESPECÍFICO
      const [tableResult, categoriesResult] = await Promise.all([
        supabase
          .from("tables")
          .select("id")
          .eq("table_number", parseInt(tableNumber))
          .eq("restaurant_id", restData.id)
          .limit(1)
          .maybeSingle(),
        
        supabase
          .from("categories")
          .select("id, name, display_order, products(id, name, description, price, available, image_url)")
          .eq("restaurant_id", restData.id)
          .order("display_order")
      ]);

      // Filtrar categorias com produtos
      const filteredCategories = (categoriesResult.data || []).filter(
        (cat: any) => cat.products.some((p: any) => p)
      );
      setCategories(filteredCategories);
      
      if (filteredCategories.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(filteredCategories[0].id);
      }

      if (tableResult.error) throw tableResult.error;
      if (tableResult.data) {
        setTableId(tableResult.data.id);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar cardápio");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [restaurantSlug, tableNumber, navigate, selectedCategoryId]);

  const handleComandaTypeSelect = (type: 'individual' | 'coletiva') => {
    setComandaType(type);
    sessionStorage.setItem(`comanda_type_${tableNumber}`, type);
    setShowComandaTypeDialog(false);
    setShowCustomerDialog(true);
  };

  const handleCustomerInfoSubmit = (name: string, cpf: string) => {
    setCustomerName(name);
    setCustomerCPF(cpf);
    sessionStorage.setItem(`customer_name_${tableNumber}`, name);
    sessionStorage.setItem(`customer_cpf_${tableNumber}`, cpf);
    setShowCustomerDialog(false);
    toast.success("Bem-vindo! Faça seu pedido");
  };

  const handleProductClick = useCallback(async (product: Product) => {
    if (!customerName || !customerCPF) {
      setShowCustomerDialog(true);
      return;
    }

    // Buscar extras do produto apenas quando necessário
    const { data: extrasData } = await supabase
      .from("product_extras")
      .select("id, name, price")
      .eq("product_id", product.id);

    setSelectedProduct(product);
    setProductExtras(extrasData || []);
    setShowProductDialog(true);
  }, [customerName, customerCPF]);

  const addToCart = useCallback((product: Product, extras: ProductExtra[], notes?: string) => {
    setCart((prev) => {
      const existing = prev.find((item) => 
        item.product.id === product.id && 
        JSON.stringify(item.extras.map(e => e.id).sort()) === JSON.stringify(extras.map(e => e.id).sort()) &&
        item.notes === notes
      );
      
      if (existing) {
        return prev.map((item) =>
          item.id === existing.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      
      return [...prev, { 
        id: crypto.randomUUID(),
        product, 
        quantity: 1, 
        extras,
        notes 
      }];
    });
    
    const extrasText = extras.length > 0 ? ` com ${extras.length} adicional(is)` : '';
    toast.success(`${product.name}${extrasText} adicionado ao carrinho`);
  }, []);

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
  // Memoizar produtos da categoria selecionada
  const selectedCategoryProducts = useMemo(() => {
    return categories.find(cat => cat.id === selectedCategoryId)?.products || [];
  }, [categories, selectedCategoryId]);

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
      <ComandaTypeDialog
        open={showComandaTypeDialog}
        onSelect={handleComandaTypeSelect}
        restaurantColor={restaurant.primary_color}
      />

      <CustomerInfoDialog
        open={showCustomerDialog}
        onSubmit={handleCustomerInfoSubmit}
        restaurantColor={restaurant.primary_color}
        isColetiva={comandaType === 'coletiva'}
      />

      <ProductDetailDialog
        product={selectedProduct}
        extras={productExtras}
        open={showProductDialog}
        onClose={() => setShowProductDialog(false)}
        onAddToCart={addToCart}
        restaurantColor={restaurant.primary_color}
      />

      <div 
        className="min-h-screen bg-background pb-24"
        style={{
          // @ts-ignore
          '--primary': `${parseInt(restaurant.primary_color.slice(1,3), 16)} ${parseInt(restaurant.primary_color.slice(3,5), 16)} ${parseInt(restaurant.primary_color.slice(5,7), 16)}`,
        } as React.CSSProperties}
      >
        {/* Header + Categorias com fundo da cor primária */}
        <div 
          className="text-white shadow-lg pb-6"
          style={{ backgroundColor: restaurant.primary_color }}
        >
          {/* Header */}
          <div className="p-6">
            <div className="flex justify-center mb-2">
              {restaurant.logo_url ? (
                <img 
                  src={restaurant.logo_url} 
                  alt="Logo" 
                  className="h-20 w-auto object-contain"
                />
              ) : (
                <h1 className="text-2xl font-bold">{restaurant.name}</h1>
              )}
            </div>
            <p className="text-sm opacity-90 text-center">Mesa {tableNumber}</p>
            {customerName && (
              <p className="text-xs opacity-75 mt-1 text-center">Cliente: {customerName}</p>
            )}
          </div>

          {/* Categorias */}
          <div className="container mx-auto px-4">
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategoryId(category.id)}
                  className={`
                    whitespace-nowrap px-4 py-2.5 rounded-lg font-medium text-white
                    transition-all duration-200
                    ${selectedCategoryId === category.id 
                      ? 'bg-white/25 shadow-md' 
                      : 'hover:bg-white/10'
                    }
                  `}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Produtos da categoria selecionada */}
        <div className="container mx-auto px-4 pt-6 pb-6">
          <div className="space-y-4">
            {selectedCategoryProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                restaurantColor={restaurant.primary_color}
                onProductClick={handleProductClick}
              />
            ))}
          </div>
        </div>

        {/* Botão Fixo Ver Comanda com Badge */}
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t shadow-lg p-4">
          <div className="container mx-auto">
            <Button
              className="w-full relative text-white"
              size="lg"
              style={{ backgroundColor: restaurant.primary_color }}
              onClick={() => navigate(`/comanda/${restaurantSlug}/${tableNumber}`)}
            >
              <Receipt className="h-5 w-5 mr-2" />
              Ver Comanda
              {cart.length > 0 && (
                <Badge 
                  className="absolute -top-2 -right-2 h-6 w-6 flex items-center justify-center p-0 text-white"
                  style={{ backgroundColor: restaurant.primary_color, filter: 'brightness(0.8)' }}
                >
                  {cart.length}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Menu;

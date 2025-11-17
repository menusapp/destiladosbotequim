import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMenuInactivityLogout } from "@/hooks/useMenuInactivityLogout";

// Novos componentes de UI
import { MenuHeader } from "@/components/menu/MenuHeader";
import { RestaurantInfoCard } from "@/components/menu/RestaurantInfoCard";
import { FeaturedProducts } from "@/components/menu/FeaturedProducts";
import { CategoryProducts } from "@/components/menu/CategoryProducts";
import { CartBottomBar } from "@/components/menu/CartBottomBar";
import { CartDrawer } from "@/components/menu/CartDrawer";
import { ProductDetailDrawer } from "@/components/menu/ProductDetailDrawer";
import CustomerInfoDialog from "@/components/menu/CustomerInfoDialog";
import RestaurantClosedScreen from "@/components/menu/RestaurantClosedScreen";

// Types
import { Product, ProductExtra, Category, Restaurant, CartItem } from "@/types/menu";


const Menu = () => {
  const { restaurantSlug, tableNumber } = useParams();
  
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
  const [showCartDrawer, setShowCartDrawer] = useState(false);

  // Hook de logout por inatividade (1 hora)
  useMenuInactivityLogout(tableId, tableNumber, restaurantSlug);

  useEffect(() => {
    // Verificar se já tem info do cliente no sessionStorage
    const savedName = sessionStorage.getItem(`customer_name_${tableNumber}`);
    const savedCPF = sessionStorage.getItem(`customer_cpf_${tableNumber}`);
    
    if (savedName && savedCPF) {
      const savedCart = sessionStorage.getItem(`cart_${tableNumber}`);
      if (savedCart) {
        setCart(JSON.parse(savedCart));
      }
      setCustomerName(savedName);
      setCustomerCPF(savedCPF);
      fetchData();
    } else {
      sessionStorage.removeItem(`cart_${tableNumber}`);
      setCart([]);
      setShowCustomerDialog(true);
      fetchData();
    }

    // Configurar realtime
    const channel = supabase
      .channel('menu-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => fetchData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'restaurants' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantSlug, tableNumber, fetchData]);

  useEffect(() => {
    // Salvar carrinho no sessionStorage
    if (customerName && customerCPF) {
      sessionStorage.setItem(`cart_${tableNumber}`, JSON.stringify(cart));
    }
  }, [cart, tableNumber, customerName, customerCPF]);

  // Marcar mesa como ocupada
  useEffect(() => {
    const markTableOccupied = async () => {
      if (tableId && customerName && customerCPF) {
        try {
          const formattedCPF = customerCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
          await supabase
            .from("tables")
            .update({
              is_occupied: true,
              occupied_at: new Date().toISOString(),
              occupied_by: `${customerName} - ${formattedCPF}`
            })
            .eq("id", tableId);
        } catch (error) {
          console.error("Erro ao marcar mesa como ocupada:", error);
        }
      }
    };

    markTableOccupied();

    const handleBeforeUnload = async () => {
      if (tableId) {
        const { data: hasUnpaidBills } = await supabase
          .from("bills")
          .select("id")
          .eq("table_id", tableId)
          .neq("status", "paid")
          .limit(1);

        if (!hasUnpaidBills || hasUnpaidBills.length === 0) {
          await supabase
            .from("tables")
            .update({
              is_occupied: false,
              occupied_at: null,
              occupied_by: null
            })
            .eq("id", tableId);
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (tableId) {
        supabase
          .from("bills")
          .select("id")
          .eq("table_id", tableId)
          .neq("status", "paid")
          .limit(1)
          .then(({ data }) => {
            if (!data || data.length === 0) {
              supabase
                .from("tables")
                .update({
                  is_occupied: false,
                  occupied_at: null,
                  occupied_by: null
                })
                .eq("id", tableId);
            }
          });
      }
    };
  }, [tableId, customerName, customerCPF]);

  // Buscar dados do restaurante e menu
  const fetchData = useCallback(async () => {
    if (!restaurantSlug || !tableNumber) return;

    try {
      // Buscar restaurante
      const { data: restaurantData, error: restError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("slug", restaurantSlug)
        .single();

      if (restError) throw restError;
      setRestaurant(restaurantData);

      // Buscar mesa
      const { data: tableData, error: tableError } = await supabase
        .from("tables")
        .select("id")
        .eq("restaurant_id", restaurantData.id)
        .eq("table_number", parseInt(tableNumber))
        .single();

      if (tableError) throw tableError;
      setTableId(tableData.id);

      // Buscar categorias com produtos
      const { data: categoriesData, error: catError } = await supabase
        .from("categories")
        .select(`
          id,
          name,
          display_order,
          products (
            id,
            name,
            description,
            price,
            available,
            image_url
          )
        `)
        .eq("restaurant_id", restaurantData.id)
        .order("display_order");

      if (catError) throw catError;

      const sortedCategories = (categoriesData || [])
        .map((cat: any) => ({
          ...cat,
          products: (cat.products || []).sort((a: Product, b: Product) =>
            a.name.localeCompare(b.name)
          ),
        }))
        .filter((cat: Category) => cat.products.length > 0);

      setCategories(sortedCategories);
    } catch (error: any) {
      toast.error("Erro ao carregar dados");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [restaurantSlug, tableNumber]);

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
    toast.success(`${product.name}${extrasText} adicionado`);
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

  const clearCart = () => {
    setCart([]);
    toast.success("Carrinho limpo");
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => {
      const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
      return sum + (item.product.price + extrasTotal) * item.quantity;
    }, 0);
  };

  const getTotalItemCount = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  const handleViewCart = () => {
    setShowCartDrawer(true);
  };

  const handleContinueFromCart = () => {
    setShowCartDrawer(false);
    // Aqui você navegaria para a tela de comanda/pedido
    toast.info("Navegando para finalização...");
    // navigate(`/comanda/${restaurantSlug}/${tableNumber}`);
  };

  // Função para scroll suave até a categoria
  const scrollToCategory = (categoryId: string) => {
    const element = document.getElementById(`category-${categoryId}`);
    if (element) {
      const offset = 200; // Altura do header + categorias
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: 'smooth'
      });
    }
  };

  // Verificar se precisa mostrar indicador de scroll
  useEffect(() => {
    const checkScroll = () => {
      const container = document.getElementById('categories-scroll');
      if (container) {
        setShowScrollIndicator(container.scrollWidth > container.clientWidth);
      }
    };
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [categories]);

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

  // Se restaurante está fechado, mostrar tela de fechado
  if (!restaurant.is_open) {
    return (
      <RestaurantClosedScreen 
        restaurantName={restaurant.name}
        logoUrl={restaurant.logo_url}
        primaryColor={restaurant.primary_color}
      />
    );
  }

  return (
    <>
      <CustomerInfoDialog
        open={showCustomerDialog}
        onSubmit={handleCustomerInfoSubmit}
        restaurantColor={restaurant.primary_color}
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
      >
        {/* Header + Categorias com fundo da cor primária */}
        <div 
          className="text-white shadow-lg pb-3"
          style={{ backgroundColor: restaurant.primary_color }}
        >
          {/* Header */}
          <div className="p-4">
            <div className="flex justify-center mb-1">
              {restaurant.logo_url ? (
                <img 
                  src={restaurant.logo_url} 
                  alt="Logo" 
                  className="h-16 w-auto object-contain"
                />
              ) : (
                <h1 className="text-xl font-bold">{restaurant.name}</h1>
              )}
            </div>
            <p className="text-xs opacity-90 text-center">Mesa {tableNumber}</p>
            {customerName && (
              <p className="text-xs opacity-75 text-center">Cliente: {customerName}</p>
            )}
          </div>

          {/* Categorias */}
          <div className="container mx-auto px-4 relative">
            <div 
              id="categories-scroll"
              className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
            >
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => scrollToCategory(category.id)}
                  className="whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium text-white hover:bg-white/10 transition-all duration-200"
                >
                  {category.name}
                </button>
              ))}
            </div>
            {showScrollIndicator && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronRight className="h-4 w-4 text-white/60 animate-pulse" />
              </div>
            )}
          </div>
        </div>

        {/* Todas as categorias com seus produtos */}
        <div className="container mx-auto px-4 pt-4 pb-6">
          {categories.map((category) => (
            <div key={category.id} id={`category-${category.id}`} className="mb-8">
              <h2 className="text-2xl font-bold mb-4" style={{ color: restaurant.primary_color }}>
                {category.name}
              </h2>
              <div className="space-y-3">
                {category.products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    restaurantColor={restaurant.primary_color}
                    onProductClick={handleProductClick}
                  />
                ))}
              </div>
            </div>
          ))}
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

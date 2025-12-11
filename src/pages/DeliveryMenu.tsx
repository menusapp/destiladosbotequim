import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MenuHeader } from "@/components/menu/MenuHeader";
import { RestaurantInfoCard } from "@/components/menu/RestaurantInfoCard";
import { FeaturedProducts } from "@/components/menu/FeaturedProducts";
import { CategoryProducts } from "@/components/menu/CategoryProducts";
import { CartBottomBar } from "@/components/menu/CartBottomBar";
import { ProductDetailDrawer } from "@/components/menu/ProductDetailDrawer";
import { CheckoutDrawer } from "@/components/menu/CheckoutDrawer";
import CustomerInfoDialog from "@/components/menu/CustomerInfoDialog";
import RestaurantClosedScreen from "@/components/menu/RestaurantClosedScreen";
import { DeliveryBottomNav } from "@/components/menu/DeliveryBottomNav";
import { PedidosHistory } from "@/components/menu/PedidosHistory";
import { ProfileView } from "@/components/menu/ProfileView";
import { Product, Category, CartItem, ProductExtra } from "@/types/menu";
import { toast } from "sonner";

export default function DeliveryMenu() {
  const { restaurantSlug } = useParams<{ restaurantSlug: string }>();
  
  const [restaurant, setRestaurant] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productExtras, setProductExtras] = useState<ProductExtra[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const [customerCPF, setCustomerCPF] = useState("");
  const [showCustomerDialog, setShowCustomerDialog] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"menu" | "pedidos" | "perfil">("menu");

  const fetchRestaurantData = useCallback(async () => {
    try {
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("slug", restaurantSlug)
        .single();

      if (restaurantError) throw restaurantError;
      setRestaurant(restaurantData);

      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("*, products(*)")
        .eq("restaurant_id", restaurantData.id)
        .order("display_order");

      if (categoriesError) throw categoriesError;
      
      // Filtrar produtos em destaque para não aparecerem duplicados nas categorias
      const filteredCategories = (categoriesData || []).map((cat: any) => ({
        ...cat,
        products: (cat.products || []).filter((p: any) => p.available && !p.is_featured)
      })).filter((cat: any) => cat.products.length > 0);
      setCategories(filteredCategories);

      const { data: featuredData } = await supabase
        .from("products")
        .select("id, name, description, price, promotional_price, available, image_url, prep_time_minutes, is_featured, featured_display_order, categories!inner(restaurant_id)")
        .eq("categories.restaurant_id", restaurantData.id)
        .eq("is_featured", true)
        .eq("available", true)
        .order("featured_display_order");

      setFeaturedProducts(featuredData || []);
    } catch (error) {
      console.error("Error fetching restaurant:", error);
      toast.error("Erro ao carregar cardápio");
    } finally {
      setLoading(false);
    }
  }, [restaurantSlug]);

  const loadCustomerInfo = useCallback(() => {
    const storedName = sessionStorage.getItem(`delivery-customer-${restaurantSlug}`);
    const storedCPF = sessionStorage.getItem(`delivery-cpf-${restaurantSlug}`);
    if (storedName && storedCPF) {
      setCustomerName(storedName);
      setCustomerCPF(storedCPF);
    } else {
      setShowCustomerDialog(true);
    }
  }, [restaurantSlug]);

  const loadCartFromStorage = useCallback(() => {
    const stored = localStorage.getItem(`delivery-cart-${restaurantSlug}`);
    if (stored) {
      setCart(JSON.parse(stored));
    }
  }, [restaurantSlug]);

  useEffect(() => {
    if (restaurantSlug) {
      fetchRestaurantData();
      loadCartFromStorage();
      loadCustomerInfo();
    }
  }, [restaurantSlug, fetchRestaurantData, loadCartFromStorage, loadCustomerInfo]);

  useEffect(() => {
    saveCartToStorage();
  }, [cart]);

  // Realtime subscription para mudanças no restaurante e produtos
  useEffect(() => {
    if (!restaurantSlug) return;

    const channel = supabase
      .channel('delivery-menu-realtime')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'restaurants',
        filter: `slug=eq.${restaurantSlug}`
      }, (payload) => {
        console.log('🏪 Restaurante atualizado em tempo real!', payload);
        const updatedRestaurant = payload.new as any;
        
        setRestaurant((prev: any) => ({
          ...prev,
          ...updatedRestaurant
        }));
        
        if (!updatedRestaurant.is_open) {
          toast.info("O restaurante acabou de fechar! 🔒");
        } else {
          toast.success("O restaurante acabou de abrir! 🎉");
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'products'
      }, () => {
        console.log('Produtos atualizados! Recarregando...');
        fetchRestaurantData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantSlug, fetchRestaurantData]);

  // Realtime subscription para pedidos do cliente logado
  useEffect(() => {
    if (!customerCPF || !restaurant?.id) return;

    const ordersChannel = supabase
      .channel(`delivery-orders-${customerCPF}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `customer_cpf=eq.${customerCPF},restaurant_id=eq.${restaurant.id}`
      }, (payload) => {
        console.log('Pedido do cliente atualizado:', payload);
        
        const order = payload.new as any;
        if (payload.eventType === 'INSERT') {
          toast.success('Pedido enviado com sucesso!');
        } else if (payload.eventType === 'UPDATE' && order?.status) {
          const statusMessages: Record<string, string> = {
            accepted: '✅ Pedido aceito! Está sendo preparado.',
            out_for_delivery: order.delivery_type === 'pickup' 
              ? '📦 Pedido pronto para retirada!'
              : '🚚 Pedido saiu para entrega!',
            delivered: '🎉 Pedido entregue! Bom apetite!',
            picked_up: '📦 Pedido retirado! Bom apetite!',
          };
          
          if (statusMessages[order.status]) {
            toast.success(statusMessages[order.status]);
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
    };
  }, [customerCPF, restaurant?.id]);

  const handleCustomerInfoSubmit = (name: string, cpf?: string) => {
    setCustomerName(name);
    setCustomerCPF(cpf || "");
    sessionStorage.setItem(`delivery-customer-${restaurantSlug}`, name);
    sessionStorage.setItem(`delivery-cpf-${restaurantSlug}`, cpf || "");
    setShowCustomerDialog(false);
  };

  const handleNameUpdate = (name: string) => {
    setCustomerName(name);
    sessionStorage.setItem(`delivery-customer-${restaurantSlug}`, name);
  };

  const saveCartToStorage = () => {
    localStorage.setItem(`delivery-cart-${restaurantSlug}`, JSON.stringify(cart));
  };

  const handleProductClick = async (product: Product) => {
    // Buscar extras do produto incluindo campos de obrigatoriedade
    const { data: extrasData } = await supabase
      .from("product_extras")
      .select("id, name, price, is_required, min_selection, max_selection, extra_category_id")
      .eq("product_id", product.id);

    setProductExtras(extrasData || []);
    setSelectedProduct(product);
  };

  const handleAddToCart = (product: Product, selectedExtras: ProductExtra[], notes?: string, quantity?: number) => {
    const newItem: CartItem = {
      id: crypto.randomUUID(),
      product,
      quantity: quantity || 1,
      extras: selectedExtras,
      notes: notes || "",
    };

    setCart([...cart, newItem]);
    setSelectedProduct(null);
    toast.success("Item adicionado à sacola!");
  };

  const handleUpdateQuantity = (itemId: string, delta: number) => {
    setCart((prevCart) => {
      const updatedCart = prevCart
        .map((item) => {
          if (item.id === itemId) {
            const newQuantity = item.quantity + delta;
            return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
      return updatedCart;
    });
  };

  const handleClearCart = () => {
    setCart([]);
    toast.success("Sacola limpa");
  };

  const handleBulkAddToCart = (items: CartItem[]) => {
    setCart(prevCart => [...prevCart, ...items]);
    setActiveTab("menu");
    setCheckoutOpen(true);
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => {
      const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
      const effectivePrice = item.product.promotional_price ?? item.product.price;
      return sum + (effectivePrice + extrasTotal) * item.quantity;
    }, 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Restaurante não encontrado</h1>
          <p className="text-muted-foreground">Verifique o link e tente novamente</p>
        </div>
      </div>
    );
  }

  if (!restaurant.is_open) {
    return <RestaurantClosedScreen restaurantName={restaurant.name} logoUrl={restaurant.logo_url} primaryColor={restaurant.primary_color} />;
  }

  const primaryColor = restaurant.primary_color || "#fe9516";
  const allProducts = categories.flatMap((c) => c.products);

  // Filtrar produtos pela busca
  const filteredCategories = searchQuery.trim() 
    ? categories.map(cat => ({
        ...cat,
        products: cat.products.filter(p => 
          p.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(cat => cat.products.length > 0)
    : categories;

  const filteredProducts = searchQuery.trim()
    ? allProducts.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : allProducts;

  return (
    <div className="min-h-screen bg-background pb-14">
      {activeTab === "menu" && (
        <>
          <div className="relative">
            <div className="h-48 overflow-hidden relative">
              {restaurant.banner_url ? (
                <div
                  className="w-full h-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${restaurant.banner_url})` }}
                />
              ) : restaurant.logo_url ? (
                <div
                  className="w-full h-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${restaurant.logo_url})` }}
                />
              ) : (
                <div
                  className="w-full h-full"
                  style={{ backgroundColor: primaryColor }}
                />
              )}
            </div>

            <MenuHeader 
              searchOpen={searchOpen}
              searchQuery={searchQuery}
              onSearchClick={() => setSearchOpen(true)}
              onSearchChange={setSearchQuery}
              onSearchClose={() => {
                setSearchOpen(false);
                setSearchQuery("");
              }}
            />

            <RestaurantInfoCard
              restaurantId={restaurant.id}
              name={restaurant.name}
              logoUrl={restaurant.logo_url}
              primaryColor={primaryColor}
              tableInfo={customerName}
              deliveryTime={`${restaurant.prep_time_minutes || 50}-${(restaurant.prep_time_minutes || 50) + 10} min`}
              deliveryFee={0}
            />
          </div>

          {searchQuery.trim() ? (
            <div className="px-4 py-6">
              <h2 className="text-lg font-semibold mb-4">Resultados da busca</h2>
              {filteredProducts.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {filteredProducts.filter(p => p.available).map((product) => (
                    <div
                      key={product.id}
                      onClick={() => handleProductClick(product)}
                      className="bg-white rounded-2xl shadow-sm overflow-hidden cursor-pointer active:scale-95 transition-transform"
                    >
                      <div className="aspect-square bg-muted">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            Sem imagem
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <h3 className="font-semibold text-sm mb-1">{product.name}</h3>
                        <p className="text-lg font-bold" style={{ color: primaryColor }}>
                          R$ {product.price.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum produto encontrado para "{searchQuery}"
                </p>
              )}
            </div>
          ) : (
            <>
              {restaurant.featured_section_enabled && featuredProducts.length > 0 && (
                <FeaturedProducts
                  products={featuredProducts}
                  primaryColor={primaryColor}
                  onProductClick={handleProductClick}
                  title={restaurant.featured_section_title || "Destaques"}
                />
              )}

              <CategoryProducts
                categories={filteredCategories}
                primaryColor={primaryColor}
                onProductClick={handleProductClick}
              />
            </>
          )}

          {cart.length > 0 && (
            <CartBottomBar
              itemCount={cart.length}
              total={calculateTotal()}
              primaryColor={primaryColor}
              onViewCart={() => setCheckoutOpen(true)}
              label="Ver Sacola"
            />
          )}

          {selectedProduct && (
            <ProductDetailDrawer
              product={selectedProduct}
              extras={productExtras}
              open={!!selectedProduct}
              onClose={() => {
                setSelectedProduct(null);
                setProductExtras([]);
              }}
              onAddToCart={handleAddToCart}
              primaryColor={primaryColor}
              restaurantName={restaurant.name}
              restaurantLogo={restaurant.logo_url}
              deliveryTime={`${restaurant.prep_time_minutes || 50}-${(restaurant.prep_time_minutes || 50) + 10} min`}
            />
          )}

          <CheckoutDrawer
            open={checkoutOpen}
            onClose={() => setCheckoutOpen(false)}
            cart={cart}
            restaurant={restaurant}
            onUpdateQuantity={handleUpdateQuantity}
            onClearCart={handleClearCart}
            mode="delivery"
            restaurantSlug={restaurantSlug}
          />

          <CustomerInfoDialog
            open={showCustomerDialog}
            onClose={() => setShowCustomerDialog(false)}
            onSubmit={handleCustomerInfoSubmit}
            restaurantColor={primaryColor}
          />
        </>
      )}

      {activeTab === "pedidos" && customerCPF && (
        <div className="pt-4">
          <h1 className="text-2xl font-bold px-4 mb-4">Meus Pedidos</h1>
          <PedidosHistory
            customerCPF={customerCPF}
            restaurantId={restaurant.id}
            restaurantSlug={restaurantSlug || ""}
            onAddToCart={handleBulkAddToCart}
          />
        </div>
      )}

      {activeTab === "perfil" && customerCPF && (
        <div className="pt-4">
          <h1 className="text-2xl font-bold px-4 mb-4">Meu Perfil</h1>
          <ProfileView
            customerName={customerName}
            customerCPF={customerCPF}
            restaurantId={restaurant.id}
            onNameUpdate={handleNameUpdate}
          />
        </div>
      )}

      <DeliveryBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        primaryColor={primaryColor}
      />
    </div>
  );
}

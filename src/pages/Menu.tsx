import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMenuInactivityLogout } from "@/hooks/useMenuInactivityLogout";
import { MenuHeader } from "@/components/menu/MenuHeader";
import { RestaurantInfoCard } from "@/components/menu/RestaurantInfoCard";
import { FeaturedProducts } from "@/components/menu/FeaturedProducts";
import { CategoryProducts } from "@/components/menu/CategoryProducts";
import { CartBottomBar } from "@/components/menu/CartBottomBar";
import { CartDrawer } from "@/components/menu/CartDrawer";
import { ProductDetailDrawer } from "@/components/menu/ProductDetailDrawer";
import CustomerInfoDialog from "@/components/menu/CustomerInfoDialog";
import RestaurantClosedScreen from "@/components/menu/RestaurantClosedScreen";
import { Product, ProductExtra, Category, Restaurant, CartItem } from "@/types/menu";

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
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useMenuInactivityLogout(customerName, tableNumber || "", tableId);

  const fetchData = useCallback(async () => {
    if (!restaurantSlug || !tableNumber) return;
    try {
      const { data: restaurantData, error: restError } = await supabase
        .from("restaurants").select("id, name, slug, is_open, logo_url, banner_url, primary_color, prep_time_minutes, service_fee_enabled, service_fee_percentage").eq("slug", restaurantSlug).single();
      if (restError) throw restError;
      setRestaurant(restaurantData);

      const { data: tableData, error: tableError } = await supabase
        .from("tables").select("id")
        .eq("restaurant_id", restaurantData.id)
        .eq("table_number", parseInt(tableNumber)).single();
      if (tableError) throw tableError;
      setTableId(tableData.id);

      const { data: categoriesData, error: catError } = await supabase
        .from("categories").select("id, name, display_order, products(id, name, description, price, available, image_url)")
        .eq("restaurant_id", restaurantData.id).order("display_order");
      if (catError) throw catError;

      const sortedCategories = (categoriesData || [])
        .map((cat: any) => ({ ...cat, products: (cat.products || []).sort((a: Product, b: Product) => a.name.localeCompare(b.name)) }))
        .filter((cat: Category) => cat.products.length > 0);
      setCategories(sortedCategories);
    } catch (error: any) {
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [restaurantSlug, tableNumber]);

  useEffect(() => {
    const savedName = sessionStorage.getItem(`customer_name_${tableNumber}`);
    const savedCPF = sessionStorage.getItem(`customer_cpf_${tableNumber}`);
    if (savedName && savedCPF) {
      const savedCart = sessionStorage.getItem(`cart_${tableNumber}`);
      if (savedCart) setCart(JSON.parse(savedCart));
      setCustomerName(savedName);
      setCustomerCPF(savedCPF);
      fetchData();
    } else {
      sessionStorage.removeItem(`cart_${tableNumber}`);
      setCart([]);
      setShowCustomerDialog(true);
      fetchData();
    }
    const channel = supabase.channel('menu-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'restaurants' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData, restaurantSlug, tableNumber]);

  useEffect(() => {
    if (customerName && customerCPF) {
      sessionStorage.setItem(`cart_${tableNumber}`, JSON.stringify(cart));
    }
  }, [cart, tableNumber, customerName, customerCPF]);

  useEffect(() => {
    const markTableOccupied = async () => {
      if (tableId && customerName && customerCPF) {
        try {
          const formattedCPF = customerCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
          await supabase.from("tables").update({
            is_occupied: true,
            occupied_at: new Date().toISOString(),
            occupied_by: `${customerName} - ${formattedCPF}`
          }).eq("id", tableId);
        } catch (error) {
          console.error("Erro ao marcar mesa:", error);
        }
      }
    };
    markTableOccupied();

    const handleBeforeUnload = async () => {
      if (tableId) {
        const { data: hasUnpaidBills } = await supabase
          .from("bills").select("id").eq("table_id", tableId).neq("status", "paid").limit(1);
        if (!hasUnpaidBills || hasUnpaidBills.length === 0) {
          await supabase.from("tables").update({
            is_occupied: false,
            occupied_at: null,
            occupied_by: null
          }).eq("id", tableId);
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (tableId) {
        supabase.from("bills").select("id").eq("table_id", tableId).neq("status", "paid").limit(1)
          .then(({ data }) => {
            if (!data || data.length === 0) {
              supabase.from("tables").update({
                is_occupied: false,
                occupied_at: null,
                occupied_by: null
              }).eq("id", tableId);
            }
          });
      }
    };
  }, [tableId, customerName, customerCPF]);

  const handleCustomerInfoSubmit = (name: string, cpf: string) => {
    setCustomerName(name);
    setCustomerCPF(cpf);
    sessionStorage.setItem(`customer_name_${tableNumber}`, name);
    sessionStorage.setItem(`customer_cpf_${tableNumber}`, cpf);
    setShowCustomerDialog(false);
    toast.success("Bem-vindo!");
  };

  const handleProductClick = useCallback(async (product: Product) => {
    if (!customerName || !customerCPF) {
      setShowCustomerDialog(true);
      return;
    }
    const { data: extrasData } = await supabase.from("product_extras")
      .select("id, name, price").eq("product_id", product.id);
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
        return prev.map((item) => item.id === existing.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { id: crypto.randomUUID(), product, quantity: 1, extras, notes }];
    });
    toast.success(`${product.name} adicionado`);
  }, []);

  const updateQuantity = (itemId: string, delta: number) => {
    setCart((prev) => prev.map((item) => 
      item.id === itemId ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
    ).filter((item) => item.quantity > 0));
  };

  const getCartTotal = () => cart.reduce((sum, item) => {
    const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
    return sum + (item.product.price + extrasTotal) * item.quantity;
  }, 0);

  const getTotalItemCount = () => cart.reduce((sum, item) => sum + item.quantity, 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  if (restaurant && !restaurant.is_open) {
    return (
      <RestaurantClosedScreen 
        restaurantName={restaurant.name}
        logoUrl={restaurant.logo_url}
        primaryColor={restaurant.primary_color || "#fe9516"}
      />
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Restaurante não encontrado</p>
      </div>
    );
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
    <div className="min-h-screen bg-background pb-32">
      <div className="relative">
        <div className="h-48 overflow-hidden">
          {restaurant.banner_url ? (
            <div
              className="w-full h-full bg-cover bg-center blur-lg scale-110"
              style={{ backgroundImage: `url(${restaurant.banner_url})` }}
            />
          ) : restaurant.logo_url ? (
            <div
              className="w-full h-full bg-cover bg-center blur-lg scale-110"
              style={{ backgroundImage: `url(${restaurant.logo_url})` }}
            />
          ) : (
            <div
              className="w-full h-full blur-lg scale-110"
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
          name={restaurant.name}
          logoUrl={restaurant.logo_url}
          primaryColor={primaryColor}
          tableInfo={`Mesa ${tableNumber}`}
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
          <FeaturedProducts
            products={allProducts.filter(p => p.available)}
            primaryColor={primaryColor}
            onProductClick={handleProductClick}
          />

          <CategoryProducts
            categories={filteredCategories}
            primaryColor={primaryColor}
            onProductClick={handleProductClick}
          />
        </>
      )}

      <CartBottomBar
        itemCount={getTotalItemCount()}
        total={getCartTotal()}
        primaryColor={primaryColor}
        onViewCart={() => setShowCartDrawer(true)}
        label="Ver comanda"
      />

      <CustomerInfoDialog
        open={showCustomerDialog}
        onClose={() => setShowCustomerDialog(false)}
        onSubmit={handleCustomerInfoSubmit}
        restaurantColor={primaryColor}
      />

      <ProductDetailDrawer
        product={selectedProduct}
        extras={productExtras}
        open={showProductDialog}
        onClose={() => {
          setShowProductDialog(false);
          setSelectedProduct(null);
        }}
        onAddToCart={addToCart}
        restaurantName={restaurant.name}
        restaurantLogo={restaurant.logo_url}
        primaryColor={primaryColor}
        deliveryTime={`${restaurant.prep_time_minutes || 50}-${(restaurant.prep_time_minutes || 50) + 10} min`}
        deliveryFee={0}
      />

      <CartDrawer
        open={showCartDrawer}
        onClose={() => setShowCartDrawer(false)}
        items={cart}
        restaurantName={restaurant.name}
        restaurantLogo={restaurant.logo_url}
        primaryColor={primaryColor}
        onUpdateQuantity={updateQuantity}
        onClearCart={() => {
          setCart([]);
          toast.success("Comanda limpa");
        }}
        onAddMoreItems={() => setShowCartDrawer(false)}
        onContinue={() => {
          setShowCartDrawer(false);
          navigate(`/comanda/${restaurantSlug}/${tableNumber}`);
        }}
        mode="local"
      />
    </div>
  );
};

export default Menu;

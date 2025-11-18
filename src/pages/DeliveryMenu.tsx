import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MenuHeader } from "@/components/menu/MenuHeader";
import { FeaturedProducts } from "@/components/menu/FeaturedProducts";
import { CategoryProducts } from "@/components/menu/CategoryProducts";
import { CartBottomBar } from "@/components/menu/CartBottomBar";
import { ProductDetailDrawer } from "@/components/menu/ProductDetailDrawer";
import { CheckoutDrawer } from "@/components/menu/CheckoutDrawer";
import RestaurantClosedScreen from "@/components/menu/RestaurantClosedScreen";
import { Product, Category, CartItem, ProductExtra } from "@/types/menu";
import { toast } from "sonner";

export default function DeliveryMenu() {
  const { restaurantSlug } = useParams<{ restaurantSlug: string }>();
  const navigate = useNavigate();
  
  const [restaurant, setRestaurant] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (restaurantSlug) {
      fetchRestaurantData();
      loadCartFromStorage();
    }
  }, [restaurantSlug]);

  useEffect(() => {
    saveCartToStorage();
  }, [cart]);

  const fetchRestaurantData = async () => {
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
      setCategories(categoriesData || []);

      const { data: featuredData } = await supabase
        .from("products")
        .select("*, categories(restaurant_id)")
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
  };

  const loadCartFromStorage = () => {
    const stored = localStorage.getItem(`delivery-cart-${restaurantSlug}`);
    if (stored) {
      setCart(JSON.parse(stored));
    }
  };

  const saveCartToStorage = () => {
    localStorage.setItem(`delivery-cart-${restaurantSlug}`, JSON.stringify(cart));
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

  const calculateTotal = () => {
    return cart.reduce((sum, item) => {
      const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
      return sum + (item.product.price + extrasTotal) * item.quantity;
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
    return <RestaurantClosedScreen restaurantName={restaurant.name} primaryColor={restaurant.primary_color} />;
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <MenuHeader showSearch={false} />

      <div className="px-4">
        {restaurant.featured_section_enabled && featuredProducts.length > 0 && (
          <FeaturedProducts
            title={restaurant.featured_section_title}
            products={featuredProducts}
            primaryColor={restaurant.primary_color}
            onProductClick={setSelectedProduct}
          />
        )}

        <CategoryProducts
          categories={categories}
          primaryColor={restaurant.primary_color}
          onProductClick={setSelectedProduct}
        />
      </div>

      <CartBottomBar
        itemCount={cart.length}
        total={calculateTotal()}
        primaryColor={restaurant.primary_color}
        onViewCart={() => setCheckoutOpen(true)}
        label="Ver Sacola"
      />

      {selectedProduct && (
        <ProductDetailDrawer
          product={selectedProduct}
          open={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
          primaryColor={restaurant.primary_color}
          extras={[]}
          restaurantName={restaurant.name}
          restaurantLogo={restaurant.logo_url}
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
      />
    </div>
  );
}

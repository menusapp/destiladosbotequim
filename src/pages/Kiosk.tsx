import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { resolveSlug } from "@/lib/slugResolver";
import { supabase } from "@/integrations/supabase/client";
import { Product, Category, CartItem, ProductExtra } from "@/types/menu";
import { toast } from "@/components/ui/sonner";
import { useKioskConfig } from "@/hooks/useKioskConfig";
import { KioskIdleScreen } from "@/components/kiosk/KioskIdleScreen";
import { KioskIdentification } from "@/components/kiosk/KioskIdentification";
import { KioskMenu } from "@/components/kiosk/KioskMenu";
import { KioskProductDetail } from "@/components/kiosk/KioskProductDetail";
import { KioskCart } from "@/components/kiosk/KioskCart";
import { KioskConsumptionType } from "@/components/kiosk/KioskConsumptionType";
import { KioskPayment } from "@/components/kiosk/KioskPayment";
import { KioskConfirmation } from "@/components/kiosk/KioskConfirmation";
import { KioskLayout } from "@/components/kiosk/KioskLayout";

export type KioskStep = "idle" | "identification" | "menu" | "product" | "cart" | "consumption" | "payment" | "confirmation";

export interface KioskCustomer {
  name: string;
  cpf: string;
  phone?: string;
  isExisting: boolean;
}

export default function Kiosk() {
  const { slug: pathSlug } = useParams<{ slug: string }>();
  const slug = resolveSlug(pathSlug);
  const [step, setStep] = useState<KioskStep>("idle");
  const [restaurant, setRestaurant] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustomer] = useState<KioskCustomer | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productExtras, setProductExtras] = useState<ProductExtra[]>([]);
  const [consumptionType, setConsumptionType] = useState<"dine_in" | "takeaway">("dine_in");
  const [tableNumber, setTableNumber] = useState<string>("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [kioskDisabled, setKioskDisabled] = useState(false);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch kiosk config after restaurant is loaded
  const { config: kioskConfig, loading: configLoading } = useKioskConfig(restaurant?.id || null);

  const timeoutMs = (kioskConfig?.inactivity_timeout_seconds || 120) * 1000;

  const resetSession = useCallback(() => {
    setStep("idle");
    setCart([]);
    setCustomer(null);
    setSelectedProduct(null);
    setProductExtras([]);
    setConsumptionType("dine_in");
    setTableNumber("");
    setOrderId(null);
  }, []);

  // Inactivity timer
  const resetInactivityTimer = useCallback(() => {
    if (step === "idle" || step === "confirmation") return;
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      toast.info("Sessão encerrada por inatividade");
      resetSession();
    }, timeoutMs);
  }, [step, resetSession, timeoutMs]);

  useEffect(() => {
    const events = ["touchstart", "mousedown", "keydown", "scroll"];
    const handler = () => resetInactivityTimer();
    events.forEach(e => document.addEventListener(e, handler, { passive: true }));
    resetInactivityTimer();
    return () => {
      events.forEach(e => document.removeEventListener(e, handler));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [resetInactivityTimer]);

  // Fetch restaurant + categories
  const fetchData = useCallback(async () => {
    console.log("[Kiosk] slug bruto (pathParam):", pathSlug, "| slug resolvido:", slug);
    if (!slug) {
      console.warn("[Kiosk] Slug ausente ou inválido — abortando bootstrap");
      setLoading(false);
      return;
    }
    try {
      const { data: r, error } = await supabase
        .from("restaurants")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      if (!r) {
        console.warn("[Kiosk] Nenhum restaurante encontrado para slug:", slug);
        toast.error("Restaurante não encontrado");
        setLoading(false);
        return;
      }
      setRestaurant(r);

      // Check if kiosk is enabled
      const { data: kConf } = await supabase
        .from("kiosk_config")
        .select("enabled")
        .eq("restaurant_id", r.id)
        .maybeSingle();

      if (kConf && !kConf.enabled) {
        console.log("[Kiosk] Totem desativado para restaurante:", r.id);
        setKioskDisabled(true);
        setLoading(false);
        return;
      }

      const { data: cats, error: catsErr } = await supabase
        .from("categories")
        .select("*, products(*)")
        .eq("restaurant_id", r.id)
        .order("display_order");

      if (catsErr) console.error("[Kiosk] Erro ao carregar categorias:", catsErr);

      const filtered = (cats || []).map((cat: any) => ({
        ...cat,
        products: (cat.products || []).filter((p: any) => p.available),
      })).filter((cat: any) => cat.products.length > 0);
      setCategories(filtered);
    } catch (err) {
      console.error("[Kiosk] Erro crítico no bootstrap:", err);
      toast.error("Erro ao carregar dados do restaurante");
    } finally {
      setLoading(false);
    }
  }, [slug, pathSlug]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Product extras loader
  const openProduct = useCallback(async (product: Product) => {
    setSelectedProduct(product);
    try {
      const { data, error } = await supabase
        .from("product_extras")
        .select("*")
        .eq("product_id", product.id);
      if (error) {
        console.error("[Kiosk] Erro ao carregar extras:", error);
      }
      setProductExtras(data || []);
    } catch (err) {
      console.error("[Kiosk] Exceção ao carregar extras:", err);
      setProductExtras([]);
    }
    setStep("product");
  }, []);

  const addToCart = useCallback((product: Product, extras: ProductExtra[], notes?: string, quantity?: number) => {
    const newItem: CartItem = {
      id: `kiosk-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      product,
      quantity: quantity || 1,
      extras: extras.map(e => ({ id: e.id, name: e.name, price: e.price })),
      notes,
    };
    setCart(prev => [...prev, newItem]);
    setStep("menu");
    toast.success(`${product.name} adicionado!`);
  }, []);

  const updateQuantity = useCallback((itemId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const newQty = item.quantity + delta;
      return newQty <= 0 ? null : { ...item, quantity: newQty };
    }).filter(Boolean) as CartItem[]);
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setCart(prev => prev.filter(i => i.id !== itemId));
  }, []);

  const cartTotal = cart.reduce((sum, item) => {
    const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
    const price = item.product.promotional_price ?? item.product.price;
    return sum + (price + extrasTotal) * item.quantity;
  }, 0);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const primaryColor = restaurant?.primary_color || "#FF6B35";

  // Determine which consumption types are available
  const handleStartOrder = () => {
    if (kioskConfig?.require_cpf === false) {
      // Skip identification, go straight to menu
      setCustomer({ name: "Cliente", cpf: "", isExisting: false });
      setStep("menu");
    } else {
      setStep("identification");
    }
  };

  if (loading || configLoading) {
    return (
      <KioskLayout primaryColor={primaryColor}>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-t-transparent" style={{ borderColor: primaryColor, borderTopColor: "transparent" }} />
        </div>
      </KioskLayout>
    );
  }

  if (!restaurant) {
    const isSlugMissing = !slug;
    return (
      <KioskLayout primaryColor={primaryColor}>
        <div className="flex flex-col items-center justify-center h-screen gap-4 px-8 text-center">
          <p className="text-6xl">{isSlugMissing ? "⚠️" : "🔍"}</p>
          <h2 className="text-2xl font-bold text-foreground">
            {isSlugMissing ? "Link do totem inválido" : "Restaurante não encontrado"}
          </h2>
          <p className="text-lg text-muted-foreground">
            {isSlugMissing
              ? "O endereço acessado não contém a identificação do restaurante."
              : "Verifique o endereço e tente novamente."}
          </p>
        </div>
      </KioskLayout>
    );
  }

  if (kioskDisabled) {
    return (
      <KioskLayout primaryColor={primaryColor}>
        <div className="flex flex-col items-center justify-center h-screen gap-4 px-8 text-center">
          <p className="text-6xl">🚫</p>
          <h2 className="text-2xl font-bold text-foreground">Totem indisponível no momento</h2>
          <p className="text-lg text-muted-foreground">O autoatendimento deste estabelecimento está desativado.</p>
        </div>
      </KioskLayout>
    );
  }

  return (
    <KioskLayout primaryColor={primaryColor}>
      {step === "idle" && (
        <KioskIdleScreen
          restaurant={restaurant}
          onStart={handleStartOrder}
        />
      )}

      {step === "identification" && (
        <KioskIdentification
          restaurant={restaurant}
          onIdentified={(c) => { setCustomer(c); setStep("menu"); }}
          onBack={() => setStep("idle")}
        />
      )}

      {step === "menu" && (
        <KioskMenu
          categories={categories}
          primaryColor={primaryColor}
          onSelectProduct={openProduct}
          cartCount={cartCount}
          cartTotal={cartTotal}
          onOpenCart={() => setStep("cart")}
          customerName={customer?.name || ""}
          onCancel={resetSession}
        />
      )}

      {step === "product" && selectedProduct && (
        <KioskProductDetail
          product={selectedProduct}
          extras={productExtras}
          primaryColor={primaryColor}
          onAdd={addToCart}
          onBack={() => setStep("menu")}
        />
      )}

      {step === "cart" && (
        <KioskCart
          cart={cart}
          primaryColor={primaryColor}
          onUpdateQuantity={updateQuantity}
          onRemove={removeItem}
          cartTotal={cartTotal}
          onBack={() => setStep("menu")}
          onNext={() => setStep("consumption")}
        />
      )}

      {step === "consumption" && (
        <KioskConsumptionType
          primaryColor={primaryColor}
          consumptionType={consumptionType}
          tableNumber={tableNumber}
          onChangeType={setConsumptionType}
          onChangeTable={setTableNumber}
          onBack={() => setStep("cart")}
          onNext={() => setStep("payment")}
          kioskConfig={kioskConfig}
        />
      )}

      {step === "payment" && (
        <KioskPayment
          cart={cart}
          restaurant={restaurant}
          customer={customer!}
          consumptionType={consumptionType}
          tableNumber={tableNumber}
          primaryColor={primaryColor}
          cartTotal={cartTotal}
          onBack={() => setStep("consumption")}
          onOrderCreated={(id) => { setOrderId(id); setStep("confirmation"); }}
          kioskConfig={kioskConfig}
        />
      )}

      {step === "confirmation" && (
        <KioskConfirmation
          orderId={orderId}
          primaryColor={primaryColor}
          onNewOrder={resetSession}
        />
      )}
    </KioskLayout>
  );
}

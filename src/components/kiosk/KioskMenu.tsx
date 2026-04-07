import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Category, Product } from "@/types/menu";
import { Search, ShoppingCart, X, LogOut, Star, UtensilsCrossed } from "lucide-react";
import { isFeaturedVisible } from "@/lib/featuredUtils";

interface Props {
  categories: Category[];
  primaryColor: string;
  onSelectProduct: (product: Product) => void;
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
  customerName: string;
  onCancel: () => void;
  restaurant?: any;
}

export function KioskMenu({ categories, primaryColor, onSelectProduct, cartCount, cartTotal, onOpenCart, customerName, onCancel, restaurant }: Props) {
  const featuredProducts = useMemo(() => {
    return categories.flatMap(c => c.products).filter(p => p.is_featured || p.promotional_price != null);
  }, [categories]);

  const featuredSectionTitle = restaurant?.featured_section_title || "Destaques";
  const hasFeatured = featuredProducts.length > 0;

  const [activeCategory, setActiveCategory] = useState<string>(hasFeatured ? "__featured__" : (categories[0]?.id || ""));
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const scrollToCategory = (catId: string) => {
    setActiveCategory(catId);
    const el = document.getElementById(`kiosk-cat-${catId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const allProducts = categories.flatMap(c => c.products);
  const filteredProducts = searchQuery
    ? allProducts.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top Banner */}
      {restaurant?.banner_url && (
        <div className="relative w-full h-36 md:h-44 overflow-hidden shrink-0">
          <img src={restaurant.banner_url} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
          <div className="absolute bottom-3 left-4 flex items-center gap-3">
            {restaurant?.logo_url && (
              <img src={restaurant.logo_url} alt={restaurant.name} className="h-14 w-14 rounded-xl object-contain bg-white/90 p-1 shadow-lg" />
            )}
            <div>
              <h1 className="text-white font-bold text-xl md:text-2xl drop-shadow-lg">{restaurant?.name}</h1>
              <p className="text-white/80 text-sm drop-shadow">Faça seu pedido</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b bg-card shrink-0">
        <div className="flex items-center gap-3">
          {!restaurant?.banner_url && restaurant?.logo_url && (
            <img src={restaurant.logo_url} alt={restaurant.name} className="h-10 w-10 rounded-lg object-contain" />
          )}
          <Button variant="ghost" size="icon" onClick={onCancel} className="h-10 w-10 rounded-full text-muted-foreground">
            <LogOut className="h-5 w-5" />
          </Button>
          <span className="text-base font-medium text-foreground">Olá, <span className="font-bold">{customerName}</span>!</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSearchOpen(!searchOpen)} className="h-10 w-10 rounded-full">
          {searchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
        </Button>
      </div>

      {searchOpen && (
        <div className="px-4 md:px-6 py-3 border-b bg-card shrink-0">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar produto..."
            className="h-12 text-lg rounded-xl"
            autoFocus
          />
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Categories sidebar */}
        {!filteredProducts && (
          <ScrollArea className="w-44 md:w-52 border-r bg-card/50 shrink-0">
            <div className="flex flex-col p-2 gap-1.5">
              {hasFeatured && (
                <button
                  onClick={() => scrollToCategory("__featured__")}
                  className={`text-left rounded-xl text-sm font-medium transition-all flex flex-col items-center gap-1.5 p-2 ${
                    activeCategory === "__featured__"
                      ? "text-white shadow-md"
                      : "text-foreground hover:bg-muted"
                  }`}
                  style={activeCategory === "__featured__" ? { backgroundColor: primaryColor } : {}}
                >
                  <div className="h-14 w-full rounded-lg flex items-center justify-center bg-black/5">
                    <Star className="h-6 w-6 shrink-0" />
                  </div>
                  <span className="line-clamp-2 text-center text-xs">{featuredSectionTitle}</span>
                </button>
              )}
              {categories.map(cat => {
                const catImageUrl = (cat as any).image_url;
                return (
                  <button
                    key={cat.id}
                    onClick={() => scrollToCategory(cat.id)}
                    className={`text-left rounded-xl text-sm font-medium transition-all flex flex-col items-center gap-1.5 p-2 ${
                      activeCategory === cat.id
                        ? "text-white shadow-md"
                        : "text-foreground hover:bg-muted"
                    }`}
                    style={activeCategory === cat.id ? { backgroundColor: primaryColor } : {}}
                  >
                    {catImageUrl ? (
                      <div className="h-14 w-full rounded-lg overflow-hidden">
                        <img src={catImageUrl} alt="" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="h-14 w-full rounded-lg flex items-center justify-center bg-black/5">
                        <UtensilsCrossed className="h-6 w-6 shrink-0 text-muted-foreground" />
                      </div>
                    )}
                    <span className="line-clamp-2 text-center text-xs">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Products grid */}
        <ScrollArea className="flex-1">
          <div className="p-4 md:p-6">
            {filteredProducts ? (
              <>
                <h3 className="text-lg font-bold mb-4 text-foreground">Resultados para "{searchQuery}"</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                  {filteredProducts.map(p => (
                    <KioskProductCard key={p.id} product={p} primaryColor={primaryColor} onSelect={onSelectProduct} />
                  ))}
                </div>
                {filteredProducts.length === 0 && <p className="text-center text-muted-foreground text-lg py-12">Nenhum produto encontrado</p>}
              </>
            ) : (
              <>
                {/* Featured Section */}
                {hasFeatured && (
                  <div id="kiosk-cat-__featured__" className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                      <Star className="h-6 w-6" style={{ color: primaryColor }} />
                      <h3 className="text-xl md:text-2xl font-bold text-foreground">{featuredSectionTitle}</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                      {featuredProducts.map(p => (
                        <KioskProductCard key={p.id} product={p} primaryColor={primaryColor} onSelect={onSelectProduct} />
                      ))}
                    </div>
                  </div>
                )}
                {categories.map(cat => (
                  <div key={cat.id} id={`kiosk-cat-${cat.id}`} className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                      {(cat as any).image_url && (
                        <img src={(cat as any).image_url} alt="" className="h-10 w-10 rounded-xl object-cover" />
                      )}
                      <h3 className="text-xl md:text-2xl font-bold text-foreground">{cat.name}</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                      {cat.products.map(p => (
                        <KioskProductCard key={p.id} product={p} primaryColor={primaryColor} onSelect={onSelectProduct} />
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Cart FAB — rectangular with label and total */}
      {cartCount > 0 && (
        <button
          onClick={onOpenCart}
          className="fixed bottom-6 right-6 z-50 h-14 rounded-2xl flex items-center gap-2.5 px-5 text-white shadow-2xl transition-transform active:scale-95"
          style={{ backgroundColor: primaryColor }}
        >
          <div className="relative">
            <ShoppingCart className="h-6 w-6" />
            <span className="absolute -top-2 -right-2.5 bg-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center" style={{ color: primaryColor }}>
              {cartCount}
            </span>
          </div>
          <span className="font-bold text-base">Carrinho</span>
          {cartTotal > 0 && (
            <span className="font-bold text-base">R$ {cartTotal.toFixed(2)}</span>
          )}
        </button>
      )}
    </div>
  );
}

function KioskProductCard({ product, primaryColor, onSelect }: { product: Product; primaryColor: string; onSelect: (p: Product) => void }) {
  const effectivePrice = product.promotional_price ?? product.price;

  return (
    <button
      onClick={() => onSelect(product)}
      className="flex flex-col bg-card rounded-2xl border overflow-hidden text-left transition-all hover:shadow-xl active:scale-[0.97] group"
    >
      {product.image_url ? (
        <div className="relative w-full aspect-[4/3] overflow-hidden">
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          {product.promotional_price != null && (
            <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              PROMO
            </span>
          )}
        </div>
      ) : (
        <div className="w-full aspect-[4/3] bg-muted flex items-center justify-center">
          <span className="text-4xl">🍽️</span>
        </div>
      )}
      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <span className="font-semibold text-sm md:text-base line-clamp-2 text-foreground leading-tight">{product.name}</span>
        {product.description && (
          <span className="text-xs text-muted-foreground line-clamp-1">{product.description}</span>
        )}
        <div className="flex items-center gap-2 mt-auto pt-1">
          {product.promotional_price != null && (
            <span className="text-xs line-through text-muted-foreground">R$ {product.price.toFixed(2)}</span>
          )}
          <span className="font-bold text-base" style={{ color: primaryColor }}>R$ {effectivePrice.toFixed(2)}</span>
        </div>
      </div>
    </button>
  );
}

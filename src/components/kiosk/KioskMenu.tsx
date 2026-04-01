import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Category, Product } from "@/types/menu";
import { Search, ShoppingCart, X, LogOut } from "lucide-react";

interface Props {
  categories: Category[];
  primaryColor: string;
  onSelectProduct: (product: Product) => void;
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
  customerName: string;
  onCancel: () => void;
}

export function KioskMenu({ categories, primaryColor, onSelectProduct, cartCount, cartTotal, onOpenCart, customerName, onCancel }: Props) {
  const [activeCategory, setActiveCategory] = useState<string>(categories[0]?.id || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

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
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onCancel} className="h-12 w-12 rounded-full text-muted-foreground">
            <LogOut className="h-6 w-6" />
          </Button>
          <span className="text-lg font-medium text-foreground">Olá, {customerName}!</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSearchOpen(!searchOpen)} className="h-12 w-12 rounded-full">
            {searchOpen ? <X className="h-6 w-6" /> : <Search className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {searchOpen && (
        <div className="px-6 py-3 border-b bg-card">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar produto..."
            className="h-12 text-lg"
            autoFocus
          />
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Categories sidebar */}
        {!filteredProducts && (
          <ScrollArea className="w-48 md:w-56 border-r bg-card shrink-0">
            <div className="flex flex-col p-2 gap-1">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => scrollToCategory(cat.id)}
                  className={`text-left px-4 py-4 rounded-xl text-base font-medium transition-colors ${
                    activeCategory === cat.id
                      ? "text-white"
                      : "text-foreground hover:bg-muted"
                  }`}
                  style={activeCategory === cat.id ? { backgroundColor: primaryColor } : {}}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Products grid */}
        <ScrollArea className="flex-1" ref={contentRef}>
          <div className="p-4 md:p-6">
            {filteredProducts ? (
              <>
                <h3 className="text-xl font-bold mb-4 text-foreground">Resultados para "{searchQuery}"</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filteredProducts.map(p => (
                    <ProductCard key={p.id} product={p} primaryColor={primaryColor} onSelect={onSelectProduct} />
                  ))}
                </div>
                {filteredProducts.length === 0 && <p className="text-center text-muted-foreground text-lg py-12">Nenhum produto encontrado</p>}
              </>
            ) : (
              categories.map(cat => (
                <div key={cat.id} id={`kiosk-cat-${cat.id}`} className="mb-8">
                  <h3 className="text-xl md:text-2xl font-bold mb-4 text-foreground">{cat.name}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {cat.products.map(p => (
                      <ProductCard key={p.id} product={p} primaryColor={primaryColor} onSelect={onSelectProduct} />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Cart FAB */}
      {cartCount > 0 && (
        <button
          onClick={onOpenCart}
          className="fixed bottom-6 right-6 flex items-center gap-3 px-8 py-5 rounded-2xl text-white text-xl font-bold shadow-2xl z-50 transition-transform active:scale-95"
          style={{ backgroundColor: primaryColor }}
        >
          <ShoppingCart className="h-7 w-7" />
          <span>{cartCount} {cartCount === 1 ? "item" : "itens"}</span>
          <span className="mx-2">•</span>
          <span>R$ {cartTotal.toFixed(2)}</span>
        </button>
      )}
    </div>
  );
}

function ProductCard({ product, primaryColor, onSelect }: { product: Product; primaryColor: string; onSelect: (p: Product) => void }) {
  const effectivePrice = product.promotional_price ?? product.price;

  return (
    <button
      onClick={() => onSelect(product)}
      className="flex flex-col bg-card rounded-xl border overflow-hidden text-left transition-shadow hover:shadow-lg active:scale-[0.98]"
    >
      {product.image_url ? (
        <img src={product.image_url} alt={product.name} className="w-full aspect-square object-cover" />
      ) : (
        <div className="w-full aspect-square bg-muted flex items-center justify-center">
          <span className="text-4xl">🍽️</span>
        </div>
      )}
      <div className="p-3 flex flex-col gap-1">
        <span className="font-semibold text-sm md:text-base line-clamp-2 text-foreground">{product.name}</span>
        <div className="flex items-center gap-2">
          {product.promotional_price != null && (
            <span className="text-xs line-through text-muted-foreground">R$ {product.price.toFixed(2)}</span>
          )}
          <span className="font-bold text-base" style={{ color: primaryColor }}>R$ {effectivePrice.toFixed(2)}</span>
        </div>
      </div>
    </button>
  );
}

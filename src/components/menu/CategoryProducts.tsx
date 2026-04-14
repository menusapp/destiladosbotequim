import { memo, useState, useEffect, useRef } from "react";
import { Product, Category } from "@/types/menu";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CategoryProductsProps {
  categories: Category[];
  primaryColor: string;
  onProductClick: (product: Product) => void;
  showNav?: boolean;
}

export const CategoryProducts = memo(({
  categories,
  primaryColor,
  onProductClick,
  showNav = true,
}: CategoryProductsProps) => {
  const [activeCategory, setActiveCategory] = useState<string | null>(categories[0]?.id ?? null);
  const isManualScroll = useRef(false);
  const navContainerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleCategoryClick = (categoryId: string) => {
    setActiveCategory(categoryId);
    isManualScroll.current = true;
    const el = document.getElementById(`category-${categoryId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setTimeout(() => { isManualScroll.current = false; }, 1000);
  };

  // Scroll spy via IntersectionObserver
  useEffect(() => {
    if (categories.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isManualScroll.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id.replace("category-", "");
            setActiveCategory(id);
          }
        }
      },
      { threshold: 0.15, rootMargin: "-80px 0px -60% 0px" }
    );

    categories.forEach((cat) => {
      const el = document.getElementById(`category-${cat.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [categories]);

  // Auto-scroll nav pill into view
  useEffect(() => {
    if (activeCategory && buttonRefs.current[activeCategory]) {
      buttonRefs.current[activeCategory]?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeCategory]);

  return (
    <div className="pb-32">
      {/* Horizontal scrolling category nav */}
      {showNav && categories.length > 0 && (
        <div
          ref={navContainerRef}
          className="sticky top-0 z-30 bg-background border-b border-border px-3 py-3 my-1 flex gap-1.5 overflow-x-auto category-scroll-bar"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <style>{`.category-scroll-bar::-webkit-scrollbar { display: none; }`}</style>
          {categories.map((cat) => (
            <button
              key={cat.id}
              ref={(el) => { buttonRefs.current[cat.id] = el; }}
              onClick={() => handleCategoryClick(cat.id)}
              className="flex-shrink-0 px-3 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap"
              style={
                activeCategory === cat.id
                  ? { backgroundColor: primaryColor, color: "#fff" }
                  : { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }
              }
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      <div className="px-4">
      {categories.map((category) => (
        <div key={category.id} id={`category-${category.id}`} className="mb-8">
          <h3 className="text-xl font-bold text-foreground mb-3">{category.name}</h3>
          <div className="space-y-3">
            {category.products.map((product) => (
              <Card
                key={product.id}
                className="cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
                onClick={() => product.available && onProductClick(product)}
              >
                <div className="p-4">
                  <div className="flex gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h4 className="font-bold text-base text-foreground">
                          {product.name}
                        </h4>
                        {!product.available && (
                          <Badge variant="secondary" className="flex-shrink-0 text-xs">
                            Indisponível
                          </Badge>
                        )}
                      </div>
                      {product.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {product.description}
                        </p>
                      )}
                      {product.promotional_price ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground line-through">
                            R$ {product.price.toFixed(2)}
                          </span>
                          <span
                            className="text-lg font-bold"
                            style={{ color: primaryColor }}
                          >
                            R$ {product.promotional_price.toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <p
                          className="text-lg font-bold"
                          style={{ color: primaryColor }}
                        >
                          R$ {product.price.toFixed(2)}
                        </p>
                      )}
                    </div>
                    {product.image_url && (
                      <div className="flex-shrink-0">
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-28 h-28 object-cover rounded-xl"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ))}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.categories === nextProps.categories &&
    prevProps.primaryColor === nextProps.primaryColor
  );
});

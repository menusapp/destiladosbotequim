import { memo, useState } from "react";
import { Product, Category } from "@/types/menu";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CategoryProductsProps {
  categories: Category[];
  primaryColor: string;
  onProductClick: (product: Product) => void;
}

export const CategoryProducts = memo(({
  categories,
  primaryColor,
  onProductClick,
}: CategoryProductsProps) => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const handleCategoryClick = (categoryId: string) => {
    setActiveCategory(categoryId);
    const el = document.getElementById(`category-${categoryId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="pb-32">
      {/* Horizontal scrolling category nav */}
      {categories.length > 0 && (
        <div
          className="sticky top-0 z-30 bg-background border-b border-border px-4 py-2 flex gap-2 overflow-x-auto"
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
              onClick={() => handleCategoryClick(cat.id)}
              className="flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap"
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
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.categories === nextProps.categories &&
    prevProps.primaryColor === nextProps.primaryColor
  );
});

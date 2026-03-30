import { memo, useState } from "react";
import { Category } from "@/types/menu";

interface CategoryNavProps {
  categories: Category[];
  primaryColor: string;
}

export const CategoryNav = memo(({ categories, primaryColor }: CategoryNavProps) => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const handleCategoryClick = (categoryId: string) => {
    setActiveCategory(categoryId);
    const el = document.getElementById(`category-${categoryId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (categories.length === 0) return null;

  return (
    <div
      className="sticky top-0 z-30 bg-background border-b border-border px-3 py-1.5 flex gap-1.5 overflow-x-auto category-scroll-bar"
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
          className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap"
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
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.categories === nextProps.categories &&
    prevProps.primaryColor === nextProps.primaryColor
  );
});

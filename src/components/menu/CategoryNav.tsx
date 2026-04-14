import { memo, useState, useEffect, useRef } from "react";
import { Category } from "@/types/menu";

interface CategoryNavProps {
  categories: Category[];
  primaryColor: string;
}

export const CategoryNav = memo(({ categories, primaryColor }: CategoryNavProps) => {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const isManualScroll = useRef(false);
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

  if (categories.length === 0) return null;

  return (
    <div
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
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.categories === nextProps.categories &&
    prevProps.primaryColor === nextProps.primaryColor
  );
});

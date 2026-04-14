import { memo, useState, useEffect, useRef, useCallback } from "react";
import { Category } from "@/types/menu";

interface CategoryNavProps {
  categories: Category[];
  primaryColor: string;
}

const FALLBACK_HEADER_HEIGHT = 72;

export const CategoryNav = memo(({ categories, primaryColor }: CategoryNavProps) => {
  const [activeCategory, setActiveCategory] = useState<string | null>(categories[0]?.id ?? null);
  const isManualScroll = useRef(false);
  const navRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const getScrollOffset = useCallback(() => {
    const headerHeight =
      (document.querySelector("[data-menu-header]") as HTMLElement | null)?.offsetHeight ??
      FALLBACK_HEADER_HEIGHT;
    const navHeight = navRef.current?.offsetHeight ?? 0;

    return headerHeight + navHeight + 12;
  }, []);

  const updateActiveCategory = useCallback(() => {
    if (categories.length === 0 || isManualScroll.current) return;

    const sections = categories
      .map((cat) => {
        const el = document.getElementById(`category-${cat.id}`);
        if (!el) return null;

        return {
          id: cat.id,
          top: el.getBoundingClientRect().top + window.scrollY,
        };
      })
      .filter((section): section is { id: string; top: number } => section !== null);

    if (sections.length === 0) return;

    const currentLine = window.scrollY + getScrollOffset();
    let nextActive = sections[0].id;

    for (const section of sections) {
      if (section.top <= currentLine) {
        nextActive = section.id;
      } else {
        break;
      }
    }

    const isNearBottom =
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;

    if (isNearBottom) {
      nextActive = sections[sections.length - 1].id;
    }

    setActiveCategory((current) => (current === nextActive ? current : nextActive));
  }, [categories, getScrollOffset]);

  useEffect(() => {
    setActiveCategory(categories[0]?.id ?? null);
  }, [categories]);

  const handleCategoryClick = useCallback(
    (categoryId: string) => {
      setActiveCategory(categoryId);
      isManualScroll.current = true;

      const el = document.getElementById(`category-${categoryId}`);
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - getScrollOffset();
        window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
      }

      window.setTimeout(() => {
        isManualScroll.current = false;
        updateActiveCategory();
      }, 700);
    },
    [getScrollOffset, updateActiveCategory]
  );

  useEffect(() => {
    updateActiveCategory();

    let ticking = false;

    const handlePositionChange = () => {
      if (ticking) return;

      ticking = true;
      window.requestAnimationFrame(() => {
        updateActiveCategory();
        ticking = false;
      });
    };

    window.addEventListener("scroll", handlePositionChange, { passive: true });
    window.addEventListener("resize", handlePositionChange);

    return () => {
      window.removeEventListener("scroll", handlePositionChange);
      window.removeEventListener("resize", handlePositionChange);
    };
  }, [updateActiveCategory]);

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
      ref={navRef}
      className="sticky z-40 bg-background border-b border-border px-3 py-3 flex gap-1.5 overflow-x-auto category-scroll-bar my-0"
      style={{
        top: `${FALLBACK_HEADER_HEIGHT}px`,
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <style>{`.category-scroll-bar::-webkit-scrollbar { display: none; }`}</style>
      {categories.map((cat) => (
        <button
          key={cat.id}
          ref={(el) => {
            buttonRefs.current[cat.id] = el;
          }}
          onClick={() => handleCategoryClick(cat.id)}
          className="flex-shrink-0 font-medium transition-colors whitespace-nowrap text-sm px-[12px] rounded-lg py-[14px]"
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

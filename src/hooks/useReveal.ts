import { useEffect, useRef, useState } from "react";

/**
 * Reveal on scroll — adiciona `isVisible=true` quando o elemento entra na
 * viewport (uma vez). Base para animações de entrada suaves e fluidas.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(
  options?: { threshold?: number; rootMargin?: string; once?: boolean }
) {
  const ref = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const { threshold = 0.15, rootMargin = "0px 0px -10% 0px", once = true } = options || {};

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respeita quem prefere menos animação: revela direto.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            setIsVisible(false);
          }
        });
      },
      { threshold, rootMargin }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, once]);

  return { ref, isVisible };
}

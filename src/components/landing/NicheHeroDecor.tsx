import { ReactNode } from "react";

interface FloatingEmoji {
  emoji: string;
  className: string; // positioning + animation
  size?: string; // text size
  rotate?: string;
}

interface NicheHeroDecorProps {
  emojis: FloatingEmoji[];
  bgPatternEmoji?: string;
  /** CSS keyframes block (without <style> tag) */
  keyframes: string;
  /** Optional gradient overlay over the hero (CSS background value) */
  gradientOverlay?: string;
}

/**
 * Decorative layer for niche landing-page heroes.
 * Renders inside an absolute pointer-events-none container so it doesn't
 * interfere with clicks on real CTAs above it.
 */
export const NicheHeroDecor = ({
  emojis,
  bgPatternEmoji,
  keyframes,
  gradientOverlay,
}: NicheHeroDecorProps) => {
  return (
    <>
      {gradientOverlay && (
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{ background: gradientOverlay }}
          aria-hidden
        />
      )}

      {bgPatternEmoji && (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04] hidden sm:block select-none"
          aria-hidden
          style={{
            backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80' viewBox='0 0 80 80'><text x='10' y='55' font-size='48'>${bgPatternEmoji}</text></svg>")`,
            backgroundRepeat: "repeat",
            backgroundSize: "80px 80px",
          }}
        />
      )}

      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {emojis.map((e, i) => (
          <span
            key={i}
            className={`absolute select-none ${e.size ?? "text-5xl sm:text-6xl"} ${e.className}`}
            style={{ filter: "drop-shadow(0 8px 20px rgba(0,0,0,0.18))" }}
          >
            {e.emoji}
          </span>
        ))}
      </div>

      <style>{keyframes}</style>
    </>
  );
};

interface NicheBadgeProps {
  children: ReactNode;
  bgClass: string; // e.g. "bg-amber-500/15 text-amber-700 border-amber-500/30"
}

export const NicheBadge = ({ children, bgClass }: NicheBadgeProps) => (
  <div
    className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-8 border ${bgClass}`}
  >
    {children}
  </div>
);

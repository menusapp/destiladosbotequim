import { ReactNode } from "react";

interface NicheCard {
  emoji: string;
  title: string;
  desc: string;
}

interface NicheExtraSectionProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  cards: NicheCard[];
  /** Section background (Tailwind class OR style.background value) */
  bgClass?: string;
  bgStyle?: string;
  /** Card visual treatment */
  cardClass?: string;
  /** Title color class */
  titleClass?: string;
  /** Subtitle / body color class */
  textClass?: string;
}

/**
 * Niche-exclusive marketing section with 3 emoji-led cards.
 * Inserted between Depoimentos and Simulador on each niche landing page.
 */
export const NicheExtraSection = ({
  eyebrow,
  title,
  subtitle,
  cards,
  bgClass = "bg-card",
  bgStyle,
  cardClass = "bg-background border-border",
  titleClass = "text-foreground",
  textClass = "text-muted-foreground",
}: NicheExtraSectionProps) => {
  return (
    <section
      className={`py-16 sm:py-20 relative overflow-hidden ${bgClass}`}
      style={bgStyle ? { background: bgStyle } : undefined}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          {eyebrow && (
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mb-3 ${cardClass}`}>
              {eyebrow}
            </span>
          )}
          <h2 className={`text-3xl sm:text-4xl font-extrabold tracking-[-0.025em] ${titleClass}`}>
            {title}
          </h2>
          {subtitle && (
            <p className={`mt-3 text-lg max-w-2xl mx-auto ${textClass}`}>{subtitle}</p>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {cards.map((c, i) => (
            <div
              key={i}
              className={`p-6 rounded-2xl border hover:-translate-y-1 transition-transform ${cardClass}`}
            >
              <div className="text-5xl mb-4">{c.emoji}</div>
              <h3 className={`text-lg font-bold mb-2 ${titleClass}`}>{c.title}</h3>
              <p className={`text-sm leading-relaxed ${textClass}`}>{c.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

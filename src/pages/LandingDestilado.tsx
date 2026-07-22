import { useEffect, useRef, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ESTABLISHMENT } from "@/config/establishment";
import { useReveal } from "@/hooks/useReveal";
import { Flame, Wine, Users, Instagram, MapPin, ArrowRight, ChevronDown } from "lucide-react";

/* Paleta da marca (sempre a mesma, independente do tema claro/escuro) */
const C = {
  greenDeep: "#0f2c1e",
  green: "#1f4d33",
  greenSoft: "#2c6144",
  cream: "#f4ecd6",
  creamSoft: "#efe6cd",
  gold: "#c9a24b",
  ink: "#16241c",
};

interface Prod {
  id: string;
  name: string;
  price: number;
  promotional_price: number | null;
  image_url: string | null;
}

const INSTAGRAM_URL = "https://www.instagram.com/destiladobotequim/";
const brl = (n: number) => `R$ ${Number(n || 0).toFixed(2).replace(".", ",")}`;

/* Folha botânica (eco do monograma da logo) */
const Leaf = ({ className = "", style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 64 64" className={className} style={style} fill="none" aria-hidden>
    <path
      d="M32 4C18 12 8 26 8 42c0 10 6 18 6 18s10-4 18-14C42 34 46 18 32 4Z"
      stroke="currentColor" strokeWidth="1.5" opacity="0.9"
    />
    <path d="M32 8C30 24 24 40 15 58" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
  </svg>
);

/* Wrapper de reveal on-scroll */
function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const { ref, isVisible } = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`reveal ${isVisible ? "is-visible" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

const LandingDestilado = () => {
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [products, setProducts] = useState<Prod[]>([]);
  const [navSolid, setNavSolid] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const heroContentRef = useRef<HTMLDivElement>(null);
  const heroGlowRef = useRef<HTMLDivElement>(null);
  const reelWrapRef = useRef<HTMLDivElement>(null);
  const reelTrackRef = useRef<HTMLDivElement>(null);

  const goOrder = () => navigate("/cardapio");
  const goReserve = () => navigate(`/${ESTABLISHMENT.slug}/reservas`);

  /* Dados reais do estabelecimento */
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: rest } = await supabase
          .from("restaurants").select("*").eq("slug", ESTABLISHMENT.slug).maybeSingle();
        if (!active || !rest) return;
        setRestaurant(rest);
        const { data: prods } = await supabase
          .from("products")
          .select("id, name, price, promotional_price, image_url, is_featured")
          .eq("restaurant_id", rest.id)
          .eq("available", true)
          .order("is_featured", { ascending: false })
          .limit(14);
        if (active && prods) setProducts(prods as Prod[]);
      } catch {
        /* landing degrada com placeholders */
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setReduceMotion(!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  }, []);

  /* Scroll: nav sólido + parallax do hero + galeria horizontal */
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY || 0;
        setNavSolid((prev) => (y > 60 ? (prev ? prev : true) : (prev ? false : prev)));

        if (!reduceMotion) {
          if (heroContentRef.current) {
            const p = Math.min(y / (window.innerHeight || 1), 1);
            heroContentRef.current.style.transform = `translate3d(0, ${y * 0.28}px, 0)`;
            heroContentRef.current.style.opacity = String(Math.max(1 - p * 1.25, 0));
          }
          if (heroGlowRef.current) {
            heroGlowRef.current.style.transform = `translate3d(0, ${y * 0.14}px, 0) scale(${1 + y * 0.0004})`;
          }
          const wrap = reelWrapRef.current, track = reelTrackRef.current;
          if (wrap && track) {
            const rect = wrap.getBoundingClientRect();
            const vh = window.innerHeight || 1;
            const total = wrap.offsetHeight - vh;
            const scrolled = Math.min(Math.max(-rect.top, 0), Math.max(total, 0));
            const progress = total > 0 ? scrolled / total : 0;
            const maxX = Math.max(track.scrollWidth - window.innerWidth, 0);
            track.style.transform = `translate3d(${-progress * maxX}px, 0, 0)`;
          }
        }
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [reduceMotion, products.length]);

  const logo = restaurant?.logo_url as string | undefined;
  const banner = (restaurant?.banner_url || restaurant?.cover_url) as string | undefined;
  const address = (restaurant?.store_address || restaurant?.address) as string | undefined;
  const reelCards = products.length ? products : [];
  // altura do "pin" proporcional à quantidade de cartões
  const reelHeight = `${120 + Math.max(reelCards.length || 4, 4) * 26}vh`;

  const pillar = (icon: ReactNode, title: string, text: string, delay: number) => (
    <Reveal delay={delay} className="flex-1">
      <div className="flex flex-col items-center text-center px-6">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "rgba(201,162,75,0.12)", color: C.gold }}>
          {icon}
        </div>
        <h3 className="font-display text-2xl mb-2" style={{ color: C.cream }}>{title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: "rgba(244,236,214,0.7)" }}>{text}</p>
      </div>
    </Reveal>
  );

  return (
    <div style={{ background: C.cream, color: C.ink }} className="overflow-x-hidden">
      {/* ===== NAV ===== */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
        style={{
          background: navSolid ? "rgba(15,44,30,0.92)" : "transparent",
          backdropFilter: navSolid ? "saturate(140%) blur(10px)" : "none",
          borderBottom: navSolid ? "1px solid rgba(201,162,75,0.18)" : "1px solid transparent",
        }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="flex items-center gap-3">
            {logo ? (
              <img src={logo} alt={ESTABLISHMENT.name} className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <span className="font-display text-xl tracking-tight" style={{ color: C.cream }}>DB</span>
            )}
            <span className="font-display text-lg tracking-wide" style={{ color: C.cream }}>
              {restaurant?.name || ESTABLISHMENT.name}
            </span>
          </button>
          <div className="flex items-center gap-6">
            <button onClick={goReserve} className="hidden text-sm font-medium tracking-wide sm:block" style={{ color: "rgba(244,236,214,0.85)" }}>
              Reservas
            </button>
            <button
              onClick={goOrder}
              className="rounded-full px-5 py-2.5 text-sm font-semibold transition-transform hover:scale-[1.03]"
              style={{ background: C.gold, color: C.greenDeep }}
            >
              Fazer Pedido
            </button>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <header className="grain relative flex h-[100svh] min-h-[620px] items-center justify-center overflow-hidden"
        style={{ background: `radial-gradient(120% 90% at 50% -10%, ${C.greenSoft} 0%, ${C.green} 38%, ${C.greenDeep} 100%)` }}>
        {/* brilho/luz de fundo */}
        <div ref={heroGlowRef} className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(50% 40% at 50% 30%, rgba(201,162,75,0.20) 0%, transparent 70%)` }} />
        {banner && (
          <div className="pointer-events-none absolute inset-0 opacity-25"
            style={{ backgroundImage: `url(${banner})`, backgroundSize: "cover", backgroundPosition: "center", filter: "saturate(0.8)" }} />
        )}
        {/* folhas flutuantes */}
        <Leaf className="db-float absolute left-[8%] top-[18%] h-16 w-16" style={{ color: "rgba(201,162,75,0.35)", ["--rot" as any]: "-18deg" }} />
        <Leaf className="db-float absolute right-[10%] top-[24%] h-20 w-20" style={{ color: "rgba(244,236,214,0.18)", ["--rot" as any]: "24deg", animationDelay: "1.5s" }} />
        <Leaf className="db-float absolute bottom-[16%] left-[16%] h-12 w-12" style={{ color: "rgba(244,236,214,0.14)", ["--rot" as any]: "8deg", animationDelay: "0.8s" }} />

        <div ref={heroContentRef} className="relative z-10 mx-auto max-w-3xl px-6 text-center">
          {logo && <img src={logo} alt="" className="mx-auto mb-6 h-24 w-24 rounded-full object-cover ring-1 ring-white/20" />}
          <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.42em]" style={{ color: C.gold }}>
            Cozinha · Boteco · Destilaria
          </p>
          <h1 className="font-display text-5xl leading-[0.98] sm:text-7xl" style={{ color: C.cream }}>
            {restaurant?.name || "Destilado Botequim"}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed sm:text-lg" style={{ color: "rgba(244,236,214,0.82)" }}>
            Puxe uma cadeira. Aqui a brasa é lenta, o copo é cheio e a mesa é pra ficar.
            Comida de boteco de verdade, com alma e sem pressa.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button onClick={goOrder}
              className="group flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold transition-transform hover:scale-[1.03]"
              style={{ background: C.gold, color: C.greenDeep }}>
              Fazer Pedido
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
            <button onClick={goReserve}
              className="rounded-full border px-7 py-3.5 text-base font-semibold transition-colors"
              style={{ borderColor: "rgba(244,236,214,0.4)", color: C.cream }}>
              Reservar Mesa
            </button>
          </div>
        </div>

        <div className="db-scroll-cue absolute bottom-7 left-1/2 -translate-x-1/2" style={{ color: "rgba(244,236,214,0.6)" }}>
          <ChevronDown className="h-6 w-6" />
        </div>
      </header>

      {/* ===== MANIFESTO ===== */}
      <section className="relative px-6 py-28 sm:py-36" style={{ background: C.cream }}>
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <span className="mb-6 inline-block text-[11px] font-semibold uppercase tracking-[0.4em]" style={{ color: C.green }}>
              A casa
            </span>
          </Reveal>
          <Reveal delay={80}>
            <p className="font-display text-3xl leading-snug sm:text-[2.6rem]" style={{ color: C.ink }}>
              Um botequim é feito de <em style={{ color: C.green }}>encontro</em>. De conversa que
              atravessa a noite, petisco que chega quente e destilado que aquece a prosa.
            </p>
          </Reveal>
          <Reveal delay={160}>
            <div className="mx-auto mt-10 h-px w-24" style={{ background: C.gold }} />
          </Reveal>
        </div>
      </section>

      {/* ===== GALERIA HORIZONTAL (pratos reais) ===== */}
      {reduceMotion ? (
        <section className="py-20" style={{ background: C.greenDeep }}>
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="font-display text-4xl mb-8" style={{ color: C.cream }}>Da nossa cozinha</h2>
            <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide" style={{ scrollSnapType: "x mandatory" }}>
              {(reelCards.length ? reelCards : Array.from({ length: 5 })).map((p: any, i) => (
                <ReelCard key={p?.id || i} product={p} />
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section ref={reelWrapRef} className="relative" style={{ height: reelHeight, background: C.greenDeep }}>
          <div className="grain sticky top-0 flex h-[100svh] flex-col justify-center overflow-hidden">
            <div className="mx-auto mb-10 w-full max-w-6xl px-6">
              <Reveal>
                <span className="text-[11px] font-semibold uppercase tracking-[0.4em]" style={{ color: C.gold }}>O balcão</span>
                <h2 className="font-display text-4xl sm:text-6xl" style={{ color: C.cream }}>Da nossa cozinha</h2>
              </Reveal>
            </div>
            <div ref={reelTrackRef} className="flex items-stretch gap-6 pl-[6vw] pr-[40vw] will-change-transform" style={{ width: "max-content" }}>
              {(reelCards.length ? reelCards : Array.from({ length: 6 })).map((p: any, i) => (
                <ReelCard key={p?.id || i} product={p} />
              ))}
            </div>
            <p className="mx-auto mt-8 w-full max-w-6xl px-6 text-xs" style={{ color: "rgba(244,236,214,0.5)" }}>
              role para ver o cardápio passar →
            </p>
          </div>
        </section>
      )}

      {/* ===== AMBIENTE ===== */}
      <section className="relative overflow-hidden px-6 py-28" style={{ background: C.green }}>
        <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
          <Reveal>
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl" style={{ background: C.greenDeep }}>
              {banner ? (
                <img src={banner} alt="Ambiente do Destilado Botequim" className="h-full w-full object-cover" />
              ) : (
                <div className="grain flex h-full w-full items-center justify-center">
                  <Leaf className="h-24 w-24" style={{ color: "rgba(201,162,75,0.4)" }} />
                </div>
              )}
              <div className="pointer-events-none absolute inset-0 ring-1 ring-inset" style={{ borderColor: "rgba(201,162,75,0.3)" }} />
            </div>
          </Reveal>
          <div>
            <Reveal>
              <span className="text-[11px] font-semibold uppercase tracking-[0.4em]" style={{ color: C.gold }}>O ambiente</span>
            </Reveal>
            <Reveal delay={80}>
              <h2 className="mt-4 font-display text-4xl sm:text-5xl" style={{ color: C.cream }}>
                Onde o boteco vira memória
              </h2>
            </Reveal>
            <Reveal delay={140}>
              <p className="mt-6 text-base leading-relaxed" style={{ color: "rgba(244,236,214,0.78)" }}>
                Luz baixa, madeira, música na medida e aquele cheiro de comida na brasa. Cada canto
                foi pensado pra você sentar e não querer mais ir embora. Vem pra mesa — a casa é sua.
              </p>
            </Reveal>
            <Reveal delay={200}>
              <button onClick={goReserve}
                className="mt-8 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold"
                style={{ background: C.gold, color: C.greenDeep }}>
                Reservar uma mesa <ArrowRight className="h-4 w-4" />
              </button>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===== PILARES ===== */}
      <section className="px-6 py-24" style={{ background: C.greenDeep }}>
        <div className="mx-auto flex max-w-5xl flex-col gap-14 md:flex-row md:gap-6">
          {pillar(<Flame className="h-7 w-7" />, "Cozinha de brasa", "Petiscos e porções no ponto certo do fogo, do jeito que boteco bom faz.", 0)}
          {pillar(<Wine className="h-7 w-7" />, "Destilados & drinks", "Cachaças selecionadas e coquetéis autorais pra acompanhar a prosa.", 120)}
          {pillar(<Users className="h-7 w-7" />, "Boteco de verdade", "Atendimento que te conhece pelo nome. Aqui todo mundo é de casa.", 240)}
        </div>
      </section>

      {/* ===== VISITE ===== */}
      <section className="px-6 py-28" style={{ background: C.cream }}>
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <span className="text-[11px] font-semibold uppercase tracking-[0.4em]" style={{ color: C.green }}>Visite</span>
            <h2 className="mt-4 font-display text-4xl sm:text-5xl" style={{ color: C.ink }}>Bora pro botequim?</h2>
          </Reveal>
          {address && (
            <Reveal delay={80}>
              <p className="mt-6 inline-flex items-center gap-2 text-base" style={{ color: C.green }}>
                <MapPin className="h-4 w-4" /> {address}
              </p>
            </Reveal>
          )}
          <Reveal delay={140}>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <button onClick={goOrder} className="rounded-full px-8 py-3.5 text-base font-semibold" style={{ background: C.green, color: C.cream }}>
                Fazer Pedido
              </button>
              <button onClick={goReserve} className="rounded-full border px-8 py-3.5 text-base font-semibold" style={{ borderColor: C.green, color: C.green }}>
                Reservar Mesa
              </button>
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-base font-semibold" style={{ color: C.green }}>
                <Instagram className="h-5 w-5" /> @destiladobotequim
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="px-6 py-14" style={{ background: C.greenDeep }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-3">
            {logo ? (
              <img src={logo} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <Leaf className="h-8 w-8" style={{ color: C.gold }} />
            )}
            <span className="font-display text-lg" style={{ color: C.cream }}>{restaurant?.name || ESTABLISHMENT.name}</span>
          </div>
          <div className="flex items-center gap-6 text-sm" style={{ color: "rgba(244,236,214,0.6)" }}>
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:opacity-100" style={{ opacity: 0.8 }}>
              <Instagram className="h-4 w-4" /> Instagram
            </a>
            <button onClick={() => navigate("/login")} className="hover:opacity-100" style={{ opacity: 0.5 }}>
              Área da equipe
            </button>
          </div>
        </div>
        <p className="mx-auto mt-8 max-w-6xl text-center text-xs" style={{ color: "rgba(244,236,214,0.35)" }}>
          © {ESTABLISHMENT.name}
        </p>
      </footer>
    </div>
  );
};

/* Cartão da galeria de pratos (foto real ou placeholder elegante) */
function ReelCard({ product }: { product?: Prod }) {
  const price = product ? (product.promotional_price ?? product.price) : null;
  return (
    <div className="w-[68vw] max-w-[340px] shrink-0 sm:w-[340px]">
      <div className="relative aspect-[3/4] overflow-hidden rounded-2xl" style={{ background: "#16382a" }}>
        {product?.image_url ? (
          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover transition-transform duration-700 hover:scale-105" />
        ) : (
          <div className="grain flex h-full w-full flex-col items-center justify-center gap-3">
            <Leaf className="h-14 w-14" style={{ color: "rgba(201,162,75,0.5)" }} />
            <span className="text-xs uppercase tracking-[0.3em]" style={{ color: "rgba(244,236,214,0.5)" }}>
              {product?.name || "Em breve"}
            </span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3"
          style={{ background: "linear-gradient(to top, rgba(15,44,30,0.92), transparent)" }} />
        {product && (
          <div className="absolute inset-x-0 bottom-0 p-5">
            <h3 className="font-display text-xl leading-tight" style={{ color: C.cream }}>{product.name}</h3>
            {price != null && (
              <p className="mt-1 text-sm font-semibold" style={{ color: C.gold }}>{brl(price)}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default LandingDestilado;

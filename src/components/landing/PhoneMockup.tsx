import { Sparkles, MessageSquare } from "lucide-react";
import demoCover from "@/assets/demo-cover.jpg";
import demoLogo from "@/assets/demo-logo.png";
import demoBurger from "@/assets/demo-burger.jpg";
import demoSmash from "@/assets/demo-smash.jpg";
import demoPizza from "@/assets/demo-pizza.jpg";
import demoAcai from "@/assets/demo-acai.jpg";
import demoLimonada from "@/assets/demo-limonada.jpg";

const items = [
  { name: "Burger Artesanal", desc: "Blend de angus 180g, cheddar, bacon crocante.", price: "R$32,90", img: demoBurger },
  { name: "Smash Burger Duplo", desc: "Dois blends smash, cheddar e cebola caramelizada.", price: "R$38,90", img: demoSmash },
  { name: "Pizza Margherita", desc: "San Marzano, mozzarella de búfala, manjericão.", price: "R$40,50", img: demoPizza },
  { name: "Açaí Premium 500ml", desc: "Açaí puro, granola, banana e mel.", price: "R$22,90", img: demoAcai },
  { name: "Limonada Suíça", desc: "Limão siciliano, leite condensado, cremosa.", price: "R$12,90", img: demoLimonada },
];

const categories = ["Lanches", "Pizzas", "Açaí", "Bebidas"];

interface PhoneMockupProps {
  primaryColor?: string;
  primaryColorEnd?: string;
}

export default function PhoneMockup({
  primaryColor = "#FF6A00",
  primaryColorEnd = "#FF8C00",
}: PhoneMockupProps) {
  // Duplicate list so the marquee scroll loops seamlessly
  const looped = [...items, ...items];
  const gradient = `linear-gradient(135deg, ${primaryColor}, ${primaryColorEnd})`;

  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* Glow */}
      <div
        className="pointer-events-none absolute -inset-10 opacity-70"
        style={{ background: `radial-gradient(at 50% 45%, ${primaryColor}38 0%, transparent 65%)` }}
      />
      <div
        className="pointer-events-none absolute -inset-16 opacity-50"
        style={{ background: `radial-gradient(at 30% 80%, ${primaryColorEnd}2E 0%, transparent 70%)` }}
      />

      {/* Phone */}
      <div className="relative mx-auto" style={{ width: "min(100%, 300px)", transform: "rotate(-2deg)" }}>
        {/* Shadow under phone */}
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-[50%]"
          style={{
            bottom: -24,
            width: "75%",
            height: 40,
            background: "radial-gradient(rgba(0,0,0,0.22) 0%, transparent 70%)",
            filter: "blur(6px)",
          }}
        />
        <div
          className="relative rounded-[2.5rem] border-[10px] border-zinc-900 bg-zinc-900 shadow-[0_50px_100px_-25px_rgba(0,0,0,0.4),0_25px_50px_-20px_rgba(255,106,0,0.28)]"
          style={{ aspectRatio: "9 / 19" }}
        >
          <div className="relative h-full w-full overflow-hidden rounded-[1.75rem] bg-[#fffaf5]">
            {/* Cover */}
            <div className="relative h-44 w-full overflow-hidden">
              <img
                src={demoCover}
                alt=""
                className="h-full w-full object-cover"
                style={{ objectPosition: "center 55%" }}
              />
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(rgba(0,0,0,0) 50%, rgba(0,0,0,0.3) 100%)" }}
              />
            </div>

            {/* Restaurant card */}
            <div className="relative mx-3 -mt-9 rounded-xl bg-white p-3 shadow-lg ring-1 ring-black/5">
              <div className="flex items-center gap-2.5">
                <img
                  src={demoLogo}
                  alt=""
                  className="h-11 w-11 rounded-lg object-cover ring-1 ring-black/5"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] font-bold text-zinc-900 leading-tight truncate">
                    Sabor &amp; Arte Bistrô
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-px ring-1 ring-emerald-200/60">
                      <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[8px] font-semibold text-emerald-700">Aberto</span>
                    </span>
                    <span className="text-[10px] text-zinc-500 truncate">Jardins, SP</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Categories */}
            <div className="mt-3 flex gap-1 overflow-x-hidden px-3 pb-0.5">
              {categories.map((c, i) => (
                <span
                  key={c}
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-semibold ${
                    i === 0 ? "text-white" : "text-zinc-500 bg-zinc-100"
                  }`}
                  style={i === 0 ? { background: primaryColor } : {}}
                >
                  {c}
                </span>
              ))}
            </div>

            {/* Auto-scrolling menu list */}
            <div
              className="mt-2 px-3 pb-3 overflow-hidden"
              style={{ maskImage: "linear-gradient(to bottom, black 85%, transparent)" }}
            >
              <div className="phone-marquee space-y-0">
                {looped.map((it, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 border-b border-zinc-100 py-1.5 last:border-b-0"
                  >
                    <div className="relative shrink-0 h-12 w-12 rounded-lg overflow-hidden bg-zinc-100">
                      <img
                        src={it.img}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-[10px] font-semibold text-zinc-900 truncate leading-tight">
                          {it.name}
                        </span>
                        <span
                          className="shrink-0 flex h-3.5 w-3.5 items-center justify-center rounded-full shadow"
                          style={{ background: gradient }}
                        >
                          <Sparkles className="h-2 w-2 text-white" />
                        </span>
                      </div>
                      <p className="text-[7px] text-zinc-500 leading-snug line-clamp-1">{it.desc}</p>
                      <span className="text-[10px] font-extrabold text-zinc-900">{it.price}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating: AI photos */}
      <div className="absolute -left-6 top-[6%] flex items-center gap-2 rounded-full bg-white px-3.5 py-2 shadow-xl ring-1 ring-black/5 sm:-left-10 md:-left-16 animate-fade-in">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-full"
          style={{ background: gradient }}
        >
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[11px] font-bold text-zinc-900">Foto gerada por IA</span>
          <span className="text-[9px] text-zinc-500">em segundos</span>
        </div>
      </div>

      {/* Floating: New WhatsApp order */}
      <div className="absolute -right-4 bottom-[18%] flex items-center gap-2.5 rounded-xl bg-white px-3.5 py-2.5 shadow-xl ring-1 ring-black/5 sm:-right-8 md:-right-14 animate-fade-in">
        <div className="relative">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500">
            <MessageSquare className="h-4 w-4 text-white" />
          </div>
          <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white animate-pulse" />
        </div>
        <div>
          <div className="text-[12px] font-bold text-zinc-900 leading-none">Novo pedido!</div>
          <div className="text-[9px] text-zinc-500 leading-tight mt-1">WhatsApp · agora</div>
        </div>
      </div>

      <style>{`
        @keyframes phone-marquee-scroll {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        .phone-marquee {
          animation: phone-marquee-scroll 18s linear infinite;
        }
      `}</style>
    </div>
  );
}

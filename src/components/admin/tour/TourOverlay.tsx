/**
 * Overlay visual do tour guiado.
 *
 * - Escurece a tela e abre um "buraco" sobre o elemento alvo (spotlight)
 *   usando uma máscara CSS com box-shadow gigante.
 * - Renderiza um card flutuante com título, descrição, indicador de progresso
 *   e botões de navegação.
 * - Recalcula posição quando: passo muda, janela redimensiona, layout
 *   muda (scroll, resize observer no body).
 * - Tecla ESC encerra o tour.
 * - Quando o target não existe, o card é centralizado.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTour } from "./TourContext";
import { getStepsForSection } from "./tourSteps";
import type { TourPlacement } from "./types";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8; // padding ao redor do elemento destacado
const CARD_WIDTH = 340;
const CARD_GAP = 14; // distância entre o card e o elemento

function getRectFromTarget(target?: string): Rect | null {
  if (!target) return null;
  try {
    const el = document.querySelector(target) as HTMLElement | null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  } catch {
    return null;
  }
}

function computeCardPosition(rect: Rect | null, placement: TourPlacement) {
  // viewport sizes
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (!rect || placement === "center") {
    return {
      top: Math.max(20, vh / 2 - 120),
      left: Math.max(20, vw / 2 - CARD_WIDTH / 2),
      arrow: null as null | "top" | "bottom" | "left" | "right",
    };
  }

  let top = 0;
  let left = 0;
  let arrow: "top" | "bottom" | "left" | "right" | null = null;

  const cardEstHeight = 200; // estimativa para clamp; ajustamos abaixo

  switch (placement) {
    case "top":
      top = rect.top - cardEstHeight - CARD_GAP;
      left = rect.left + rect.width / 2 - CARD_WIDTH / 2;
      arrow = "bottom";
      break;
    case "bottom":
      top = rect.top + rect.height + CARD_GAP;
      left = rect.left + rect.width / 2 - CARD_WIDTH / 2;
      arrow = "top";
      break;
    case "left":
      top = rect.top + rect.height / 2 - cardEstHeight / 2;
      left = rect.left - CARD_WIDTH - CARD_GAP;
      arrow = "right";
      break;
    case "right":
      top = rect.top + rect.height / 2 - cardEstHeight / 2;
      left = rect.left + rect.width + CARD_GAP;
      arrow = "left";
      break;
  }

  // Se card sair da viewport, fallback para o lado oposto / centraliza
  if (top < 16) top = Math.min(rect.top + rect.height + CARD_GAP, vh - cardEstHeight - 16);
  if (top + cardEstHeight > vh - 16) top = Math.max(16, rect.top - cardEstHeight - CARD_GAP);
  if (left < 16) left = 16;
  if (left + CARD_WIDTH > vw - 16) left = vw - CARD_WIDTH - 16;

  return { top, left, arrow };
}

export function TourOverlay() {
  const { activeSectionId, stepIndex, nextStep, prevStep, endTour } = useTour();
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const steps = useMemo(
    () => (activeSectionId ? getStepsForSection(activeSectionId) : []),
    [activeSectionId],
  );
  const step = steps[stepIndex];

  // Recalcula posição do alvo a cada mudança de passo / resize / scroll
  useLayoutEffect(() => {
    if (!step) {
      setRect(null);
      return;
    }
    const update = () => setRect(getRectFromTarget(step.target));

    update();
    // tenta novamente em ~50ms para casos onde o DOM ainda está renderizando
    const t1 = window.setTimeout(update, 60);
    const t2 = window.setTimeout(update, 200);

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    const ro = new ResizeObserver(update);
    ro.observe(document.body);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      ro.disconnect();
    };
  }, [step]);

  // Bring target into view se estiver fora da viewport
  useEffect(() => {
    if (!step?.target) return;
    const el = document.querySelector(step.target) as HTMLElement | null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > window.innerHeight) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [step]);

  // ESC encerra
  useEffect(() => {
    if (!activeSectionId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") endTour();
      else if (e.key === "ArrowRight") nextStep();
      else if (e.key === "ArrowLeft") prevStep();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeSectionId, endTour, nextStep, prevStep]);

  if (!activeSectionId || !step) return null;

  const placement: TourPlacement = step.placement ?? (rect ? "bottom" : "center");
  const cardPos = computeCardPosition(rect, placement);

  const isLast = stepIndex === steps.length - 1;
  const isFirst = stepIndex === 0;

  // Spotlight: usamos um div absoluto sobre o target com box-shadow imenso
  // (escurece tudo ao redor sem cobrir o elemento). É cliques-passantes
  // dentro do recorte porque o spotlight tem `pointer-events: none`.
  const spotlightStyle: React.CSSProperties | null = rect
    ? {
        position: "fixed",
        top: rect.top - PADDING,
        left: rect.left - PADDING,
        width: rect.width + PADDING * 2,
        height: rect.height + PADDING * 2,
        borderRadius: 10,
        boxShadow: "0 0 0 9999px hsl(var(--background) / 0.78)",
        pointerEvents: "none",
        zIndex: 9998,
        transition: "all 180ms ease-out",
      }
    : null;

  // Quando não há rect, usamos um overlay escuro de tela cheia
  const fullOverlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "hsl(var(--background) / 0.78)",
    zIndex: 9997,
    pointerEvents: "auto",
  };

  const cardStyle: React.CSSProperties = {
    position: "fixed",
    top: cardPos.top,
    left: cardPos.left,
    width: CARD_WIDTH,
    zIndex: 9999,
    transition: "top 200ms ease-out, left 200ms ease-out",
  };

  return createPortal(
    <>
      {/* Background escuro (apenas quando não há spotlight) */}
      {!rect && <div style={fullOverlayStyle} onClick={endTour} aria-hidden />}

      {/* Spotlight */}
      {spotlightStyle && <div style={spotlightStyle} aria-hidden />}

      {/* Card flutuante */}
      <div
        ref={cardRef}
        style={cardStyle}
        className="rounded-xl border border-border bg-card text-card-foreground shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Tour · Passo {stepIndex + 1} de {steps.length}
            </p>
            <h3 id="tour-step-title" className="mt-1 text-base font-semibold leading-tight">
              {step.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={endTour}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Fechar tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 pb-3">
          <p className="text-sm leading-relaxed text-muted-foreground">{step.content}</p>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-3">
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={endTour}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Pular tour
          </Button>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={prevStep}
              disabled={isFirst}
              className="h-8 px-2.5"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Anterior
            </Button>
            <Button size="sm" onClick={nextStep} className="h-8 px-3">
              {isLast ? "Concluir" : "Próximo"}
              {!isLast && <ChevronRight className="h-3.5 w-3.5 ml-0.5" />}
            </Button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

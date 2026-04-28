/**
 * Contexto do tour guiado contínuo.
 *
 * - O tour começa na aba em que o usuário clicou e prossegue para as próximas
 *   abas (de acordo com TOUR_SECTION_ORDER) até a última, sem voltar para
 *   abas anteriores à inicial.
 * - Quando chega ao último passo de uma aba, "Próximo" troca para a próxima
 *   aba que tenha steps cadastrados (puladas silenciosamente as vazias).
 * - "Anterior" recua dentro da aba; ao chegar no passo 0, recua para a última
 *   aba já visitada nesta sessão (não cruza para antes da aba inicial).
 * - O painel admin registra `setActiveSection` via `setSectionChanger` para
 *   permitir que o tour troque de aba programaticamente.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { TOUR_SECTION_ORDER, type TourSectionId } from "./types";
import { getStepsForSection } from "./tourSteps";

type SectionChanger = (sectionId: TourSectionId) => void;

interface TourContextValue {
  activeSectionId: TourSectionId | null;
  stepIndex: number;
  /** Total de passos da aba atual (não do tour completo). */
  totalSteps: number;
  /** True se for o último passo da última aba com steps. */
  isFinalStep: boolean;
  /** True se for o primeiro passo da aba inicial (não há "anterior"). */
  isFirstStep: boolean;
  startTour: (sectionId: TourSectionId) => void;
  endTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  hasCompleted: (sectionId: TourSectionId) => boolean;
  /** Permite ao painel admin registrar a função de troca de aba. */
  setSectionChanger: (fn: SectionChanger | null) => void;
}

const TourContext = createContext<TourContextValue | null>(null);

const COMPLETED_KEY = (id: string) => `tour_completed_${id}`;

function indexOfSection(id: TourSectionId): number {
  return TOUR_SECTION_ORDER.indexOf(id);
}

function findNextSectionWithSteps(fromIndex: number): TourSectionId | null {
  for (let i = fromIndex; i < TOUR_SECTION_ORDER.length; i++) {
    const sec = TOUR_SECTION_ORDER[i];
    if (getStepsForSection(sec).length > 0) return sec;
  }
  return null;
}

function findPrevSectionWithSteps(fromIndex: number, minIndex: number): TourSectionId | null {
  for (let i = fromIndex; i >= minIndex; i--) {
    const sec = TOUR_SECTION_ORDER[i];
    if (getStepsForSection(sec).length > 0) return sec;
  }
  return null;
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [activeSectionId, setActiveSectionId] = useState<TourSectionId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const startSectionIndexRef = useRef<number>(0);
  const sectionChangerRef = useRef<SectionChanger | null>(null);

  const setSectionChanger = useCallback((fn: SectionChanger | null) => {
    sectionChangerRef.current = fn;
  }, []);

  const totalSteps = useMemo(
    () => (activeSectionId ? getStepsForSection(activeSectionId).length : 0),
    [activeSectionId],
  );

  const isFinalStep = useMemo(() => {
    if (!activeSectionId) return false;
    const curIdx = indexOfSection(activeSectionId);
    const stepsHere = getStepsForSection(activeSectionId).length;
    if (stepIndex < stepsHere - 1) return false;
    // Último da aba: existe próxima aba com steps?
    return findNextSectionWithSteps(curIdx + 1) === null;
  }, [activeSectionId, stepIndex]);

  const isFirstStep = useMemo(() => {
    if (!activeSectionId) return true;
    const curIdx = indexOfSection(activeSectionId);
    return stepIndex === 0 && curIdx <= startSectionIndexRef.current;
  }, [activeSectionId, stepIndex]);

  const markCompleted = (id: TourSectionId) => {
    try {
      localStorage.setItem(COMPLETED_KEY(id), "true");
    } catch {
      // ignore
    }
  };

  const startTour = useCallback((sectionId: TourSectionId) => {
    const idx = indexOfSection(sectionId);
    // Se a aba não está na ordem ou não tem steps, encontrar a próxima válida
    const validSection =
      idx >= 0 && getStepsForSection(sectionId).length > 0
        ? sectionId
        : findNextSectionWithSteps(Math.max(0, idx));
    if (!validSection) return;
    startSectionIndexRef.current = indexOfSection(validSection);
    setActiveSectionId(validSection);
    setStepIndex(0);
  }, []);

  const endTour = useCallback(() => {
    if (activeSectionId) markCompleted(activeSectionId);
    setActiveSectionId(null);
    setStepIndex(0);
  }, [activeSectionId]);

  const nextStep = useCallback(() => {
    if (!activeSectionId) return;
    const curIdx = indexOfSection(activeSectionId);
    const stepsHere = getStepsForSection(activeSectionId).length;

    if (stepIndex < stepsHere - 1) {
      setStepIndex((p) => p + 1);
      return;
    }

    // Última etapa da aba — marcar concluída e procurar próxima aba
    markCompleted(activeSectionId);
    const nextSection = findNextSectionWithSteps(curIdx + 1);
    if (!nextSection) {
      // Fim do tour
      setActiveSectionId(null);
      setStepIndex(0);
      return;
    }

    // Trocar a aba do painel e avançar
    sectionChangerRef.current?.(nextSection);
    setActiveSectionId(nextSection);
    setStepIndex(0);
  }, [activeSectionId, stepIndex]);

  const prevStep = useCallback(() => {
    if (!activeSectionId) return;
    if (stepIndex > 0) {
      setStepIndex((p) => p - 1);
      return;
    }
    // Está no primeiro passo da aba — tentar voltar para aba anterior dentro do range
    const curIdx = indexOfSection(activeSectionId);
    const minIdx = startSectionIndexRef.current;
    if (curIdx <= minIdx) return; // não cruza antes da aba inicial

    const prevSection = findPrevSectionWithSteps(curIdx - 1, minIdx);
    if (!prevSection) return;

    sectionChangerRef.current?.(prevSection);
    setActiveSectionId(prevSection);
    const lastIdx = Math.max(0, getStepsForSection(prevSection).length - 1);
    setStepIndex(lastIdx);
  }, [activeSectionId, stepIndex]);

  const hasCompleted = useCallback((sectionId: TourSectionId) => {
    try {
      return localStorage.getItem(COMPLETED_KEY(sectionId)) === "true";
    } catch {
      return false;
    }
  }, []);

  const value: TourContextValue = {
    activeSectionId,
    stepIndex,
    totalSteps,
    isFinalStep,
    isFirstStep,
    startTour,
    endTour,
    nextStep,
    prevStep,
    hasCompleted,
    setSectionChanger,
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour deve ser usado dentro de <TourProvider>");
  return ctx;
}

/**
 * Contexto do tour guiado.
 *
 * - Mantém o estado: aba ativa do tour (`activeSectionId`) e índice do passo.
 * - Expõe `startTour(sectionId)`, `endTour()`, `nextStep()`, `prevStep()`.
 * - Persiste em `localStorage` quais tours já foram concluídos
 *   (`tour_completed_<sectionId> = "true"`), permitindo, no futuro,
 *   destacar o botão para quem ainda não fez.
 *
 * O renderizador (TourOverlay) é registrado uma única vez no nível raiz do
 * painel admin (RestaurantAdmin).
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { TourSectionId } from "./types";
import { getStepsForSection } from "./tourSteps";

interface TourContextValue {
  /** Seção atualmente em tour, ou null se nenhum tour está ativo. */
  activeSectionId: TourSectionId | null;
  /** Índice do passo atual (0-based). */
  stepIndex: number;
  /** Total de passos da seção ativa. */
  totalSteps: number;
  /** Inicia o tour para uma seção específica. */
  startTour: (sectionId: TourSectionId) => void;
  /** Encerra o tour atual e marca a seção como concluída. */
  endTour: () => void;
  /** Avança para o próximo passo. Se for o último, encerra. */
  nextStep: () => void;
  /** Volta para o passo anterior (sem efeito no primeiro). */
  prevStep: () => void;
  /** Verifica se a seção já teve seu tour concluído alguma vez. */
  hasCompleted: (sectionId: TourSectionId) => boolean;
}

const TourContext = createContext<TourContextValue | null>(null);

const COMPLETED_KEY = (id: string) => `tour_completed_${id}`;

export function TourProvider({ children }: { children: ReactNode }) {
  const [activeSectionId, setActiveSectionId] = useState<TourSectionId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const totalSteps = useMemo(
    () => (activeSectionId ? getStepsForSection(activeSectionId).length : 0),
    [activeSectionId],
  );

  const startTour = useCallback((sectionId: TourSectionId) => {
    setActiveSectionId(sectionId);
    setStepIndex(0);
  }, []);

  const endTour = useCallback(() => {
    if (activeSectionId) {
      try {
        localStorage.setItem(COMPLETED_KEY(activeSectionId), "true");
      } catch {
        // ignore
      }
    }
    setActiveSectionId(null);
    setStepIndex(0);
  }, [activeSectionId]);

  const nextStep = useCallback(() => {
    setStepIndex((prev) => {
      if (!activeSectionId) return prev;
      const total = getStepsForSection(activeSectionId).length;
      if (prev + 1 >= total) {
        // último passo → encerrar
        try {
          localStorage.setItem(COMPLETED_KEY(activeSectionId), "true");
        } catch {
          // ignore
        }
        setActiveSectionId(null);
        return 0;
      }
      return prev + 1;
    });
  }, [activeSectionId]);

  const prevStep = useCallback(() => {
    setStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

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
    startTour,
    endTour,
    nextStep,
    prevStep,
    hasCompleted,
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour deve ser usado dentro de <TourProvider>");
  return ctx;
}

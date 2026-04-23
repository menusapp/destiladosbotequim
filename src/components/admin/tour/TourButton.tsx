/**
 * Botão "Tour" usado no AdminHeader.
 *
 * Inicia o tour da seção ativa. Não exige nenhum data-tour específico;
 * cabe a cada aba marcar seus elementos com `data-tour="..."`.
 */

import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTour } from "./TourContext";
import type { TourSectionId } from "./types";

interface TourButtonProps {
  /** ID da seção ativa do painel — passado pelo AdminHeader. */
  sectionId: string;
}

export function TourButton({ sectionId }: TourButtonProps) {
  const { startTour } = useTour();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => startTour(sectionId as TourSectionId)}
      className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
      title="Iniciar tour guiado desta seção"
    >
      <HelpCircle className="h-4 w-4" />
      <span className="hidden md:inline text-label">Tour</span>
    </Button>
  );
}

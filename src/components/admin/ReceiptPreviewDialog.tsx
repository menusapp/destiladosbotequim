import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Check } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import {
  buildReceiptPreview,
  type ReceiptPreviewResult,
} from "@/lib/buildReceiptPreview";

interface ReceiptPreviewDialogProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReceiptPreviewDialog({
  orderId,
  open,
  onOpenChange,
}: ReceiptPreviewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReceiptPreviewResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !orderId) return;
    let cancelled = false;
    setLoading(true);
    setData(null);
    buildReceiptPreview(orderId)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        console.error("[ReceiptPreviewDialog] erro ao gerar preview:", err);
        toast.error("Não foi possível gerar o preview do cupom");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, orderId]);

  const rulerText = useMemo(() => {
    if (!data) return "";
    // Régua superior tipo "....10....20....30....40.."
    let r = "";
    for (let i = 1; i <= data.lineWidth; i++) {
      if (i % 10 === 0) r += String(i / 10);
      else if (i % 5 === 0) r += "+";
      else r += "·";
    }
    return r;
  }, [data]);

  const copyContent = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.combined);
      setCopied(true);
      toast.success("Texto do cupom copiado");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Preview do cupom térmico</DialogTitle>
          <DialogDescription>
            Simulação visual de 42 colunas (largura padrão de 80mm). Os marcadores
            <span className="mx-1 font-mono text-xs">[NEGRITO]</span>/
            <span className="mx-1 font-mono text-xs">[GRANDE]</span>/
            <span className="mx-1 font-mono text-xs">[GIGANTE]</span> indicam
            apenas o efeito ESC/POS aplicado ao bloco — não saem na impressão.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {data ? (
              <>
                Loja: <span className="font-medium">{data.storeName}</span> ·
                Pedido <span className="font-mono">{data.orderId.slice(0, 8)}</span>
              </>
            ) : (
              "Carregando…"
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={!data}
            onClick={copyContent}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-1" /> Copiado
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1" /> Copiar texto
              </>
            )}
          </Button>
        </div>

        <div className="flex-1 overflow-auto rounded-md border bg-muted/40 p-4">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Gerando preview…
            </div>
          )}

          {!loading && data && (
            <div className="mx-auto" style={{ maxWidth: "44ch" }}>
              <pre
                className="font-mono text-[12px] leading-[1.35] text-foreground whitespace-pre bg-background border border-dashed rounded p-3 shadow-sm"
                style={{ fontFamily: '"Courier New", Courier, monospace' }}
              >
                {/* Régua de colunas */}
                <span className="text-muted-foreground">{rulerText}</span>
                {"\n"}
                {data.combined}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

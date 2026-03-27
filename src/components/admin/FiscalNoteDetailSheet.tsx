import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Copy, Download, FileCode, CheckCircle2, Clock, AlertCircle, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/components/ui/sonner";

interface FiscalNoteDetail {
  id: string;
  order_id: string;
  status: string;
  nfe_number: string | null;
  nfe_key: string | null;
  nuvem_fiscal_ref: string | null;
  xml_url: string | null;
  pdf_url: string | null;
  error_message: string | null;
  created_at: string;
  orders: {
    id: string;
    customer_name: string;
    customer_cpf: string;
    payment_type: string | null;
    order_type: string | null;
    created_at: string;
    order_items: {
      quantity: number;
      price_at_order: number;
      notes: string | null;
      products: { name: string } | null;
      order_item_extras: { price_at_order: number; product_extras: { name: string } | null }[];
    }[];
  } | null;
}

interface Props {
  note: FiscalNoteDetail | null;
  open: boolean;
  onClose: () => void;
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "authorized":
      return <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle2 className="w-3 h-3 mr-1" /> Autorizada</Badge>;
    case "processing":
      return <Badge className="bg-blue-100 text-blue-800 border-blue-300"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processando</Badge>;
    case "pending":
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
    case "error":
      return <Badge className="bg-red-100 text-red-800 border-red-300"><AlertCircle className="w-3 h-3 mr-1" /> Rejeitada</Badge>;
    case "canceled":
      return <Badge className="bg-gray-100 text-gray-800 border-gray-300"><XCircle className="w-3 h-3 mr-1" /> Cancelada</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const FiscalNoteDetailSheet = ({ note, open, onClose }: Props) => {
  if (!note) return null;

  const orderItems = note.orders?.order_items || [];
  const total = orderItems.reduce((acc, item) => {
    const extrasTotal = item.order_item_extras?.reduce((s, e) => s + e.price_at_order, 0) || 0;
    return acc + (item.price_at_order + extrasTotal) * item.quantity;
  }, 0);

  const copyKey = () => {
    if (note.nfe_key) {
      navigator.clipboard.writeText(note.nfe_key);
      toast.success("Chave copiada!");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg">Detalhes da Nota Fiscal</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            {getStatusBadge(note.status)}
          </div>

          {/* Error message */}
          {note.status === "error" && note.error_message && (
            <Card className="p-3 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-400 font-medium mb-1">Motivo da rejeição:</p>
              <p className="text-xs text-red-600 dark:text-red-300 break-words">{note.error_message}</p>
            </Card>
          )}

          <Separator />

          {/* NFe Key */}
          {note.nfe_key && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Chave de Acesso</p>
              <div className="flex items-start gap-2">
                <code className="text-xs bg-muted px-2 py-1.5 rounded break-all flex-1 font-mono">
                  {note.nfe_key}
                </code>
                <Button variant="ghost" size="icon" className="flex-shrink-0 h-8 w-8" onClick={copyKey}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Nº da Nota</p>
              <p className="text-sm font-medium">{note.nfe_number || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Data de Emissão</p>
              <p className="text-sm font-medium">{format(new Date(note.created_at), "dd/MM/yyyy HH:mm")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Referência</p>
              <p className="text-sm font-medium font-mono">{note.nuvem_fiscal_ref?.slice(0, 12) || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pedido</p>
              <p className="text-sm font-medium font-mono">#{note.order_id.slice(0, 8)}</p>
            </div>
          </div>

          <Separator />

          {/* Customer */}
          <div>
            <p className="text-sm font-semibold mb-2">Dados do Cliente</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Nome</p>
                <p className="text-sm font-medium">{note.orders?.customer_name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">CPF</p>
                <p className="text-sm font-medium">{note.orders?.customer_cpf || "Não informado"}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Products */}
          <div>
            <p className="text-sm font-semibold mb-2">Produtos</p>
            <div className="space-y-2">
              {orderItems.map((item, i) => {
                const extrasTotal = item.order_item_extras?.reduce((s, e) => s + e.price_at_order, 0) || 0;
                const itemTotal = (item.price_at_order + extrasTotal) * item.quantity;
                return (
                  <div key={i} className="flex justify-between text-sm">
                    <div className="flex-1">
                      <span className="font-medium">{item.quantity}x </span>
                      <span>{item.products?.name || "Produto"}</span>
                      {item.order_item_extras?.length > 0 && (
                        <div className="ml-4 text-xs text-muted-foreground">
                          {item.order_item_extras.map((e, j) => (
                            <span key={j}>+ {e.product_extras?.name || "Extra"} (R$ {e.price_at_order.toFixed(2)}){j < item.order_item_extras.length - 1 ? ", " : ""}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="font-medium whitespace-nowrap ml-2">R$ {itemTotal.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Payment & Total */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Forma de Pagamento</p>
              <p className="text-sm font-medium">{note.orders?.payment_type || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tipo de Pedido</p>
              <p className="text-sm font-medium capitalize">{note.orders?.order_type || "—"}</p>
            </div>
          </div>

          <Card className="p-3 bg-primary/5">
            <div className="flex justify-between items-center text-base font-bold">
              <span>Valor Total</span>
              <span>R$ {total.toFixed(2)}</span>
            </div>
          </Card>

          {/* Download Links */}
          <div className="flex gap-2">
            {note.pdf_url && (
              <Button variant="outline" className="flex-1 gap-2" onClick={() => window.open(note.pdf_url!, "_blank")}>
                <Download className="w-4 h-4 text-red-600" />
                Baixar PDF
              </Button>
            )}
            {note.xml_url && (
              <Button variant="outline" className="flex-1 gap-2" onClick={() => window.open(note.xml_url!, "_blank")}>
                <FileCode className="w-4 h-4 text-blue-600" />
                Baixar XML
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default FiscalNoteDetailSheet;

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, FileText, Download, FileCode, AlertCircle, CheckCircle2, Clock, XCircle, Loader2, FileArchive, Plus, Printer, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import NovaEmissaoModal from "./NovaEmissaoModal";
import FiscalNoteDetailSheet from "./FiscalNoteDetailSheet";
import { ptBR } from "date-fns/locale";
import { toast } from "@/components/ui/sonner";

interface FiscalNote {
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

const NotasFiscaisTab = ({ restaurantId }: { restaurantId: string }) => {
  const [notes, setNotes] = useState<FiscalNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showEmissaoModal, setShowEmissaoModal] = useState(false);
  const [selectedNote, setSelectedNote] = useState<FiscalNote | null>(null);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    const to = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    return { from, to };
  });

  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, [restaurantId, dateRange, statusFilter]);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("order_fiscal_notes")
        .select(`
          id, order_id, status, nfe_number, nfe_key, nuvem_fiscal_ref, xml_url, pdf_url, error_message, created_at,
          orders (
            id, customer_name, customer_cpf, payment_type, order_type, created_at,
            order_items (
              quantity, price_at_order, notes,
              products (name),
              order_item_extras (price_at_order, product_extras (name))
            )
          )
        `)
        .eq("restaurant_id", restaurantId)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString())
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setNotes((data as any) || []);
    } catch (error) {
      console.error("Erro ao buscar notas fiscais:", error);
      toast.error("Erro ao carregar notas fiscais");
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (note: FiscalNote) => {
    setRetrying(prev => new Set(prev).add(note.id));
    try {
      const { data, error } = await supabase.functions.invoke("nuvem-fiscal-emit", {
        body: { order_id: note.order_id, restaurant_id: restaurantId, fiscal_note_id: note.id },
      });
      if (error) {
        toast.error("Erro ao retentar emissão");
      } else if (data?.error) {
        toast.error(`Erro: ${data.error}`);
      } else {
        toast.success("Emissão retentada com sucesso!");
      }
      fetchNotes();
    } catch (err) {
      toast.error("Erro ao retentar emissão");
    } finally {
      setRetrying(prev => { const s = new Set(prev); s.delete(note.id); return s; });
    }
  };

  const calculateOrderTotal = (note: FiscalNote) => {
    if (!note.orders?.order_items) return 0;
    return note.orders.order_items.reduce((total, item) => {
      const extrasTotal = item.order_item_extras?.reduce((s, e) => s + e.price_at_order, 0) || 0;
      return total + (item.price_at_order + extrasTotal) * item.quantity;
    }, 0);
  };

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

  const stats = {
    total: notes.length,
    authorized: notes.filter(n => n.status === "authorized").length,
    pending: notes.filter(n => n.status === "pending" || n.status === "processing").length,
    error: notes.filter(n => n.status === "error").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">Central de Notas Fiscais</h2>
            <p className="text-sm text-muted-foreground">Gerencie todas as NFC-e emitidas pelo sistema</p>
          </div>
        </div>
        <Button onClick={() => setShowEmissaoModal(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Emissão
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Total de Notas</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{stats.authorized}</p><p className="text-xs text-muted-foreground">Autorizadas</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-yellow-600">{stats.pending}</p><p className="text-xs text-muted-foreground">Pendentes</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-red-600">{stats.error}</p><p className="text-xs text-muted-foreground">Com Erro</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    const from = new Date(range.from);
                    from.setHours(0, 0, 0, 0);
                    const to = new Date(range.to);
                    to.setHours(23, 59, 59, 999);
                    setDateRange({ from, to });
                  }
                }}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filtrar por status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="authorized">Autorizadas</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="processing">Processando</SelectItem>
              <SelectItem value="error">Com Erro</SelectItem>
              <SelectItem value="canceled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          onClick={() => toast.info("A funcionalidade de compactação de XMLs em formato .ZIP será ativada junto com a integração da SEFAZ.")}
          className="gap-2"
        >
          <FileArchive className="h-4 w-4" />
          Exportar XMLs (Mês Atual)
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando notas...</span>
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma nota fiscal encontrada</p>
              <p className="text-sm">As notas emitidas aparecerão aqui</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Nº Nota</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notes.map((note) => (
                  <TableRow
                    key={note.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedNote(note)}
                  >
                    <TableCell className="font-mono text-sm">#{note.order_id.slice(0, 8)}</TableCell>
                    <TableCell className="text-sm">{format(new Date(note.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell className="text-sm">{note.orders?.customer_name || "—"}</TableCell>
                    <TableCell className="text-right font-medium">R$ {calculateOrderTotal(note).toFixed(2)}</TableCell>
                    <TableCell className="text-sm">{note.nfe_number || "—"}</TableCell>
                    <TableCell>
                      {getStatusBadge(note.status)}
                      {note.status === "error" && note.error_message && (
                        <p className="text-xs text-red-500 mt-1 max-w-[300px] truncate" title={note.error_message}>
                          {note.error_message}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {note.pdf_url && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => window.open(note.pdf_url!, "_blank")} title="Baixar PDF/DANFE">
                              <Download className="h-4 w-4 text-red-600" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { const w = window.open(note.pdf_url!, "_blank"); if (w) setTimeout(() => w.print(), 1000); }} title="Imprimir Nota">
                              <Printer className="h-4 w-4 text-orange-600" />
                            </Button>
                          </>
                        )}
                        {note.xml_url && (
                          <Button variant="ghost" size="sm" onClick={() => window.open(note.xml_url!, "_blank")} title="Baixar XML">
                            <FileCode className="h-4 w-4 text-blue-600" />
                          </Button>
                        )}
                        {(note.status === "error" || note.status === "pending" || note.status === "processing") && (
                          <Button variant="ghost" size="sm" onClick={() => handleRetry(note)} disabled={retrying.has(note.id)} title="Retentar emissão">
                            {retrying.has(note.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4 text-amber-600" />}
                          </Button>
                        )}
                        {!note.pdf_url && !note.xml_url && note.status !== "error" && note.status !== "pending" && note.status !== "processing" && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NovaEmissaoModal open={showEmissaoModal} onClose={() => setShowEmissaoModal(false)} restaurantId={restaurantId} onEmitted={fetchNotes} />
      <FiscalNoteDetailSheet note={selectedNote} open={!!selectedNote} onClose={() => setSelectedNote(null)} />
    </div>
  );
};

export default NotasFiscaisTab;

import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { Upload, FileText, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface NfeItem {
  nome: string;
  codigo: string;
  quantidade: number;
  unidade: string;
  unidade_original: string;
  valor_unitario: number;
  valor_total: number;
  selected: boolean;
  existing_item_id?: string;
  existing_item_name?: string;
  action?: "update" | "create";
}

interface NfeData {
  numero_nota: string;
  cnpj_fornecedor: string;
  nome_fornecedor: string;
  data_emissao: string;
  valor_total: number;
  items: NfeItem[];
}

interface ImportNfeDialogProps {
  open: boolean;
  onClose: () => void;
  restaurantId: string;
  onImported: () => void;
}

export default function ImportNfeDialog({ open, onClose, restaurantId, onImported }: ImportNfeDialogProps) {
  const [step, setStep] = useState<"upload" | "preview" | "importing">("upload");
  const [nfeData, setNfeData] = useState<NfeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [xmlContent, setXmlContent] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "pdf") {
      toast.info("O formato XML é recomendado para importação automática. PDFs podem ser usados apenas como referência.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (ext !== "xml") {
      toast.error("Formato não suportado. Use arquivos .xml");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setLoading(true);
    try {
      const text = await file.text();
      setXmlContent(text);

      const { data, error } = await supabase.functions.invoke("parse-nfe", {
        body: { xml_content: text },
      });

      if (error || data?.error) {
        toast.error(data?.error || "Erro ao processar XML");
        setLoading(false);
        return;
      }

      // Check if this invoice was already imported
      const { data: existing } = await supabase
        .from("nfe_imports")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("numero_nota", data.numero_nota)
        .eq("cnpj_fornecedor", data.cnpj_fornecedor)
        .maybeSingle();

      if (existing) {
        toast.error(`A NF-e nº ${data.numero_nota} já foi importada anteriormente.`);
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      // Match items against existing stock
      const { data: stockItems } = await supabase
        .from("stock_items")
        .select("id, name, unit, price_per_unit")
        .eq("restaurant_id", restaurantId);

      const itemsWithMatch = data.items.map((item: any) => {
        const match = stockItems?.find(
          (si) => si.name.toLowerCase().trim() === item.nome.toLowerCase().trim()
        );
        return {
          ...item,
          selected: true,
          existing_item_id: match?.id || undefined,
          existing_item_name: match?.name || undefined,
          action: match ? "update" as const : "create" as const,
        };
      });

      setNfeData({ ...data, items: itemsWithMatch });
      setStep("preview");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao ler o arquivo XML");
    } finally {
      setLoading(false);
    }
  };

  const toggleItem = (index: number) => {
    if (!nfeData) return;
    const updated = [...nfeData.items];
    updated[index] = { ...updated[index], selected: !updated[index].selected };
    setNfeData({ ...nfeData, items: updated });
  };

  const toggleAction = (index: number) => {
    if (!nfeData) return;
    const updated = [...nfeData.items];
    const item = updated[index];
    if (item.existing_item_id) {
      item.action = item.action === "update" ? "create" : "update";
      updated[index] = { ...item };
      setNfeData({ ...nfeData, items: updated });
    }
  };

  const handleImport = async () => {
    if (!nfeData) return;
    const selectedItems = nfeData.items.filter((i) => i.selected);
    if (selectedItems.length === 0) {
      toast.error("Selecione pelo menos um item para importar");
      return;
    }

    setImporting(true);
    setStep("importing");

    try {
      for (const item of selectedItems) {
        if (item.action === "update" && item.existing_item_id) {
          // Update price and add stock movement
          await supabase
            .from("stock_items")
            .update({ price_per_unit: item.valor_unitario })
            .eq("id", item.existing_item_id);

          // Get current quantity to update
          const { data: current } = await supabase
            .from("stock_items")
            .select("current_quantity")
            .eq("id", item.existing_item_id)
            .single();

          if (current) {
            await supabase
              .from("stock_items")
              .update({ current_quantity: current.current_quantity + item.quantidade })
              .eq("id", item.existing_item_id);
          }

          await supabase.from("stock_movements").insert({
            stock_item_id: item.existing_item_id,
            movement_type: "entrada",
            quantity: item.quantidade,
            reason: `Importação NF-e nº ${nfeData.numero_nota}`,
          });
        } else {
          // Create new stock item
          const { data: newItem, error: insertError } = await supabase
            .from("stock_items")
            .insert({
              restaurant_id: restaurantId,
              name: item.nome,
              unit: item.unidade,
              price_per_unit: item.valor_unitario,
              current_quantity: item.quantidade,
              minimum_quantity: 0,
            })
            .select("id")
            .single();

          if (insertError) {
            console.error("Erro ao criar insumo:", insertError);
            continue;
          }

          if (newItem) {
            await supabase.from("stock_movements").insert({
              stock_item_id: newItem.id,
              movement_type: "entrada",
              quantity: item.quantidade,
              reason: `Importação NF-e nº ${nfeData.numero_nota}`,
            });
          }
        }
      }

      // Record the import
      await supabase.from("nfe_imports").insert({
        restaurant_id: restaurantId,
        numero_nota: nfeData.numero_nota,
        cnpj_fornecedor: nfeData.cnpj_fornecedor,
        nome_fornecedor: nfeData.nome_fornecedor,
        data_emissao: nfeData.data_emissao,
        valor_total: nfeData.valor_total,
        arquivo_xml: xmlContent,
      });

      toast.success(`${selectedItems.length} item(ns) importado(s) com sucesso!`);
      onImported();
      handleClose();
    } catch (err) {
      console.error("Erro na importação:", err);
      toast.error("Erro durante a importação");
      setStep("preview");
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setStep("upload");
    setNfeData(null);
    setXmlContent("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  };

  const selectAll = nfeData?.items.every((i) => i.selected) ?? false;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Importar Nota Fiscal
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-6 py-4">
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">
                Selecione o arquivo XML da Nota Fiscal Eletrônica (NF-e)
              </p>
              <Label htmlFor="nfe-file" className="cursor-pointer">
                <Input
                  id="nfe-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".xml,.pdf"
                  onChange={handleFileChange}
                  className="max-w-xs mx-auto"
                  disabled={loading}
                />
              </Label>
              {loading && (
                <div className="flex items-center justify-center mt-4 gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processando XML...
                </div>
              )}
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
              <p className="font-medium mb-1">💡 Dica</p>
              <p>Use o arquivo XML da NF-e para importação automática. O formato PDF pode ser usado apenas como referência visual.</p>
            </div>
          </div>
        )}

        {step === "preview" && nfeData && (
          <div className="space-y-4 py-2">
            {/* Invoice header info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Nº da Nota</p>
                <p className="font-semibold text-sm">{nfeData.numero_nota || "—"}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Fornecedor</p>
                <p className="font-semibold text-sm truncate">{nfeData.nome_fornecedor || "—"}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">CNPJ</p>
                <p className="font-semibold text-sm">{nfeData.cnpj_fornecedor || "—"}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Valor Total</p>
                <p className="font-semibold text-sm">R$ {nfeData.valor_total.toFixed(2)}</p>
              </div>
            </div>

            {/* Items table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectAll}
                        onCheckedChange={() => {
                          if (!nfeData) return;
                          const allSelected = nfeData.items.every((i) => i.selected);
                          setNfeData({
                            ...nfeData,
                            items: nfeData.items.map((i) => ({ ...i, selected: !allSelected })),
                          });
                        }}
                      />
                    </TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead>Unid.</TableHead>
                    <TableHead className="text-right">Vlr Unit.</TableHead>
                    <TableHead className="text-right">Vlr Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nfeData.items.map((item, idx) => (
                    <TableRow key={idx} className={!item.selected ? "opacity-50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={item.selected}
                          onCheckedChange={() => toggleItem(idx)}
                        />
                      </TableCell>
                      <TableCell className="font-medium text-sm max-w-[200px] truncate" title={item.nome}>
                        {item.nome}
                      </TableCell>
                      <TableCell className="text-right">{item.quantidade}</TableCell>
                      <TableCell>{item.unidade}</TableCell>
                      <TableCell className="text-right">R$ {item.valor_unitario.toFixed(2)}</TableCell>
                      <TableCell className="text-right">R$ {item.valor_total.toFixed(2)}</TableCell>
                      <TableCell>
                        {item.existing_item_id ? (
                          <button onClick={() => toggleAction(idx)} className="cursor-pointer">
                            {item.action === "update" ? (
                              <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs">
                                Atualizar existente
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-xs">
                                Criar novo
                              </Badge>
                            )}
                          </button>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Novo item
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <p className="text-xs text-muted-foreground">
              {nfeData.items.filter((i) => i.selected).length} de {nfeData.items.length} itens selecionados
              {" · "}
              Clique no status para alternar entre "Atualizar existente" e "Criar novo" quando houver um item similar no estoque.
            </p>
          </div>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Importando itens para o estoque...</p>
          </div>
        )}

        {step === "preview" && (
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={importing || !nfeData?.items.some((i) => i.selected)}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Confirmar Importação
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

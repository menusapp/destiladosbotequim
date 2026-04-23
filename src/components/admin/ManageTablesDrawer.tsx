import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Plus, Pencil, Trash2, Users, ImageIcon, X, Check } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";

interface TableRow {
  id: string;
  table_number: number;
  table_name: string | null;
  min_capacity: number | null;
  max_capacity: number | null;
  image_url: string | null;
  description: string | null;
  display_order: number | null;
  is_occupied: boolean | null;
  is_hidden: boolean;
}

interface ManageTablesDrawerProps {
  restaurantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTablesChanged: () => void;
}

interface FormData {
  table_number: string;
  table_name: string;
  min_capacity: string;
  max_capacity: string;
  description: string;
  is_hidden: boolean;
}

const emptyForm: FormData = { table_number: "", table_name: "", min_capacity: "1", max_capacity: "4", description: "", is_hidden: false };

export const ManageTablesDrawer = ({ restaurantId, open, onOpenChange, onTablesChanged }: ManageTablesDrawerProps) => {
  const confirm = useConfirmDialog();
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) fetchTables();
  }, [open, restaurantId]);

  const fetchTables = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("tables")
      .select("id, table_number, table_name, min_capacity, max_capacity, image_url, description, display_order, is_occupied, is_hidden")
      .eq("restaurant_id", restaurantId)
      .neq("table_number", 9999)
      .order("display_order")
      .order("table_number");
    setTables(data || []);
    setLoading(false);
  };

  const openCreateForm = () => {
    setEditingId(null);
    const nextNumber = tables.length > 0 ? Math.max(...tables.map(t => t.table_number)) + 1 : 1;
    setForm({ ...emptyForm, table_number: String(nextNumber) });
    setImageFile(null);
    setShowForm(true);
  };

  const openEditForm = (table: TableRow) => {
    setEditingId(table.id);
    setForm({
      table_number: String(table.table_number),
      table_name: table.table_name || "",
      min_capacity: String(table.min_capacity ?? 1),
      max_capacity: String(table.max_capacity ?? 4),
      description: table.description || "",
      is_hidden: table.is_hidden ?? false,
    });
    setImageFile(null);
    setShowForm(true);
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${restaurantId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("table-images").upload(path, file);
    if (error) {
      toast.error("Erro ao enviar imagem");
      return null;
    }
    const { data } = supabase.storage.from("table-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSave = async () => {
    const num = parseInt(form.table_number);
    if (isNaN(num) || num <= 0) { toast.error("Número da mesa inválido"); return; }

    setSaving(true);
    let imageUrl: string | null | undefined = undefined;
    if (imageFile) {
      imageUrl = await uploadImage(imageFile);
      if (imageUrl === null) { setSaving(false); return; }
    }

    const payload: any = {
      table_number: num,
      table_name: form.table_name || null,
      min_capacity: parseInt(form.min_capacity) || 1,
      max_capacity: parseInt(form.max_capacity) || 4,
      description: form.description || null,
      is_hidden: form.is_hidden,
      restaurant_id: restaurantId,
    };
    if (imageUrl !== undefined) payload.image_url = imageUrl;

    let error;
    if (editingId) {
      ({ error } = await supabase.from("tables").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("tables").insert(payload));
    }

    if (error) {
      toast.error("Erro ao salvar mesa");
    } else {
      toast.success(editingId ? "Mesa atualizada" : "Mesa criada");
      setShowForm(false);
      fetchTables();
      onTablesChanged();
    }
    setSaving(false);
  };

  const askDelete = async (id: string) => {
    const ok = await confirm({
      variant: "destructive",
      title: "Excluir esta mesa?",
      description: "A mesa será removida permanentemente.",
      consequence: "Pedidos e comandas vinculados podem impedir a exclusão.",
    });
    if (!ok) return;
    const { error } = await supabase.from("tables").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir mesa. Pode ter pedidos vinculados.");
    } else {
      toast.success("Mesa excluída");
      fetchTables();
      onTablesChanged();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-4 pb-2 border-b">
          <SheetTitle>Gerenciar Mesas</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Add button */}
          {!showForm && (
            <Button onClick={openCreateForm} className="w-full" variant="outline">
              <Plus className="w-4 h-4 mr-2" /> Adicionar Mesa
            </Button>
          )}

          {/* Create/Edit form */}
          {showForm && (
            <Card className="border-primary/50">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">{editingId ? "Editar Mesa" : "Nova Mesa"}</p>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowForm(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Número *</Label>
                    <Input type="number" value={form.table_number} onChange={e => setForm(f => ({ ...f, table_number: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Nome (opcional)</Label>
                    <Input placeholder="Ex: Varanda" value={form.table_name} onChange={e => setForm(f => ({ ...f, table_name: e.target.value }))} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Capacidade mín.</Label>
                    <Input type="number" value={form.min_capacity} onChange={e => setForm(f => ({ ...f, min_capacity: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Capacidade máx.</Label>
                    <Input type="number" value={form.max_capacity} onChange={e => setForm(f => ({ ...f, max_capacity: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Descrição (opcional)</Label>
                  <Input placeholder="Ex: Próxima à janela" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                </div>

                <div>
                  <Label className="text-xs">Foto (opcional)</Label>
                  <Input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} className="text-xs" />
                </div>

                <Button onClick={handleSave} disabled={saving} className="w-full" size="sm">
                  <Check className="w-4 h-4 mr-1" />
                  {saving ? "Salvando..." : editingId ? "Salvar" : "Criar Mesa"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Tables list */}
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : tables.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mesa cadastrada</p>
          ) : (
            tables.map(table => (
              <Card key={table.id} className="border-border/50">
                <CardContent className="p-3 flex items-center gap-3">
                  {table.image_url ? (
                    <img src={table.image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                      <span className="text-lg font-bold text-muted-foreground">{table.table_number}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">
                      Mesa {table.table_number}
                      {table.table_name && <span className="text-muted-foreground font-normal"> — {table.table_name}</span>}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="w-3 h-3" />
                      <span>{table.min_capacity ?? 1}–{table.max_capacity ?? 4} pessoas</span>
                      {table.is_hidden && <Badge variant="outline" className="text-[9px] px-1 py-0">Oculta</Badge>}
                      {table.is_occupied && !table.is_hidden && <Badge variant="default" className="text-[9px] px-1 py-0">Ocupada</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEditForm(table)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => askDelete(table.id)}
                      disabled={!!table.is_occupied}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

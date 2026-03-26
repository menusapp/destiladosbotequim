import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2, Building2, Phone, Mail, User } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  contact_name: string | null;
  notes: string | null;
}

interface SuppliersTabProps {
  restaurantId: string;
}

export default function SuppliersTab({ restaurantId }: SuppliersTabProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Supplier | null>(null);
  const [form, setForm] = useState({ name: "", cnpj: "", email: "", phone: "", contact_name: "", notes: "" });
  const { toast } = useToast();

  useEffect(() => { fetchSuppliers(); }, [restaurantId]);

  const fetchSuppliers = async () => {
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("name");
    if (error) { toast({ title: "Erro ao carregar fornecedores", variant: "destructive" }); return; }
    setSuppliers(data || []);
  };

  const resetForm = () => {
    setEditing(null);
    setForm({ name: "", cnpj: "", email: "", phone: "", contact_name: "", notes: "" });
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({ name: s.name, cnpj: s.cnpj || "", email: s.email || "", phone: s.phone || "", contact_name: s.contact_name || "", notes: s.notes || "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Nome é obrigatório", variant: "destructive" }); return; }

    const payload = {
      name: form.name.trim(),
      cnpj: form.cnpj.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      contact_name: form.contact_name.trim() || null,
      notes: form.notes.trim() || null,
    };

    if (editing) {
      const { error } = await supabase.from("suppliers").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro ao atualizar fornecedor", variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("suppliers").insert({ ...payload, restaurant_id: restaurantId });
      if (error) { toast({ title: "Erro ao criar fornecedor", variant: "destructive" }); return; }
    }

    resetForm();
    setDialogOpen(false);
    fetchSuppliers();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const { error } = await supabase.from("suppliers").delete().eq("id", toDelete.id);
    if (error) { toast({ title: "Erro ao excluir fornecedor", description: error.message, variant: "destructive" }); }
    setDeleteDialogOpen(false);
    setToDelete(null);
    fetchSuppliers();
  };

  const filtered = suppliers.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar fornecedor..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Fornecedor
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">{searchQuery ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado"}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => (
            <Card key={s.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground truncate">{s.name}</h3>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => { setToDelete(s); setDeleteDialogOpen(true); }}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
                {s.cnpj && (
                  <p className="text-xs text-muted-foreground">CNPJ: {s.cnpj}</p>
                )}
                <div className="space-y-1 text-xs">
                  {s.phone && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="h-3 w-3" /> {s.phone}
                    </div>
                  )}
                  {s.email && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Mail className="h-3 w-3" /> {s.email}
                    </div>
                  )}
                  {s.contact_name && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <User className="h-3 w-3" /> {s.contact_name}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do fornecedor" />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Telefone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@fornecedor.com" />
              </div>
            </div>
            <div>
              <Label>Nome do Contato</Label>
              <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} placeholder="Pessoa de contato" />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anotações sobre o fornecedor" rows={3} />
            </div>
            <Button onClick={handleSave} className="w-full">
              {editing ? "Salvar Alterações" : "Criar Fornecedor"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Fornecedor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{toDelete?.name}"? Insumos vinculados a este fornecedor ficarão sem fornecedor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

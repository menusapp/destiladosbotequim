import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface RemoteConfig {
  id: string;
  key: string;
  value: any;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function RemoteConfigsTab() {
  const [configs, setConfigs] = useState<RemoteConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RemoteConfig | null>(null);

  const [formKey, setFormKey] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  useEffect(() => { fetchConfigs(); }, []);

  const fetchConfigs = async () => {
    const { data, error } = await supabase
      .from("remote_configs" as any)
      .select("*")
      .order("key") as any;
    if (error) toast.error("Erro ao carregar configurações");
    else setConfigs(data || []);
    setLoading(false);
  };

  const resetForm = () => {
    setFormKey(""); setFormValue(""); setFormDescription(""); setFormIsActive(true);
    setEditing(null);
  };

  const openDialog = (config?: RemoteConfig) => {
    if (config) {
      setEditing(config);
      setFormKey(config.key);
      setFormValue(JSON.stringify(config.value));
      setFormDescription(config.description || "");
      setFormIsActive(config.is_active);
    } else { resetForm(); }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let parsedValue: any;
    try { parsedValue = JSON.parse(formValue); } catch { parsedValue = formValue; }

    const payload = {
      key: formKey,
      value: parsedValue,
      description: formDescription || null,
      is_active: formIsActive,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editing) {
        const { error } = await (supabase.from("remote_configs" as any) as any).update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Configuração atualizada");
      } else {
        const { error } = await (supabase.from("remote_configs" as any) as any).insert(payload);
        if (error) throw error;
        toast.success("Configuração criada");
      }
      setDialogOpen(false); resetForm(); fetchConfigs();
    } catch (err: any) { toast.error(err.message || "Erro ao salvar"); }
  };

  const handleToggleActive = async (config: RemoteConfig) => {
    const { error } = await (supabase.from("remote_configs" as any) as any)
      .update({ is_active: !config.is_active, updated_at: new Date().toISOString() })
      .eq("id", config.id);
    if (error) toast.error(error.message);
    else fetchConfigs();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta configuração?")) return;
    const { error } = await (supabase.from("remote_configs" as any) as any).delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else { toast.success("Configuração excluída"); fetchConfigs(); }
  };

  if (loading) return <p className="text-muted-foreground p-4">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Configurações Remotas</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => openDialog()}>
              <Plus className="h-4 w-4 mr-2" /> Nova Config
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Configuração" : "Nova Configuração"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Chave</Label>
                <Input value={formKey} onChange={e => setFormKey(e.target.value)} placeholder="Ex: maintenance_mode" required disabled={!!editing} />
              </div>
              <div className="space-y-2">
                <Label>Valor (JSON)</Label>
                <Textarea value={formValue} onChange={e => setFormValue(e.target.value)} placeholder='Ex: true, "texto", 42' rows={3} required />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Para que serve esta config" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formIsActive} onCheckedChange={setFormIsActive} />
                <Label>Ativo</Label>
              </div>
              <Button type="submit" className="w-full">{editing ? "Atualizar" : "Criar"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {configs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Settings className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Nenhuma configuração remota</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {configs.map(c => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono font-medium">{c.key}</code>
                    <span className={`w-2 h-2 rounded-full ${c.is_active ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                  </div>
                  {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
                  <p className="text-xs font-mono text-muted-foreground truncate">{JSON.stringify(c.value)}</p>
                </div>
                <div className="flex gap-2 ml-4">
                  <Switch checked={c.is_active} onCheckedChange={() => handleToggleActive(c)} />
                  <Button variant="outline" size="sm" onClick={() => openDialog(c)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

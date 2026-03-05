import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Check, X, Download } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

interface AppVersion {
  id: string;
  version: string;
  release_notes: string | null;
  is_current: boolean | null;
  download_url_windows: string | null;
  download_url_mac: string | null;
  download_url_linux: string | null;
  created_at: string | null;
}

export function VersionsTab() {
  const [versions, setVersions] = useState<AppVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AppVersion | null>(null);

  const [formVersion, setFormVersion] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formIsCurrent, setFormIsCurrent] = useState(false);
  const [formWindows, setFormWindows] = useState("");
  const [formMac, setFormMac] = useState("");
  const [formLinux, setFormLinux] = useState("");

  useEffect(() => {
    fetchVersions();
  }, []);

  const fetchVersions = async () => {
    const { data, error } = await supabase
      .from("app_versions")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar versões");
    } else {
      setVersions(data || []);
    }
    setLoading(false);
  };

  const resetForm = () => {
    setFormVersion("");
    setFormNotes("");
    setFormIsCurrent(false);
    setFormWindows("");
    setFormMac("");
    setFormLinux("");
    setEditing(null);
  };

  const openDialog = (version?: AppVersion) => {
    if (version) {
      setEditing(version);
      setFormVersion(version.version);
      setFormNotes(version.release_notes || "");
      setFormIsCurrent(version.is_current || false);
      setFormWindows(version.download_url_windows || "");
      setFormMac(version.download_url_mac || "");
      setFormLinux(version.download_url_linux || "");
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      version: formVersion,
      release_notes: formNotes || null,
      is_current: formIsCurrent,
      download_url_windows: formWindows || null,
      download_url_mac: formMac || null,
      download_url_linux: formLinux || null,
    };

    try {
      // If marking as current, unset others first
      if (formIsCurrent) {
        await supabase.from("app_versions").update({ is_current: false }).neq("id", editing?.id || "");
      }

      if (editing) {
        const { error } = await supabase.from("app_versions").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Versão atualizada");
      } else {
        const { error } = await supabase.from("app_versions").insert(payload);
        if (error) throw error;
        toast.success("Versão criada");
      }

      setDialogOpen(false);
      resetForm();
      fetchVersions();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar versão");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta versão?")) return;
    const { error } = await supabase.from("app_versions").delete().eq("id", id);
    if (error) toast.error("Erro ao excluir");
    else {
      toast.success("Versão excluída");
      fetchVersions();
    }
  };

  if (loading) return <p className="text-muted-foreground p-4">Carregando...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Versões do App</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}>
              <Plus className="h-4 w-4 mr-2" /> Nova Versão
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Versão" : "Nova Versão"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Versão</Label>
                <Input value={formVersion} onChange={e => setFormVersion(e.target.value)} placeholder="Ex: 1.2.0" required />
              </div>
              <div className="space-y-2">
                <Label>Release Notes</Label>
                <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="O que mudou..." rows={4} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formIsCurrent} onCheckedChange={setFormIsCurrent} />
                <Label>Versão Atual</Label>
              </div>
              <div className="space-y-2">
                <Label>URL Download Windows</Label>
                <Input value={formWindows} onChange={e => setFormWindows(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>URL Download Mac</Label>
                <Input value={formMac} onChange={e => setFormMac(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>URL Download Linux</Label>
                <Input value={formLinux} onChange={e => setFormLinux(e.target.value)} placeholder="https://..." />
              </div>
              <Button type="submit" className="w-full">{editing ? "Atualizar" : "Criar"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {versions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Download className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma versão cadastrada</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {versions.map(v => (
            <Card key={v.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-lg">v{v.version}</span>
                    {v.is_current && <Badge className="bg-primary/10 text-primary border-primary/20">Atual</Badge>}
                  </div>
                  {v.release_notes && <p className="text-sm text-muted-foreground line-clamp-2">{v.release_notes}</p>}
                  <div className="flex gap-2 mt-1">
                    {v.download_url_windows && <Badge variant="outline" className="text-xs">Windows</Badge>}
                    {v.download_url_mac && <Badge variant="outline" className="text-xs">Mac</Badge>}
                    {v.download_url_linux && <Badge variant="outline" className="text-xs">Linux</Badge>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openDialog(v)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(v.id)}>
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

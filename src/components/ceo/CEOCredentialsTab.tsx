import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { Plus, Trash2, Edit, UserCog, Eye, EyeOff } from "lucide-react";

interface CEOUser {
  id: string;
  username: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
}

export const CEOCredentialsTab = () => {
  const [users, setUsers] = useState<CEOUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<CEOUser | null>(null);
  const [formUsername, setFormUsername] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    const { data } = await (supabase as any).rpc("admin_list_ceo_users");
    setUsers(data || []);
    setLoading(false);
  };

  const handleOpenDialog = (user?: CEOUser) => {
    if (user) {
      setEditingUser(user);
      setFormUsername(user.username);
      setFormDisplayName(user.display_name);
      setFormPassword("");
    } else {
      setEditingUser(null);
      setFormUsername("");
      setFormDisplayName("");
      setFormPassword("");
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let passwordHash = "";
      if (formPassword) {
        const { data: hashData, error: hashError } = await supabase.functions.invoke("hash-password", {
          body: { password: formPassword },
        });
        if (hashError || !hashData?.hash) throw new Error("Erro ao criar hash da senha");
        passwordHash = hashData.hash;
      }

      if (editingUser) {
        const { error } = await (supabase as any).rpc("admin_upsert_ceo_user", {
          p_id: editingUser.id,
          p_username: formUsername,
          p_display_name: formDisplayName,
          p_password_hash: passwordHash || null,
        });
        if (error) throw error;
        toast.success("Usuário atualizado!");
      } else {
        if (!formPassword) { toast.error("Senha é obrigatória"); return; }
        const { error } = await (supabase as any).rpc("admin_upsert_ceo_user", {
          p_username: formUsername,
          p_display_name: formDisplayName,
          p_password_hash: passwordHash,
        });
        if (error) throw error;
        toast.success("Usuário criado!");
      }
      setDialogOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar");
    }
  };

  const handleDelete = async (user: CEOUser) => {
    if (users.length <= 1) { toast.error("Deve haver ao menos 1 usuário CEO"); return; }
    if (!confirm(`Excluir ${user.display_name}?`)) return;
    const { error } = await (supabase as any).rpc("admin_delete_ceo_user", { p_id: user.id });
    if (error) { toast.error(error.message || "Erro ao excluir"); return; }
    toast.success("Usuário excluído");
    fetchUsers();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Contas CEO</CardTitle>
          <CardDescription>Gerencie os usuários com acesso ao painel CEO</CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} size="sm">
              <Plus className="h-4 w-4 mr-2" /> Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUser ? "Editar Usuário" : "Novo Usuário CEO"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome de Exibição</Label>
                <Input value={formDisplayName} onChange={(e) => setFormDisplayName(e.target.value)} placeholder="Ex: Gustavo" required />
              </div>
              <div className="space-y-2">
                <Label>Usuário</Label>
                <Input value={formUsername} onChange={(e) => setFormUsername(e.target.value)} placeholder="Ex: gustavo" required autoCapitalize="off" />
              </div>
              <div className="space-y-2">
                <Label>{editingUser ? "Nova Senha (deixe vazio para manter)" : "Senha"}</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required={!editingUser}
                    minLength={6}
                  />
                  <button type="button" className="absolute right-3 top-2.5 text-muted-foreground" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full">{editingUser ? "Atualizar" : "Criar"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <UserCog className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum usuário CEO cadastrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <UserCog className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium">{user.display_name}</p>
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpenDialog(user)}>
                    <Edit className="h-4 w-4 mr-2" /> Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(user)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Plus, Trash2, Users, Crown } from "lucide-react";
import { usePlanLimits } from "@/hooks/usePlanLimits";

interface Staff {
  id: string;
  username: string;
  display_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface EquipeTabProps {
  restaurantId: string;
  planName?: string | null;
  onNavigateToPlans?: () => void;
}

export default function EquipeTab({ restaurantId, planName, onNavigateToPlans }: EquipeTabProps) {
  const { limits, staffCount, canAddUser, remaining, refresh } = usePlanLimits(restaurantId, planName);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // form
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "staff">("staff");

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).rpc("admin_list_staff", {
      p_restaurant_id: restaurantId,
    });
    if (error) {
      toast.error("Erro ao carregar equipe");
    } else {
      setStaff(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (restaurantId) load();
  }, [restaurantId]);

  const resetForm = () => {
    setDisplayName("");
    setUsername("");
    setPassword("");
    setRole("staff");
  };

  const handleOpenAdd = () => {
    if (!canAddUser) {
      toast.error(
        `Seu plano permite no máximo ${limits.maxUsers} usuário${limits.maxUsers === 1 ? "" : "s"}. Faça upgrade para adicionar mais.`,
      );
      return;
    }
    resetForm();
    setOpen(true);
  };

  const handleSave = async () => {
    if (!displayName.trim() || !username.trim() || password.length < 6) {
      toast.error("Preencha nome, usuário e senha (mínimo 6 caracteres)");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("staff-create", {
        body: {
          restaurant_id: restaurantId,
          username: username.trim(),
          password,
          display_name: displayName.trim(),
          role,
          allowed_sections: [],
          can_manage_orders: true,
          receives_order_notifications: true,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) {
        toast.error((data as any).error);
        return;
      }
      toast.success("Usuário criado");
      setOpen(false);
      resetForm();
      await load();
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: Staff) => {
    if (s.role === "admin") {
      toast.error("Não é possível remover o administrador principal");
      return;
    }
    if (!confirm(`Remover ${s.display_name}?`)) return;
    const { data, error } = await (supabase as any).rpc("admin_delete_staff", {
      p_staff_id: s.id,
      p_restaurant_id: restaurantId,
    });
    if (error || data === false) {
      toast.error("Erro ao remover usuário");
      return;
    }
    toast.success("Usuário removido");
    await load();
    await refresh();
  };

  const limitLabel = Number.isFinite(limits.maxUsers) ? `${staffCount} / ${limits.maxUsers}` : `${staffCount} (ilimitado)`;
  const isLocked = !canAddUser;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Equipe
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie os usuários que acessam o painel administrativo.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-sm py-1.5 px-3">
            Plano <strong className="ml-1">{limits.name}</strong> · {limitLabel}
          </Badge>
          <Button onClick={handleOpenAdd} disabled={isLocked} className="gap-2">
            {isLocked ? <Lock className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            Adicionar usuário
          </Button>
        </div>
      </div>

      {isLocked && (
        <Card className="border-orange-200 bg-orange-50/40">
          <CardContent className="pt-6 flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
              <Lock className="h-5 w-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">
                Você atingiu o limite do seu plano ({limits.maxUsers} usuário
                {limits.maxUsers === 1 ? "" : "s"}).
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Faça upgrade para adicionar mais membros à sua equipe.
              </p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={onNavigateToPlans} className="bg-orange-500 hover:bg-orange-600">
                  Fazer upgrade →
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open("https://w.app/menusapp", "_blank")}
                >
                  Falar no WhatsApp
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuários ativos</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : staff.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhum usuário cadastrado ainda.
            </div>
          ) : (
            <div className="space-y-2">
              {staff.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {s.role === "admin" ? (
                        <Crown className="h-5 w-5 text-primary" />
                      ) : (
                        <Users className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{s.display_name}</div>
                      <div className="text-xs text-muted-foreground truncate">@{s.username}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={s.role === "admin" ? "default" : "secondary"}>
                      {s.role === "admin" ? "Administrador" : "Staff"}
                    </Badge>
                    {s.role !== "admin" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(s)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add user dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="staff-name">Nome de exibição</Label>
              <Input
                id="staff-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ex: João Silva"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-username">Usuário (login)</Label>
              <Input
                id="staff-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ex: joao"
                autoCapitalize="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-pw">Senha</Label>
              <Input
                id="staff-pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label>Função</Label>
              <Select value={role} onValueChange={(v: any) => setRole(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">Staff (acesso restrito)</SelectItem>
                  <SelectItem value="admin">Administrador (acesso total)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando…" : "Criar usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

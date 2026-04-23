import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, UserCheck, UserX, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { ALL_SECTIONS, STAFF_ROLES, ROLE_DEFAULT_SECTIONS, type StaffRole } from "@/lib/staffPermissions";

interface StaffMember {
  id: string;
  username: string;
  display_name: string;
  role: string;
  allowed_sections: string[];
  is_active: boolean;
  created_at: string;
  can_manage_orders?: boolean;
  receives_order_notifications?: boolean;
}

interface ContasTabProps {
  restaurantId: string;
}

const ContasTab = ({ restaurantId }: ContasTabProps) => {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  // Form state
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formRole, setFormRole] = useState<StaffRole>("garcom");
  const [formSections, setFormSections] = useState<string[]>([]);
  const [formCanManageOrders, setFormCanManageOrders] = useState(true);
  const [formReceivesOrderNotifications, setFormReceivesOrderNotifications] = useState(true);

  const currentStaffId = localStorage.getItem("staff_id");

  useEffect(() => {
    fetchStaff();
  }, [restaurantId]);

  const fetchStaff = async () => {
    try {
      const { data, error } = await supabase.rpc("admin_list_staff", {
        p_restaurant_id: restaurantId,
      });

      if (error) throw error;
      setStaff((data as any[]) || []);
    } catch (error: any) {
      toast.error("Erro ao carregar contas");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (member?: StaffMember) => {
    if (member) {
      setEditingStaff(member);
      setFormUsername(member.username);
      setFormPassword("");
      setFormDisplayName(member.display_name);
      setFormRole(member.role as StaffRole);
      setFormSections(member.allowed_sections || []);
      setFormCanManageOrders(member.can_manage_orders !== false);
      setFormReceivesOrderNotifications(member.receives_order_notifications !== false);
    } else {
      setEditingStaff(null);
      setFormUsername("");
      setFormPassword("");
      setFormDisplayName("");
      setFormRole("garcom");
      setFormSections(ROLE_DEFAULT_SECTIONS["garcom"]);
      setFormCanManageOrders(true);
      setFormReceivesOrderNotifications(true);
    }
    setDialogOpen(true);
  };

  const handleRoleChange = (role: StaffRole) => {
    setFormRole(role);
    // Pre-fill sections with defaults for this role
    setFormSections(ROLE_DEFAULT_SECTIONS[role] || []);
  };

  const toggleSection = (sectionId: string) => {
    setFormSections(prev =>
      prev.includes(sectionId) ? prev.filter(s => s !== sectionId) : [...prev, sectionId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Admin always has full order permissions (DB trigger also enforces it)
    const effectiveCanManage = formRole === "admin" ? true : formCanManageOrders;
    const effectiveReceives = formRole === "admin" ? true : formReceivesOrderNotifications;

    try {
      if (editingStaff) {
        const { error } = await supabase.rpc("admin_upsert_staff", {
          p_restaurant_id: restaurantId,
          p_id: editingStaff.id,
          p_display_name: formDisplayName,
          p_username: formUsername !== editingStaff.username ? formUsername : null,
          p_password_hash: formPassword || null,
          p_role: formRole,
          p_allowed_sections: JSON.stringify(formRole === "admin" ? ALL_SECTIONS.map(s => s.id) : formSections),
          p_can_manage_orders: effectiveCanManage,
          p_receives_order_notifications: effectiveReceives,
        } as any);

        if (error) throw error;

        // Update localStorage if editing self
        if (editingStaff.id === currentStaffId) {
          localStorage.setItem("staff_name", formDisplayName);
          localStorage.setItem("staff_role", formRole);
          localStorage.setItem("staff_allowed_sections", JSON.stringify(formRole === "admin" ? ALL_SECTIONS.map(s => s.id) : formSections));
          localStorage.setItem("staff_can_manage_orders", String(effectiveCanManage));
          localStorage.setItem("staff_receives_order_notifications", String(effectiveReceives));
        }

        toast.success("Conta atualizada!");
      } else {
        if (!formPassword) {
          toast.error("Senha é obrigatória para nova conta");
          return;
        }
        // Cannot create another admin
        if (formRole === "admin") {
          toast.error("Não é possível criar outra conta admin");
          return;
        }

        const { error } = await supabase.rpc("admin_upsert_staff", {
          p_restaurant_id: restaurantId,
          p_username: formUsername.trim(),
          p_password_hash: formPassword,
          p_display_name: formDisplayName,
          p_role: formRole,
          p_allowed_sections: JSON.stringify(formSections),
          p_can_manage_orders: effectiveCanManage,
          p_receives_order_notifications: effectiveReceives,
        } as any);

        if (error) {
          if (error.message?.includes("duplicate") || error.message?.includes("unique")) {
            toast.error("Já existe uma conta com este usuário");
            return;
          }
          throw error;
        }
        toast.success("Conta criada!");
      }

      setDialogOpen(false);
      fetchStaff();
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar conta");
    }
  };

  const handleToggleActive = async (member: StaffMember) => {
    if (member.id === currentStaffId) {
      toast.error("Você não pode desativar sua própria conta");
      return;
    }
    if (member.role === "admin") {
      toast.error("A conta admin não pode ser desativada");
      return;
    }

    const { error } = await supabase.rpc("admin_toggle_staff_active", {
      p_staff_id: member.id,
      p_restaurant_id: restaurantId,
    });

    if (error) {
      toast.error("Erro ao alterar status");
      return;
    }

    toast.success(member.is_active ? "Conta desativada" : "Conta ativada");
    fetchStaff();
  };

  const handleDelete = async (member: StaffMember) => {
    if (member.id === currentStaffId) {
      toast.error("Você não pode excluir sua própria conta");
      return;
    }
    if (member.role === "admin") {
      toast.error("A conta admin não pode ser excluída");
      return;
    }

    if (!window.confirm(`Tem certeza que deseja excluir a conta de "${member.display_name}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    const { data, error } = await supabase.rpc("admin_delete_staff", {
      p_staff_id: member.id,
      p_restaurant_id: restaurantId,
    });

    if (error) {
      toast.error("Erro ao excluir conta");
      return;
    }

    toast.success("Conta excluída com sucesso");
    fetchStaff();
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: "bg-primary/10 text-primary",
      gerente: "bg-blue-500/10 text-blue-600",
      caixa: "bg-green-500/10 text-green-600",
      garcom: "bg-amber-500/10 text-amber-600",
      cozinha: "bg-orange-500/10 text-orange-600",
      atendente: "bg-purple-500/10 text-purple-600",
    };
    return colors[role] || "bg-muted text-muted-foreground";
  };

  const getRoleLabel = (role: string) => {
    return STAFF_ROLES.find(r => r.value === role)?.label || role;
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Contas</h2>
          <p className="text-sm text-muted-foreground">Gerencie os acessos do seu restaurante</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" /> Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingStaff ? "Editar Conta" : "Nova Conta"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome de Exibição</Label>
                <Input
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  placeholder="Ex: João Silva"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Usuário</Label>
                <Input
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="Ex: joao"
                  autoCapitalize="off"
                  autoCorrect="off"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{editingStaff ? "Nova Senha (deixe vazio para manter)" : "Senha"}</Label>
                <PasswordInput
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                  minLength={4}
                  required={!editingStaff}
                />
              </div>
              <div className="space-y-2">
                <Label>Cargo</Label>
                <Select
                  value={formRole}
                  onValueChange={(v) => handleRoleChange(v as StaffRole)}
                  disabled={editingStaff?.role === "admin"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAFF_ROLES.filter(r => editingStaff?.role === "admin" ? r.value === "admin" : r.value !== "admin").map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        <div>
                          <span className="font-medium">{role.label}</span>
                          <span className="text-muted-foreground ml-2 text-xs">— {role.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Order permissions */}
              <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                <p className="text-sm font-semibold">Permissões de pedidos</p>

                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Receber notificações de pedidos</p>
                    <p className="text-xs text-muted-foreground">
                      Novos pedidos de delivery e mesa aparecerão para esta conta
                    </p>
                  </div>
                  <Switch
                    checked={formRole === "admin" ? true : formReceivesOrderNotifications}
                    disabled={formRole === "admin"}
                    onCheckedChange={setFormReceivesOrderNotifications}
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Aceitar e recusar pedidos</p>
                    <p className="text-xs text-muted-foreground">
                      Esta conta pode confirmar ou cancelar pedidos recebidos
                    </p>
                  </div>
                  <Switch
                    checked={formRole === "admin" ? true : formCanManageOrders}
                    disabled={formRole === "admin"}
                    onCheckedChange={setFormCanManageOrders}
                  />
                </div>

                {formRole === "admin" && (
                  <p className="text-xs text-muted-foreground italic">
                    O administrador sempre tem acesso total.
                  </p>
                )}
              </div>

              {/* Permissions checkboxes */}
              {formRole !== "admin" && (
                <div className="space-y-2">
                  <Label>Seções Permitidas</Label>
                  <p className="text-xs text-muted-foreground">Marque/desmarque as seções que este funcionário pode acessar</p>
                  <div className="grid grid-cols-2 gap-2 mt-2 border rounded-lg p-3">
                    {ALL_SECTIONS.map((section) => (
                      <label
                        key={section.id}
                        className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded p-1"
                      >
                        <Checkbox
                          checked={formSections.includes(section.id)}
                          onCheckedChange={() => toggleSection(section.id)}
                        />
                        <span>{section.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full">
                {editingStaff ? "Salvar Alterações" : "Criar Conta"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Staff list */}
      <div className="space-y-2">
        {staff.map((member) => (
          <Card key={member.id} className={!member.is_active ? "opacity-60" : ""}>
            <CardContent className="flex items-center justify-between py-4 px-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary">
                    {member.display_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{member.display_name}</span>
                    <Badge variant="secondary" className={getRoleBadgeColor(member.role)}>
                      {getRoleLabel(member.role)}
                    </Badge>
                    {!member.is_active && (
                      <Badge variant="outline" className="text-destructive border-destructive/30">
                        Inativo
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">@{member.username}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(member)}>
                  <Edit className="h-4 w-4" />
                </Button>
                {member.role !== "admin" && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleToggleActive(member)}
                      title={member.is_active ? "Desativar" : "Ativar"}
                    >
                      {member.is_active ? (
                        <UserX className="h-4 w-4 text-destructive" />
                      ) : (
                        <UserCheck className="h-4 w-4 text-green-600" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleDelete(member)}
                      title="Excluir conta"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ContasTab;

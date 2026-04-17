import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { Eye, EyeOff, Store, UserCog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AccountSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
}

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder: string;
  required?: boolean;
}

const PasswordField = ({
  label,
  value,
  onChange,
  show,
  onToggle,
  placeholder,
  required,
}: PasswordFieldProps) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="pr-9 text-sm"
      />
      <button type="button" className="absolute right-3 top-2.5 text-muted-foreground" onClick={onToggle}>
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  </div>
);

export const AccountSettingsDialog = ({ open, onOpenChange, restaurantId }: AccountSettingsDialogProps) => {
  // Restaurant side
  const [restName, setRestName] = useState("");
  const [restSlug, setRestSlug] = useState("");
  const [restUsername, setRestUsername] = useState("");
  const [restCurrentPw, setRestCurrentPw] = useState("");
  const [restNewPw, setRestNewPw] = useState("");
  const [showRestCurrentPw, setShowRestCurrentPw] = useState(false);
  const [showRestNewPw, setShowRestNewPw] = useState(false);

  // Staff side
  const [staffUsername, setStaffUsername] = useState("");
  const [staffCurrentPw, setStaffCurrentPw] = useState("");
  const [staffNewPw, setStaffNewPw] = useState("");
  const [showStaffCurrentPw, setShowStaffCurrentPw] = useState(false);
  const [showStaffNewPw, setShowStaffNewPw] = useState(false);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const staffId = localStorage.getItem("staff_id");

  useEffect(() => {
    if (open) fetchData();
  }, [open]);

  const fetchData = async () => {
    setFetching(true);
    try {
      const [credRes, restRes, staffRes] = await Promise.all([
        (supabase as any).from("restaurant_credentials").select("username").eq("restaurant_id", restaurantId).limit(1).single(),
        supabase.from("restaurants").select("name, slug").eq("id", restaurantId).single(),
        staffId
          ? (supabase as any).from("restaurant_staff").select("username").eq("id", staffId).limit(1).single()
          : Promise.resolve({ data: null }),
      ]);
      if (credRes.data) setRestUsername(credRes.data.username);
      if (restRes.data) {
        setRestName(restRes.data.name);
        setRestSlug(restRes.data.slug || "");
      }
      if (staffRes.data) setStaffUsername(staffRes.data.username);
    } catch {
      // ignore
    }
    setFetching(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasRestChanges = restCurrentPw.length > 0;
    const hasStaffChanges = staffCurrentPw.length > 0;

    if (!hasRestChanges && !hasStaffChanges) {
      toast.error("Preencha a senha atual de pelo menos um lado para salvar");
      return;
    }

    if (restNewPw && restNewPw.length < 6) {
      toast.error("A nova senha do restaurante deve ter no mínimo 6 caracteres");
      return;
    }
    if (staffNewPw && staffNewPw.length < 6) {
      toast.error("A nova senha da conta deve ter no mínimo 6 caracteres");
      return;
    }

    if (restSlug && !/^[a-z0-9-]+$/.test(restSlug)) {
      toast.error("O slug deve conter apenas letras minúsculas, números e hífens");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, any> = { restaurant_id: restaurantId };

      if (hasRestChanges) {
        body.restaurant_current_password = restCurrentPw;
        body.new_restaurant_username = restUsername || undefined;
        body.new_restaurant_name = restName || undefined;
        body.new_restaurant_slug = restSlug || undefined;
        body.new_restaurant_password = restNewPw || undefined;
      }

      if (hasStaffChanges && staffId) {
        body.staff_id = staffId;
        body.staff_current_password = staffCurrentPw;
        body.new_staff_username = staffUsername || undefined;
        body.new_staff_password = staffNewPw || undefined;
      }

      const { data, error } = await supabase.functions.invoke("update-restaurant-credentials", { body });
      // Try to extract structured error from FunctionsHttpError context
      if (error) {
        let detailedMsg = error.message;
        try {
          const ctxRes = (error as any)?.context;
          if (ctxRes && typeof ctxRes.json === "function") {
            const parsed = await ctxRes.json();
            if (parsed?.error) detailedMsg = parsed.error;
          }
        } catch { /* ignore */ }
        throw new Error(detailedMsg);
      }
      if (data && !data.success) throw new Error(data.error || "Erro desconhecido ao atualizar dados");

      // Sync localStorage
      if (hasRestChanges) {
        if (restName) localStorage.setItem("restaurant_name", restName);
        if (restSlug) localStorage.setItem("restaurant_slug", restSlug);
      }
      if (hasStaffChanges && staffUsername) {
        localStorage.setItem("staff_name", staffUsername);
      }

      toast.success("Dados atualizados com sucesso!");
      setRestCurrentPw("");
      setRestNewPw("");
      setStaffCurrentPw("");
      setStaffNewPw("");
      onOpenChange(false);

      // If slug changed, redirect
      if (hasRestChanges && restSlug && restSlug !== (localStorage.getItem("restaurant_slug"))) {
        window.location.href = `/${restSlug}/admin`;
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar dados");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dados da Conta</DialogTitle>
        </DialogHeader>
        {fetching ? (
          <p className="text-center text-muted-foreground py-6">Carregando...</p>
        ) : (
          <form onSubmit={handleSave}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* LEFT: Restaurant */}
              <div className="space-y-3 border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Store className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Dados do Restaurante</span>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Nome do Restaurante</Label>
                  <Input value={restName} onChange={(e) => setRestName(e.target.value)} placeholder="Nome" className="text-sm" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Slug (URL)</Label>
                  <Input
                    value={restSlug}
                    onChange={(e) => setRestSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="meu-restaurante"
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Usuário do Restaurante</Label>
                  <Input value={restUsername} onChange={(e) => setRestUsername(e.target.value)} placeholder="Usuário" autoCapitalize="off" className="text-sm" />
                </div>

                <hr className="border-border" />

                <PasswordField
                  label="Senha Atual do Restaurante"
                  value={restCurrentPw}
                  onChange={setRestCurrentPw}
                  show={showRestCurrentPw}
                  onToggle={() => setShowRestCurrentPw(!showRestCurrentPw)}
                  placeholder="Necessária para salvar"
                />

                <PasswordField
                  label="Nova Senha (deixe vazio para manter)"
                  value={restNewPw}
                  onChange={setRestNewPw}
                  show={showRestNewPw}
                  onToggle={() => setShowRestNewPw(!showRestNewPw)}
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              {/* RIGHT: Staff account */}
              <div className="space-y-3 border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <UserCog className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Dados da Conta</span>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Usuário da Conta</Label>
                  <Input value={staffUsername} onChange={(e) => setStaffUsername(e.target.value)} placeholder="Usuário" autoCapitalize="off" className="text-sm" />
                </div>

                <hr className="border-border" />

                <PasswordField
                  label="Senha Atual da Conta"
                  value={staffCurrentPw}
                  onChange={setStaffCurrentPw}
                  show={showStaffCurrentPw}
                  onToggle={() => setShowStaffCurrentPw(!showStaffCurrentPw)}
                  placeholder="Necessária para salvar"
                />

                <PasswordField
                  label="Nova Senha (deixe vazio para manter)"
                  value={staffNewPw}
                  onChange={setStaffNewPw}
                  show={showStaffNewPw}
                  onToggle={() => setShowStaffNewPw(!showStaffNewPw)}
                  placeholder="Mínimo 6 caracteres"
                />

                <p className="text-xs text-muted-foreground mt-2">
                  Preencha a senha atual apenas do lado que deseja alterar.
                </p>
              </div>
            </div>

            <Button type="submit" className="w-full mt-4" disabled={loading}>
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

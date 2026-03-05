import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Code, Monitor, Store, Loader2, Tag, Layers, Settings } from "lucide-react";
import { toast } from "sonner";
import { VersionsTab } from "@/components/dev/VersionsTab";

const DevDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [restaurantCount, setRestaurantCount] = useState(0);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [totalVersions, setTotalVersions] = useState(0);

  useEffect(() => { checkAccess(); fetchStats(); }, []);

  const checkAccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/admin-panel", { replace: true }); return; }
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
    if (!roles?.some(r => r.role === "dev")) {
      toast.error("Acesso negado");
      navigate("/admin-panel", { replace: true });
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    const { count: restCount } = await supabase.from("restaurants").select("*", { count: "exact", head: true });
    setRestaurantCount(restCount || 0);

    const { data: versions, count: verCount } = await supabase
      .from("app_versions")
      .select("version, is_current", { count: "exact" });
    setTotalVersions(verCount || 0);
    const current = (versions || []).find(v => v.is_current);
    setCurrentVersion(current?.version || null);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/admin-panel"); };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent">Painel Dev — Menu's</h1>
            <p className="text-muted-foreground mt-1">Gestão técnica do sistema</p>
          </div>
          <Button onClick={handleLogout} variant="outline"><LogOut className="h-4 w-4 mr-2" /> Sair</Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Restaurantes Ativos</CardTitle></CardHeader>
            <CardContent className="flex items-center gap-3"><Store className="h-8 w-8 text-primary opacity-60" /><p className="text-3xl font-bold text-primary">{restaurantCount}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Versão Atual</CardTitle></CardHeader>
            <CardContent className="flex items-center gap-3"><Tag className="h-8 w-8 text-green-500 opacity-60" /><p className="text-3xl font-bold text-green-600">{currentVersion || "—"}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total de Versões</CardTitle></CardHeader>
            <CardContent className="flex items-center gap-3"><Layers className="h-8 w-8 text-blue-500 opacity-60" /><p className="text-3xl font-bold text-blue-600">{totalVersions}</p></CardContent>
          </Card>
        </div>

        <Tabs defaultValue="versions" className="space-y-4">
          <TabsList>
            <TabsTrigger value="versions"><Code className="h-4 w-4 mr-2" /> Versões</TabsTrigger>
            <TabsTrigger value="config"><Settings className="h-4 w-4 mr-2" /> Configurações</TabsTrigger>
            <TabsTrigger value="monitoring"><Monitor className="h-4 w-4 mr-2" /> Monitoramento</TabsTrigger>
          </TabsList>

          <TabsContent value="versions"><VersionsTab /></TabsContent>

          <TabsContent value="config">
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Configurações Remotas</p>
                <p className="text-sm">Em breve: Feature flags, avisos globais e configurações do sistema.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="monitoring">
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Monitor className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Monitoramento</p>
                <p className="text-sm">Funcionalidade disponível quando o app desktop (Tauri) estiver ativo.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default DevDashboard;

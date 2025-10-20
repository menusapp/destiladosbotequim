import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, Plus, Store, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useInactivityLogout } from "@/hooks/useInactivityLogout";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  created_at: string;
}

const CEODashboard = () => {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(true);
  const [ceoPassword, setCeoPassword] = useState("");
  
  useInactivityLogout();
  
  // Form states
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formPrimaryColor, setFormPrimaryColor] = useState("#FF6B35");
  const [formSecondaryColor, setFormSecondaryColor] = useState("#1A1A1A");
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");

  useEffect(() => {
    const isCEOAuthenticated = localStorage.getItem('is_ceo_authenticated');
    if (isCEOAuthenticated === 'true') {
      setShowPasswordPrompt(false);
      fetchRestaurants();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchRestaurants = async () => {
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRestaurants(data || []);
    } catch (error) {
      toast.error("Erro ao carregar restaurantes");
    } finally {
      setLoading(false);
    }
  };

  const handleCEOLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Senha CEO: "ceo123" (você pode mudar isso)
    if (ceoPassword === "ceo123") {
      localStorage.setItem('is_ceo_authenticated', 'true');
      setShowPasswordPrompt(false);
      fetchRestaurants();
      toast.success("Acesso CEO autorizado");
    } else {
      toast.error("Senha incorreta");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('is_ceo_authenticated');
    toast.success("Logout realizado com sucesso");
    navigate("/");
  };

  const handleOpenDialog = async (restaurant?: Restaurant) => {
    if (restaurant) {
      setEditingRestaurant(restaurant);
      setFormName(restaurant.name);
      setFormSlug(restaurant.slug);
      setFormPrimaryColor(restaurant.primary_color || "#FF6B35");
      setFormSecondaryColor(restaurant.secondary_color || "#1A1A1A");
      setFormUsername("");
      setFormPassword("");
    } else {
      setEditingRestaurant(null);
      setFormName("");
      setFormSlug("");
      setFormPrimaryColor("#FF6B35");
      setFormSecondaryColor("#1A1A1A");
      setFormUsername("");
      setFormPassword("");
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingRestaurant) {
        // Atualizar restaurante
        const { error: restError } = await supabase
          .from("restaurants")
          .update({
            name: formName,
            slug: formSlug,
            primary_color: formPrimaryColor,
            secondary_color: formSecondaryColor,
          })
          .eq("id", editingRestaurant.id);

        if (restError) throw restError;

        toast.success("Restaurante atualizado com sucesso!");
      } else {
        // Criar restaurante
        const { data: restaurant, error: restError } = await supabase
          .from("restaurants")
          .insert({
            name: formName,
            slug: formSlug,
            primary_color: formPrimaryColor,
            secondary_color: formSecondaryColor,
          })
          .select()
          .single();

        if (restError) throw restError;

        // Criar credenciais de login do restaurante
        if (formUsername && formPassword) {
          const { error: credError } = await supabase
            .from("restaurant_credentials")
            .insert({
              restaurant_id: restaurant.id,
              username: formUsername,
              password_hash: formPassword, // Em produção, usar hash real
            });

          if (credError) throw credError;
        }

        toast.success("Restaurante criado com sucesso!");
      }

      setDialogOpen(false);
      setEditingRestaurant(null);
      fetchRestaurants();
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar restaurante");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir ${name}?`)) return;

    try {
      const { error } = await supabase
        .from("restaurants")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Restaurante excluído com sucesso");
      fetchRestaurants();
    } catch (error) {
      toast.error("Erro ao excluir restaurante");
    }
  };

  if (showPasswordPrompt) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Acesso CEO</CardTitle>
            <CardDescription>Digite a senha de CEO para continuar</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCEOLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ceo-password">Senha CEO</Label>
                <Input
                  id="ceo-password"
                  type="password"
                  value={ceoPassword}
                  onChange={(e) => setCeoPassword(e.target.value)}
                  placeholder="Digite a senha"
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  Entrar
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate("/")}>
                  Voltar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Painel CEO - Menu's
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie todos os restaurantes da plataforma
            </p>
          </div>
          <Button onClick={handleLogout} variant="outline">
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Total de Restaurantes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-primary">{restaurants.length}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Restaurantes Cadastrados</CardTitle>
              <CardDescription>Gerencie os restaurantes da plataforma</CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Restaurante
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingRestaurant ? "Editar Restaurante" : "Cadastrar Novo Restaurante"}
                  </DialogTitle>
                  <DialogDescription>
                    {editingRestaurant 
                      ? "Atualize os dados do restaurante e credenciais (deixe em branco para não alterar)"
                      : "Preencha os dados do restaurante e as credenciais de acesso"}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Restaurante</Label>
                    <Input
                      id="name"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Ex: Pizzaria do João"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug (URL)</Label>
                    <Input
                      id="slug"
                      value={formSlug}
                      onChange={(e) => setFormSlug(e.target.value)}
                      placeholder="Ex: pizzaria-do-joao"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="primaryColor">Cor Primária</Label>
                      <div className="flex gap-2">
                        <Input
                          id="primaryColor"
                          type="color"
                          value={formPrimaryColor}
                          onChange={(e) => setFormPrimaryColor(e.target.value)}
                          className="w-20 h-10"
                        />
                        <Input
                          value={formPrimaryColor}
                          onChange={(e) => setFormPrimaryColor(e.target.value)}
                          placeholder="#FF6B35"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="secondaryColor">Cor Secundária</Label>
                      <div className="flex gap-2">
                        <Input
                          id="secondaryColor"
                          type="color"
                          value={formSecondaryColor}
                          onChange={(e) => setFormSecondaryColor(e.target.value)}
                          className="w-20 h-10"
                        />
                        <Input
                          value={formSecondaryColor}
                          onChange={(e) => setFormSecondaryColor(e.target.value)}
                          placeholder="#1A1A1A"
                        />
                      </div>
                    </div>
                  </div>
                  {!editingRestaurant && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="username">Usuário do Restaurante</Label>
                        <Input
                          id="username"
                          type="text"
                          value={formUsername}
                          onChange={(e) => setFormUsername(e.target.value)}
                          placeholder="usuario_restaurante"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Senha do Restaurante</Label>
                        <Input
                          id="password"
                          type="password"
                          value={formPassword}
                          onChange={(e) => setFormPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          required
                          minLength={6}
                        />
                      </div>
                    </>
                  )}
                  <Button type="submit" className="w-full">
                    {editingRestaurant ? "Atualizar Restaurante" : "Criar Restaurante"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {restaurants.length === 0 ? (
              <div className="text-center py-12">
                <Store className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum restaurante cadastrado ainda</p>
              </div>
            ) : (
              <div className="space-y-4">
                {restaurants.map((restaurant) => (
                  <div
                    key={restaurant.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center"
                        style={{ 
                          background: `linear-gradient(135deg, ${restaurant.primary_color || '#FF6B35'}, ${restaurant.secondary_color || '#1A1A1A'})` 
                        }}
                      >
                        <Store className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold">{restaurant.name}</p>
                        <p className="text-sm text-muted-foreground">/{restaurant.slug}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(restaurant)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(restaurant.id, restaurant.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CEODashboard;

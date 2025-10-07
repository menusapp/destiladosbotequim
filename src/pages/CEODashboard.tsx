import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, Plus, Store, Trash2 } from "lucide-react";
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

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  created_at: string;
}

const CEODashboard = () => {
  const navigate = useNavigate();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Form states
  const [newRestName, setNewRestName] = useState("");
  const [newRestSlug, setNewRestSlug] = useState("");
  const [newRestUsername, setNewRestUsername] = useState("");
  const [newRestPassword, setNewRestPassword] = useState("");

  useEffect(() => {
    // Verificar se é CEO
    const userType = sessionStorage.getItem("userType");
    if (userType !== "ceo") {
      navigate("/");
      return;
    }

    fetchRestaurants();
  }, [navigate]);

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

  const handleLogout = () => {
    sessionStorage.clear();
    navigate("/");
    toast.success("Logout realizado com sucesso");
  };

  const handleCreateRestaurant = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Criar restaurante
      const { data: restaurant, error: restError } = await supabase
        .from("restaurants")
        .insert({
          name: newRestName,
          slug: newRestSlug,
        })
        .select()
        .single();

      if (restError) throw restError;

      // Criar credenciais
      const { error: credError } = await supabase
        .from("restaurant_credentials")
        .insert({
          restaurant_id: restaurant.id,
          username: newRestUsername,
          password_hash: newRestPassword, // Em produção, usar bcrypt
        });

      if (credError) throw credError;

      toast.success("Restaurante criado com sucesso!");
      setDialogOpen(false);
      setNewRestName("");
      setNewRestSlug("");
      setNewRestUsername("");
      setNewRestPassword("");
      fetchRestaurants();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar restaurante");
    }
  };

  const handleDeleteRestaurant = async (id: string, name: string) => {
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
        {/* Header */}
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

        {/* Estatísticas */}
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

        {/* Lista de Restaurantes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Restaurantes Cadastrados</CardTitle>
              <CardDescription>Gerencie os restaurantes da plataforma</CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Restaurante
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cadastrar Novo Restaurante</DialogTitle>
                  <DialogDescription>
                    Preencha os dados do restaurante e as credenciais de acesso
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateRestaurant} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Restaurante</Label>
                    <Input
                      id="name"
                      value={newRestName}
                      onChange={(e) => setNewRestName(e.target.value)}
                      placeholder="Ex: Pizzaria do João"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug (URL)</Label>
                    <Input
                      id="slug"
                      value={newRestSlug}
                      onChange={(e) => setNewRestSlug(e.target.value)}
                      placeholder="Ex: pizzaria-do-joao"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Usuário de Login</Label>
                    <Input
                      id="username"
                      value={newRestUsername}
                      onChange={(e) => setNewRestUsername(e.target.value)}
                      placeholder="Ex: pizzaria123"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      value={newRestPassword}
                      onChange={(e) => setNewRestPassword(e.target.value)}
                      placeholder="Digite a senha"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Criar Restaurante
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
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                        <Store className="h-6 w-6 text-primary-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold">{restaurant.name}</p>
                        <p className="text-sm text-muted-foreground">/{restaurant.slug}</p>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteRestaurant(restaurant.id, restaurant.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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

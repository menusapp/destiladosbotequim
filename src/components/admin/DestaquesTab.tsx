import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/components/ui/use-toast";
import { Plus, ChevronUp, ChevronDown, X } from "lucide-react";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_featured: boolean;
  featured_display_order: number;
}

interface DestaquesTabProps {
  restaurantId: string;
}

const DestaquesTab = ({ restaurantId }: DestaquesTabProps) => {
  const [sectionEnabled, setSectionEnabled] = useState(true);
  const [sectionTitle, setSectionTitle] = useState("Destaques");
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [addProductDialogOpen, setAddProductDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
    fetchProducts();
  }, [restaurantId]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("featured_section_enabled, featured_section_title")
        .eq("id", restaurantId)
        .single();
      
      if (error) throw error;
      
      if (data) {
        setSectionEnabled(data.featured_section_enabled ?? true);
        setSectionTitle(data.featured_section_title ?? "Destaques");
      }
    } catch (error) {
      console.error("Erro ao buscar configurações:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações",
        variant: "destructive",
      });
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      
      // Buscar produtos em destaque (ordenados)
      const { data: featured, error: featuredError } = await supabase
        .from("products")
        .select("id, name, description, price, image_url, is_featured, featured_display_order, categories!inner(restaurant_id)")
        .eq("categories.restaurant_id", restaurantId)
        .eq("is_featured", true)
        .order("featured_display_order", { ascending: true });

      if (featuredError) throw featuredError;

      // Buscar todos os produtos disponíveis
      const { data: all, error: allError } = await supabase
        .from("products")
        .select("id, name, description, price, image_url, is_featured, featured_display_order, categories!inner(restaurant_id)")
        .eq("categories.restaurant_id", restaurantId)
        .order("name");

      if (allError) throw allError;

      setFeaturedProducts(featured || []);
      setAvailableProducts(all || []);
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os produtos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSection = async (enabled: boolean) => {
    try {
      const { error } = await supabase
        .from("restaurants")
        .update({ featured_section_enabled: enabled })
        .eq("id", restaurantId);
      
      if (error) throw error;
      
      setSectionEnabled(enabled);
      toast({
        title: "Sucesso",
        description: enabled ? "Seção de destaques habilitada" : "Seção de destaques desabilitada",
      });
    } catch (error) {
      console.error("Erro ao atualizar configuração:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a configuração",
        variant: "destructive",
      });
    }
  };

  const handleSaveTitle = async () => {
    try {
      const { error } = await supabase
        .from("restaurants")
        .update({ featured_section_title: sectionTitle })
        .eq("id", restaurantId);
      
      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Nome da seção atualizado!",
      });
    } catch (error) {
      console.error("Erro ao salvar título:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o nome da seção",
        variant: "destructive",
      });
    }
  };

  const handleAddToFeatured = async (productId: string) => {
    try {
      // Pegar a maior ordem atual + 1
      const maxOrder = Math.max(...featuredProducts.map(p => p.featured_display_order || 0), 0);
      
      const { error } = await supabase
        .from("products")
        .update({ 
          is_featured: true,
          featured_display_order: maxOrder + 1
        })
        .eq("id", productId);
      
      if (error) throw error;
      
      await fetchProducts();
      toast({
        title: "Sucesso",
        description: "Produto adicionado aos destaques!",
      });
    } catch (error) {
      console.error("Erro ao adicionar produto:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o produto",
        variant: "destructive",
      });
    }
  };

  const handleRemoveFromFeatured = async (productId: string) => {
    try {
      const { error } = await supabase
        .from("products")
        .update({ 
          is_featured: false,
          featured_display_order: 0
        })
        .eq("id", productId);
      
      if (error) throw error;
      
      await fetchProducts();
      toast({
        title: "Sucesso",
        description: "Produto removido dos destaques",
      });
    } catch (error) {
      console.error("Erro ao remover produto:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o produto",
        variant: "destructive",
      });
    }
  };

  const handleMoveUp = async (productId: string, currentIndex: number) => {
    if (currentIndex === 0) return;
    
    try {
      const currentProduct = featuredProducts[currentIndex];
      const previousProduct = featuredProducts[currentIndex - 1];
      
      // Trocar as ordens
      await supabase
        .from("products")
        .update({ featured_display_order: previousProduct.featured_display_order })
        .eq("id", currentProduct.id);
      
      await supabase
        .from("products")
        .update({ featured_display_order: currentProduct.featured_display_order })
        .eq("id", previousProduct.id);
      
      await fetchProducts();
    } catch (error) {
      console.error("Erro ao mover produto:", error);
      toast({
        title: "Erro",
        description: "Não foi possível reordenar o produto",
        variant: "destructive",
      });
    }
  };

  const handleMoveDown = async (productId: string, currentIndex: number) => {
    if (currentIndex === featuredProducts.length - 1) return;
    
    try {
      const currentProduct = featuredProducts[currentIndex];
      const nextProduct = featuredProducts[currentIndex + 1];
      
      // Trocar as ordens
      await supabase
        .from("products")
        .update({ featured_display_order: nextProduct.featured_display_order })
        .eq("id", currentProduct.id);
      
      await supabase
        .from("products")
        .update({ featured_display_order: currentProduct.featured_display_order })
        .eq("id", nextProduct.id);
      
      await fetchProducts();
    } catch (error) {
      console.error("Erro ao mover produto:", error);
      toast({
        title: "Erro",
        description: "Não foi possível reordenar o produto",
        variant: "destructive",
      });
    }
  };

  const filteredAvailableProducts = availableProducts
    .filter(p => !p.is_featured)
    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Configuração da Seção */}
      <Card>
        <CardHeader>
          <CardTitle>Configuração da Seção</CardTitle>
          <CardDescription>
            Personalize como os destaques aparecem no cardápio digital
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toggle para habilitar/desabilitar */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="section-enabled">Exibir seção de destaques</Label>
              <p className="text-sm text-muted-foreground">
                Mostrar produtos em destaque antes das categorias
              </p>
            </div>
            <Switch
              id="section-enabled"
              checked={sectionEnabled}
              onCheckedChange={handleToggleSection}
            />
          </div>
          
          {/* Input para nome da seção */}
          {sectionEnabled && (
            <div className="space-y-2">
              <Label htmlFor="section-title">Nome da Seção</Label>
              <div className="flex gap-2">
                <Input
                  id="section-title"
                  value={sectionTitle}
                  onChange={(e) => setSectionTitle(e.target.value)}
                  placeholder="Ex: Destaques, Promoções, Mais Vendidos..."
                  className="flex-1"
                />
                <Button onClick={handleSaveTitle} size="default">
                  Salvar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Deixe em branco para não exibir título
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Produtos em Destaque */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Produtos em Destaque</h2>
            <p className="text-sm text-muted-foreground">
              {featuredProducts.length} produto(s) adicionado(s)
            </p>
          </div>
          <Button onClick={() => setAddProductDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Produto Existente
          </Button>
        </div>

        {featuredProducts.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">
              Nenhum produto adicionado aos destaques ainda
            </p>
            <Button variant="outline" onClick={() => setAddProductDialogOpen(true)}>
              Adicionar Primeiro Produto
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4">
            {featuredProducts.map((product, index) => (
              <Card key={product.id} className="p-4">
                <div className="flex items-center gap-4">
                  {/* Imagem do produto */}
                  <img
                    src={product.image_url || "/placeholder.svg"}
                    alt={product.name}
                    className="w-20 h-20 object-cover rounded"
                  />
                  
                  {/* Informações */}
                  <div className="flex-1">
                    <h3 className="font-medium">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      R$ {product.price.toFixed(2)}
                    </p>
                  </div>
                  
                  {/* Controles de ordem */}
                  <div className="flex flex-col gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMoveUp(product.id, index)}
                      disabled={index === 0}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMoveDown(product.id, index)}
                      disabled={index === featuredProducts.length - 1}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  {/* Botão remover */}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleRemoveFromFeatured(product.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog de seleção de produtos */}
      <Dialog open={addProductDialogOpen} onOpenChange={setAddProductDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Adicionar Produto aos Destaques</DialogTitle>
            <DialogDescription>
              Selecione os produtos que deseja adicionar à seção de destaques
            </DialogDescription>
          </DialogHeader>
          
          {/* Busca */}
          <div className="mb-4">
            <Input
              placeholder="Buscar produtos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          {/* Lista de produtos disponíveis */}
          <ScrollArea className="h-[400px] pr-4">
            {filteredAvailableProducts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "Nenhum produto encontrado" : "Todos os produtos já estão nos destaques"}
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredAvailableProducts.map(product => (
                  <Card key={product.id} className="p-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={product.image_url || "/placeholder.svg"}
                        alt={product.name}
                        className="w-16 h-16 object-cover rounded"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium">{product.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          R$ {product.price.toFixed(2)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          handleAddToFeatured(product.id);
                          setSearchQuery("");
                        }}
                      >
                        Adicionar
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DestaquesTab;

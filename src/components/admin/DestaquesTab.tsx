import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import { Plus, ChevronUp, ChevronDown, X, Clock, Calendar } from "lucide-react";
import { FeaturedScheduleEntry } from "@/lib/featuredUtils";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_featured: boolean;
  featured_display_order: number;
  featured_active: boolean | null;
  featured_schedule: FeaturedScheduleEntry[] | null;
}

interface DestaquesTabProps {
  restaurantId: string;
}

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const DestaquesTab = ({ restaurantId }: DestaquesTabProps) => {
  const [sectionEnabled, setSectionEnabled] = useState(true);
  const [sectionTitle, setSectionTitle] = useState("Destaques");
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [addProductDialogOpen, setAddProductDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Schedule dialog state
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleProduct, setScheduleProduct] = useState<Product | null>(null);
  const [scheduleAlwaysVisible, setScheduleAlwaysVisible] = useState(true);
  const [scheduleDays, setScheduleDays] = useState<{ [day: number]: { enabled: boolean; start: string; end: string } }>({});

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
      toast({ title: "Erro", description: "Não foi possível carregar as configurações", variant: "destructive" });
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      
      const { data: featured, error: featuredError } = await supabase
        .from("products")
        .select("id, name, description, price, image_url, is_featured, featured_display_order, featured_active, featured_schedule, categories!inner(restaurant_id)")
        .eq("categories.restaurant_id", restaurantId)
        .eq("is_featured", true)
        .order("featured_display_order", { ascending: true });

      if (featuredError) throw featuredError;

      const { data: all, error: allError } = await supabase
        .from("products")
        .select("id, name, description, price, image_url, is_featured, featured_display_order, featured_active, featured_schedule, categories!inner(restaurant_id)")
        .eq("categories.restaurant_id", restaurantId)
        .order("name");

      if (allError) throw allError;

      setFeaturedProducts((featured || []).map(p => ({
        ...p,
        featured_active: p.featured_active ?? true,
        featured_schedule: (p.featured_schedule as unknown as FeaturedScheduleEntry[]) || null,
      })));
      setAvailableProducts((all || []).map(p => ({
        ...p,
        featured_active: p.featured_active ?? true,
        featured_schedule: (p.featured_schedule as unknown as FeaturedScheduleEntry[]) || null,
      })));
    } catch (error) {
      console.error("Erro ao buscar produtos:", error);
      toast({ title: "Erro", description: "Não foi possível carregar os produtos", variant: "destructive" });
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
      toast({ title: "Sucesso", description: enabled ? "Seção de destaques habilitada" : "Seção de destaques desabilitada" });
    } catch (error) {
      console.error("Erro ao atualizar configuração:", error);
      toast({ title: "Erro", description: "Não foi possível atualizar a configuração", variant: "destructive" });
    }
  };

  const handleSaveTitle = async () => {
    try {
      const { error } = await supabase
        .from("restaurants")
        .update({ featured_section_title: sectionTitle })
        .eq("id", restaurantId);
      if (error) throw error;
      toast({ title: "Sucesso", description: "Nome da seção atualizado!" });
    } catch (error) {
      console.error("Erro ao salvar título:", error);
      toast({ title: "Erro", description: "Não foi possível salvar o nome da seção", variant: "destructive" });
    }
  };

  const handleAddToFeatured = async (productId: string) => {
    try {
      const maxOrder = Math.max(...featuredProducts.map(p => p.featured_display_order || 0), 0);
      const { error } = await supabase
        .from("products")
        .update({ is_featured: true, featured_display_order: maxOrder + 1, featured_active: true })
        .eq("id", productId);
      if (error) throw error;
      await fetchProducts();
      toast({ title: "Sucesso", description: "Produto adicionado aos destaques!" });
    } catch (error) {
      console.error("Erro ao adicionar produto:", error);
      toast({ title: "Erro", description: "Não foi possível adicionar o produto", variant: "destructive" });
    }
  };

  const handleRemoveFromFeatured = async (productId: string) => {
    try {
      const { error } = await supabase
        .from("products")
        .update({ is_featured: false, featured_display_order: 0, featured_active: true, featured_schedule: null })
        .eq("id", productId);
      if (error) throw error;
      await fetchProducts();
      toast({ title: "Sucesso", description: "Produto removido dos destaques" });
    } catch (error) {
      console.error("Erro ao remover produto:", error);
      toast({ title: "Erro", description: "Não foi possível remover o produto", variant: "destructive" });
    }
  };

  const handleToggleFeaturedActive = async (productId: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from("products")
        .update({ featured_active: active })
        .eq("id", productId);
      if (error) throw error;
      setFeaturedProducts(prev => prev.map(p => p.id === productId ? { ...p, featured_active: active } : p));
      toast({ title: active ? "Destaque ativado" : "Destaque desativado" });
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível atualizar", variant: "destructive" });
    }
  };

  const handleMoveUp = async (productId: string, currentIndex: number) => {
    if (currentIndex === 0) return;
    try {
      const currentProduct = featuredProducts[currentIndex];
      const previousProduct = featuredProducts[currentIndex - 1];
      await supabase.from("products").update({ featured_display_order: previousProduct.featured_display_order }).eq("id", currentProduct.id);
      await supabase.from("products").update({ featured_display_order: currentProduct.featured_display_order }).eq("id", previousProduct.id);
      await fetchProducts();
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível reordenar o produto", variant: "destructive" });
    }
  };

  const handleMoveDown = async (productId: string, currentIndex: number) => {
    if (currentIndex === featuredProducts.length - 1) return;
    try {
      const currentProduct = featuredProducts[currentIndex];
      const nextProduct = featuredProducts[currentIndex + 1];
      await supabase.from("products").update({ featured_display_order: nextProduct.featured_display_order }).eq("id", currentProduct.id);
      await supabase.from("products").update({ featured_display_order: currentProduct.featured_display_order }).eq("id", nextProduct.id);
      await fetchProducts();
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível reordenar o produto", variant: "destructive" });
    }
  };

  // Schedule dialog
  const openScheduleDialog = (product: Product) => {
    setScheduleProduct(product);
    const schedule = product.featured_schedule;
    if (!schedule || schedule.length === 0) {
      setScheduleAlwaysVisible(true);
      const days: typeof scheduleDays = {};
      for (let i = 0; i < 7; i++) days[i] = { enabled: false, start: "08:00", end: "22:00" };
      setScheduleDays(days);
    } else {
      setScheduleAlwaysVisible(false);
      const days: typeof scheduleDays = {};
      for (let i = 0; i < 7; i++) {
        const entry = schedule.find(s => s.day === i);
        days[i] = entry ? { enabled: true, start: entry.start, end: entry.end } : { enabled: false, start: "08:00", end: "22:00" };
      }
      setScheduleDays(days);
    }
    setScheduleDialogOpen(true);
  };

  const handleSaveSchedule = async () => {
    if (!scheduleProduct) return;
    try {
      let scheduleData: FeaturedScheduleEntry[] | null = null;
      if (!scheduleAlwaysVisible) {
        scheduleData = Object.entries(scheduleDays)
          .filter(([, v]) => v.enabled)
          .map(([day, v]) => ({ day: parseInt(day), start: v.start, end: v.end }));
        if (scheduleData.length === 0) scheduleData = null;
      }
      const { error } = await supabase
        .from("products")
        .update({ featured_schedule: scheduleData as unknown as any })
        .eq("id", scheduleProduct.id);
      if (error) throw error;
      setScheduleDialogOpen(false);
      await fetchProducts();
      toast({ title: "Sucesso", description: "Programação salva!" });
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível salvar a programação", variant: "destructive" });
    }
  };

  const getStatusBadge = (product: Product) => {
    if (!product.featured_active) {
      return <Badge variant="secondary" className="text-xs">Inativo</Badge>;
    }
    if (product.featured_schedule && product.featured_schedule.length > 0) {
      return <Badge className="text-xs bg-amber-500/15 text-amber-700 border-amber-200 hover:bg-amber-500/15">Programado</Badge>;
    }
    return <Badge className="text-xs bg-emerald-500/15 text-emerald-700 border-emerald-200 hover:bg-emerald-500/15">Ativo</Badge>;
  };

  const getScheduleSummary = (schedule: FeaturedScheduleEntry[] | null) => {
    if (!schedule || schedule.length === 0) return "Sempre visível";
    return schedule.map(s => `${DAY_SHORT[s.day]} ${s.start}-${s.end}`).join(", ");
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
          <CardDescription>Personalize como os destaques aparecem no cardápio digital</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="section-enabled">Exibir seção de destaques</Label>
              <p className="text-sm text-muted-foreground">Mostrar produtos em destaque antes das categorias</p>
            </div>
            <Switch id="section-enabled" checked={sectionEnabled} onCheckedChange={handleToggleSection} />
          </div>
          {sectionEnabled && (
            <div className="space-y-2">
              <Label htmlFor="section-title">Nome da Seção</Label>
              <div className="flex gap-2">
                <Input id="section-title" value={sectionTitle} onChange={(e) => setSectionTitle(e.target.value)} placeholder="Ex: Destaques, Promoções, Mais Vendidos..." className="flex-1" />
                <Button onClick={handleSaveTitle} size="default">Salvar</Button>
              </div>
              <p className="text-xs text-muted-foreground">Deixe em branco para não exibir título</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Produtos em Destaque */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Produtos em Destaque</h2>
            <p className="text-sm text-muted-foreground">{featuredProducts.length} produto(s) adicionado(s)</p>
          </div>
          <Button onClick={() => setAddProductDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Produto Existente
          </Button>
        </div>

        {featuredProducts.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-muted-foreground mb-4">Nenhum produto adicionado aos destaques ainda</p>
            <Button variant="outline" onClick={() => setAddProductDialogOpen(true)}>Adicionar Primeiro Produto</Button>
          </Card>
        ) : (
          <div className="grid gap-4">
            {featuredProducts.map((product, index) => (
              <Card key={product.id} className="p-4">
                <div className="flex items-center gap-4">
                  <img src={product.image_url || "/placeholder.svg"} alt={product.name} className="w-20 h-20 object-cover rounded" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium">{product.name}</h3>
                      {getStatusBadge(product)}
                    </div>
                    <p className="text-sm text-muted-foreground">R$ {product.price.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      <Clock className="inline w-3 h-3 mr-1" />
                      {getScheduleSummary(product.featured_schedule)}
                    </p>
                  </div>

                  {/* Toggle ativo/inativo */}
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs text-muted-foreground">Ativo</span>
                    <Switch
                      checked={product.featured_active !== false}
                      onCheckedChange={(checked) => handleToggleFeaturedActive(product.id, checked)}
                    />
                  </div>

                  {/* Botão programar */}
                  <Button size="sm" variant="outline" onClick={() => openScheduleDialog(product)} title="Programar horários">
                    <Calendar className="w-4 h-4" />
                  </Button>

                  {/* Controles de ordem */}
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="outline" onClick={() => handleMoveUp(product.id, index)} disabled={index === 0}>
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleMoveDown(product.id, index)} disabled={index === featuredProducts.length - 1}>
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </div>

                  <Button size="sm" variant="destructive" onClick={() => handleRemoveFromFeatured(product.id)}>
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
            <DialogDescription>Selecione os produtos que deseja adicionar à seção de destaques</DialogDescription>
          </DialogHeader>
          <div className="mb-4">
            <Input placeholder="Buscar produtos..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
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
                      <img src={product.image_url || "/placeholder.svg"} alt={product.name} className="w-16 h-16 object-cover rounded" />
                      <div className="flex-1">
                        <h4 className="font-medium">{product.name}</h4>
                        <p className="text-sm text-muted-foreground">R$ {product.price.toFixed(2)}</p>
                      </div>
                      <Button size="sm" onClick={() => { handleAddToFeatured(product.id); setSearchQuery(""); }}>
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

      {/* Dialog de programação */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Programar Destaque</DialogTitle>
            <DialogDescription>
              Defina quando "{scheduleProduct?.name}" aparece como destaque
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Checkbox
                id="always-visible"
                checked={scheduleAlwaysVisible}
                onCheckedChange={(checked) => setScheduleAlwaysVisible(checked === true)}
              />
              <Label htmlFor="always-visible" className="font-medium">Sempre visível (sem restrição de horário)</Label>
            </div>

            {!scheduleAlwaysVisible && (
              <div className="space-y-3 border rounded-lg p-4">
                <p className="text-sm text-muted-foreground mb-2">Selecione os dias e horários:</p>
                {[0, 1, 2, 3, 4, 5, 6].map(day => (
                  <div key={day} className="flex items-center gap-3">
                    <Checkbox
                      checked={scheduleDays[day]?.enabled || false}
                      onCheckedChange={(checked) => {
                        setScheduleDays(prev => ({
                          ...prev,
                          [day]: { ...prev[day], enabled: checked === true }
                        }));
                      }}
                    />
                    <span className="text-sm w-20">{DAY_NAMES[day]}</span>
                    {scheduleDays[day]?.enabled && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={scheduleDays[day]?.start || "08:00"}
                          onChange={(e) => setScheduleDays(prev => ({
                            ...prev,
                            [day]: { ...prev[day], start: e.target.value }
                          }))}
                          className="w-28 h-8 text-sm"
                        />
                        <span className="text-sm text-muted-foreground">até</span>
                        <Input
                          type="time"
                          value={scheduleDays[day]?.end || "22:00"}
                          onChange={(e) => setScheduleDays(prev => ({
                            ...prev,
                            [day]: { ...prev[day], end: e.target.value }
                          }))}
                          className="w-28 h-8 text-sm"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveSchedule}>Salvar Programação</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DestaquesTab;

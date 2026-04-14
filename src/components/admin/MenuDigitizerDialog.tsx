import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Camera,
  Upload,
  Loader2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Check,
  Pizza,
  Beef,
  IceCream,
  Fish,
  Coffee,
  UtensilsCrossed,
} from "lucide-react";

interface ExtractedProduct {
  name: string;
  description?: string;
  price: number;
}

interface ExtractedCategory {
  name: string;
  products: ExtractedProduct[];
}

interface MenuDigitizerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  onImportComplete: () => void;
}

const cuisineTypes = [
  { id: "pizzaria", label: "Pizzaria", icon: Pizza },
  { id: "hamburgueria", label: "Hamburgueria", icon: Beef },
  { id: "acai", label: "Açaí / Sorveteria", icon: IceCream },
  { id: "sushi", label: "Sushi / Japonesa", icon: Fish },
  { id: "cafeteria", label: "Cafeteria", icon: Coffee },
  { id: "outros", label: "Outros", icon: UtensilsCrossed },
];

const MenuDigitizerDialog = ({
  open,
  onOpenChange,
  restaurantId,
  onImportComplete,
}: MenuDigitizerDialogProps) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [cuisineType, setCuisineType] = useState("");
  const [customCuisine, setCustomCuisine] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedCategory[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep(1);
    setCuisineType("");
    setCustomCuisine("");
    setImagePreview(null);
    setImageBase64(null);
    setIsAnalyzing(false);
    setIsSaving(false);
    setExtractedData([]);
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem (JPG, PNG)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 10MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setImagePreview(result);
      setImageBase64(result);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!imageBase64) return;
    setIsAnalyzing(true);

    try {
      const { data, error } = await supabase.functions.invoke("digitize-menu", {
        body: {
          image_base64: imageBase64,
          cuisine_type: cuisineType,
          custom_cuisine: cuisineType === "outros" ? customCuisine : undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (!data?.categories?.length) {
        toast.error("Nenhum produto encontrado na imagem. Tente com outra foto.");
        return;
      }

      setExtractedData(data.categories);
      setStep(3);
      toast.success(`${data.categories.reduce((acc: number, c: ExtractedCategory) => acc + c.products.length, 0)} produtos encontrados!`);
    } catch (err: any) {
      console.error("Analyze error:", err);
      toast.error(err.message || "Erro ao analisar cardápio");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateProduct = (catIdx: number, prodIdx: number, field: keyof ExtractedProduct, value: string | number) => {
    setExtractedData((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[catIdx].products[prodIdx][field] = value;
      return copy;
    });
  };

  const removeProduct = (catIdx: number, prodIdx: number) => {
    setExtractedData((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[catIdx].products.splice(prodIdx, 1);
      if (copy[catIdx].products.length === 0) copy.splice(catIdx, 1);
      return copy;
    });
  };

  const updateCategoryName = (catIdx: number, name: string) => {
    setExtractedData((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[catIdx].name = name;
      return copy;
    });
  };

  const removeCategory = (catIdx: number) => {
    setExtractedData((prev) => prev.filter((_, i) => i !== catIdx));
  };

  const handleConfirmImport = async () => {
    if (!extractedData.length) return;
    setIsSaving(true);

    try {
      for (const category of extractedData) {
        // Get max display_order
        const { data: existingCats } = await supabase
          .from("categories")
          .select("display_order")
          .eq("restaurant_id", restaurantId)
          .order("display_order", { ascending: false })
          .limit(1);

        const nextOrder = (existingCats?.[0]?.display_order ?? 0) + 1;

        // Insert category
        const { data: newCat, error: catError } = await supabase
          .from("categories")
          .insert({ name: category.name, restaurant_id: restaurantId, display_order: nextOrder })
          .select("id")
          .single();

        if (catError) throw catError;

        // Insert products
        if (category.products.length > 0) {
          const productsToInsert = category.products.map((p) => ({
            name: p.name,
            description: p.description || null,
            price: p.price,
            category_id: newCat.id,
            available: true,
          }));

          const { error: prodError } = await supabase
            .from("products")
            .insert(productsToInsert);

          if (prodError) throw prodError;
        }
      }

      const totalProducts = extractedData.reduce((acc, c) => acc + c.products.length, 0);
      toast.success(`${totalProducts} produtos importados com sucesso!`);
      onImportComplete();
      handleClose(false);
    } catch (err: any) {
      console.error("Import error:", err);
      toast.error(err.message || "Erro ao importar produtos");
    } finally {
      setIsSaving(false);
    }
  };

  const totalProducts = extractedData.reduce((acc, c) => acc + c.products.length, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 1 && "Importar Cardápio por Foto"}
            {step === 2 && "Enviar Foto do Cardápio"}
            {step === 3 && "Revisar Produtos Extraídos"}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && "Selecione o tipo de culinária para uma extração mais precisa"}
            {step === 2 && "Envie uma foto clara do cardápio físico"}
            {step === 3 && `${totalProducts} produtos em ${extractedData.length} categorias. Edite antes de importar.`}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Cuisine Selection */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {cuisineTypes.map((ct) => {
                const Icon = ct.icon;
                return (
                  <button
                    key={ct.id}
                    onClick={() => setCuisineType(ct.id)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      cuisineType === ct.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Icon className="h-8 w-8" />
                    <span className="text-sm font-medium">{ct.label}</span>
                  </button>
                );
              })}
            </div>

            {cuisineType === "outros" && (
              <div>
                <Label>Tipo de culinária</Label>
                <Input
                  placeholder="Ex: Comida árabe, Marmitaria, Pastelaria..."
                  value={customCuisine}
                  onChange={(e) => setCustomCuisine(e.target.value)}
                />
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={() => setStep(2)}
                disabled={!cuisineType || (cuisineType === "outros" && !customCuisine)}
              >
                Próximo
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Photo Upload */}
        {step === 2 && (
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {!imagePreview ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-64 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-3 hover:border-primary/50 transition-colors"
              >
                <Upload className="h-10 w-10 text-muted-foreground" />
                <span className="text-muted-foreground">Clique para enviar a foto do cardápio</span>
                <span className="text-xs text-muted-foreground">JPG ou PNG, máximo 10MB</span>
              </button>
            ) : (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Preview do cardápio"
                  className="w-full max-h-80 object-contain rounded-lg border"
                />
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    setImagePreview(null);
                    setImageBase64(null);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
              <Button onClick={handleAnalyze} disabled={!imageBase64 || isAnalyzing}>
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 mr-1" />
                    Analisar Cardápio
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-4">
            {extractedData.map((cat, catIdx) => (
              <div key={catIdx} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={cat.name}
                    onChange={(e) => updateCategoryName(catIdx, e.target.value)}
                    className="font-semibold text-base"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCategory(catIdx)}
                    className="text-destructive shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2 pl-2">
                  {cat.products.map((prod, prodIdx) => (
                    <div
                      key={prodIdx}
                      className="flex items-start gap-2 p-2 rounded bg-muted/50"
                    >
                      <div className="flex-1 space-y-1">
                        <Input
                          value={prod.name}
                          onChange={(e) =>
                            updateProduct(catIdx, prodIdx, "name", e.target.value)
                          }
                          placeholder="Nome do produto"
                          className="h-8 text-sm"
                        />
                        <Textarea
                          value={prod.description || ""}
                          onChange={(e) =>
                            updateProduct(catIdx, prodIdx, "description", e.target.value)
                          }
                          placeholder="Descrição (opcional)"
                          className="min-h-[40px] text-xs resize-none"
                          rows={1}
                        />
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-muted-foreground">R$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={prod.price}
                          onChange={(e) =>
                            updateProduct(catIdx, prodIdx, "price", parseFloat(e.target.value) || 0)
                          }
                          className="w-20 h-8 text-sm"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => removeProduct(catIdx, prodIdx)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Nova Foto
              </Button>
              <Button onClick={handleConfirmImport} disabled={isSaving || !totalProducts}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Importar {totalProducts} produtos
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MenuDigitizerDialog;

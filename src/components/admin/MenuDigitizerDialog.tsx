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
import { getAllUsedPdvCodes } from "@/lib/pdvCodeGenerator";
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
  Link,
  Image,
} from "lucide-react";

interface ExtractedItem {
  name: string;
  description?: string;
  price: number;
  image_url?: string;
}

interface ExtractedCategory {
  name: string;
  products?: ExtractedItem[];
  items?: ExtractedItem[];
}

export type ImportMode = "products" | "complements";

interface MenuDigitizerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  onImportComplete: () => void;
  mode: ImportMode;
}

const cuisineTypes = [
  { id: "pizzaria", label: "Pizzaria", icon: Pizza },
  { id: "hamburgueria", label: "Hamburgueria", icon: Beef },
  { id: "acai", label: "Açaí / Sorveteria", icon: IceCream },
  { id: "sushi", label: "Sushi / Japonesa", icon: Fish },
  { id: "cafeteria", label: "Cafeteria", icon: Coffee },
  { id: "outros", label: "Outros", icon: UtensilsCrossed },
];

type ImportSource = "photo" | "url";

const fetchReadablePageContent = async (url: string) => {
  if (!/pedido\.anota\.ai\/loja\//i.test(url)) return undefined;

  const response = await fetch(`https://r.jina.ai/http://${url}`, {
    headers: { Accept: "text/plain,text/markdown,*/*" },
  });

  if (!response.ok) return undefined;
  const text = await response.text();
  return text.length > 500 ? text : undefined;
};

const MenuDigitizerDialog = ({
  open,
  onOpenChange,
  restaurantId,
  onImportComplete,
  mode,
}: MenuDigitizerDialogProps) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [importSource, setImportSource] = useState<ImportSource | null>(null);
  const [cuisineType, setCuisineType] = useState("");
  const [customCuisine, setCustomCuisine] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [menuUrl, setMenuUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedCategory[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isComplements = mode === "complements";
  const modeLabel = isComplements ? "Complementos" : "Produtos";

  const getItems = (cat: ExtractedCategory): ExtractedItem[] =>
    cat.items || cat.products || [];

  const reset = () => {
    setStep(1);
    setImportSource(null);
    setCuisineType("");
    setCustomCuisine("");
    setImagePreview(null);
    setImageBase64(null);
    setMenuUrl("");
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

  const handleAnalyzePhoto = async () => {
    if (!imageBase64) return;
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("digitize-menu", {
        body: {
          image_base64: imageBase64,
          cuisine_type: cuisineType,
          custom_cuisine: cuisineType === "outros" ? customCuisine : undefined,
          mode,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.categories?.length) {
        toast.error(`Nenhum ${isComplements ? "complemento" : "produto"} encontrado na imagem. Tente com outra foto.`);
        return;
      }
      setExtractedData(data.categories);
      setStep(3);
      const total = data.categories.reduce((acc: number, c: ExtractedCategory) => acc + (c.items || c.products || []).length, 0);
      toast.success(`${total} ${isComplements ? "complementos" : "produtos"} encontrados!`);
    } catch (err: any) {
      console.error("Analyze error:", err);
      toast.error(err.message || "Erro ao analisar cardápio");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAnalyzeUrl = async () => {
    if (!menuUrl.trim()) return;
    setIsAnalyzing(true);
    try {
      const trimmedUrl = menuUrl.trim();
      const pageContent = await fetchReadablePageContent(trimmedUrl);
      const { data, error } = await supabase.functions.invoke("digitize-menu-url", {
        body: {
          url: trimmedUrl,
          page_content: pageContent,
          cuisine_type: cuisineType,
          custom_cuisine: cuisineType === "outros" ? customCuisine : undefined,
          mode,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.categories?.length) {
        toast.error(`Nenhum ${isComplements ? "complemento" : "produto"} encontrado no site. Tente outro link.`);
        return;
      }
      setExtractedData(data.categories);
      setStep(3);
      const total = data.categories.reduce((acc: number, c: ExtractedCategory) => acc + (c.items || c.products || []).length, 0);
      toast.success(`${total} ${isComplements ? "complementos" : "produtos"} encontrados!`);
    } catch (err: any) {
      console.error("URL analyze error:", err);
      toast.error(err.message || "Erro ao analisar cardápio pelo link");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateItem = (catIdx: number, itemIdx: number, field: keyof ExtractedItem, value: string | number) => {
    setExtractedData((prev) => {
      const copy: ExtractedCategory[] = JSON.parse(JSON.stringify(prev));
      const key = copy[catIdx].items ? "items" : "products";
      (copy[catIdx] as any)[key][itemIdx][field] = value;
      return copy;
    });
  };

  const removeItem = (catIdx: number, itemIdx: number) => {
    setExtractedData((prev) => {
      const copy: ExtractedCategory[] = JSON.parse(JSON.stringify(prev));
      const key = copy[catIdx].items ? "items" : "products";
      (copy[catIdx] as any)[key].splice(itemIdx, 1);
      if ((copy[catIdx] as any)[key].length === 0) copy.splice(catIdx, 1);
      return copy;
    });
  };

  const updateCategoryName = (catIdx: number, name: string) => {
    setExtractedData((prev) => {
      const copy: ExtractedCategory[] = JSON.parse(JSON.stringify(prev));
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
      if (isComplements) {
        await importComplements();
      } else {
        await importProducts();
      }
      const total = extractedData.reduce((acc, c) => acc + getItems(c).length, 0);
      toast.success(`${total} ${isComplements ? "complementos" : "produtos"} importados com sucesso!`);
      onImportComplete();
      handleClose(false);
    } catch (err: any) {
      console.error("Import error:", err);
      toast.error(err.message || "Erro ao importar");
    } finally {
      setIsSaving(false);
    }
  };

  const importProducts = async () => {
    const usedCodes = await getAllUsedPdvCodes(restaurantId);
    let nextCode = 1;
    const getNextPdvCode = () => {
      while (usedCodes.has(nextCode)) nextCode++;
      const code = String(nextCode).padStart(3, "0");
      usedCodes.add(nextCode);
      nextCode++;
      return code;
    };

    for (const category of extractedData) {
      const items = getItems(category);
      const { data: existingCats } = await supabase
        .from("categories")
        .select("display_order")
        .eq("restaurant_id", restaurantId)
        .order("display_order", { ascending: false })
        .limit(1);
      const nextOrder = (existingCats?.[0]?.display_order ?? 0) + 1;
      const { data: newCat, error: catError } = await supabase
        .from("categories")
        .insert({ name: category.name, restaurant_id: restaurantId, display_order: nextOrder })
        .select("id")
        .single();
      if (catError) throw catError;
      if (items.length > 0) {
        const productsToInsert = items.map((p) => ({
          name: p.name,
          description: p.description || null,
          price: p.price,
          category_id: newCat.id,
          restaurant_id: restaurantId,
          available: true,
          pdv_code: getNextPdvCode(),
          image_url: p.image_url || null,
        }));
        const { error: prodError } = await supabase.from("products").insert(productsToInsert as any);
        if (prodError) throw prodError;
      }
    }
  };

  const importComplements = async () => {
    const usedCodes = await getAllUsedPdvCodes(restaurantId);
    let nextCode = 1;
    const getNextPdvCode = () => {
      while (usedCodes.has(nextCode)) nextCode++;
      const code = String(nextCode).padStart(3, "0");
      usedCodes.add(nextCode);
      nextCode++;
      return code;
    };

    for (const category of extractedData) {
      const items = getItems(category);
      const { data: newCat, error: catError } = await supabase
        .from("extra_categories")
        .insert({
          name: category.name,
          restaurant_id: restaurantId,
          is_required: false,
          min_quantity: 0,
          max_quantity: items.length,
        })
        .select("id")
        .single();
      if (catError) throw catError;
      if (items.length > 0) {
        const itemsToInsert = items.map((item) => ({
          name: item.name,
          description: item.description || null,
          price: item.price,
          category_id: newCat.id,
          is_active: true,
          pdv_code: getNextPdvCode(),
        }));
        const { error: itemError } = await supabase.from("extra_category_items").insert(itemsToInsert);
        if (itemError) throw itemError;
      }
    }
  };

  const totalItems = extractedData.reduce((acc, c) => acc + getItems(c).length, 0);

  const getStepTitle = () => {
    if (step === 1 && !importSource) return `Importar ${modeLabel}`;
    if (step === 1) return `Tipo de Culinária`;
    if (step === 2 && importSource === "url") return "Importar por Link";
    if (step === 2) return "Enviar Foto do Cardápio";
    return `Revisar ${modeLabel} Extraídos`;
  };

  const getStepDescription = () => {
    if (step === 1 && !importSource) return "Escolha como deseja importar o cardápio";
    if (step === 1) return "Selecione o tipo de culinária para uma extração mais precisa";
    if (step === 2 && importSource === "url") return "Cole o link do cardápio digital";
    if (step === 2) return "Envie uma foto clara do cardápio físico";
    return `${totalItems} ${isComplements ? "complementos" : "produtos"} em ${extractedData.length} categorias. Edite antes de importar.`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getStepTitle()}</DialogTitle>
          <DialogDescription>{getStepDescription()}</DialogDescription>
        </DialogHeader>

        {/* Step 1: Source Selection + Cuisine */}
        {step === 1 && !importSource && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setImportSource("photo")}
                className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary/50 transition-all"
              >
                <Image className="h-10 w-10 text-primary" />
                <div className="text-center">
                  <p className="font-semibold">🪄 Importar por AI</p>
                  <p className="text-xs text-muted-foreground mt-1">Envie uma foto do cardápio físico</p>
                </div>
              </button>
              <button
                onClick={() => setImportSource("url")}
                className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary/50 transition-all"
              >
                <Link className="h-10 w-10 text-primary" />
                <div className="text-center">
                  <p className="font-semibold">Link do Cardápio</p>
                  <p className="text-xs text-muted-foreground mt-1">Cole o link de um cardápio digital</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {step === 1 && importSource && (
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
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => { setImportSource(null); setCuisineType(""); setCustomCuisine(""); }}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
              <Button onClick={() => setStep(2)} disabled={!cuisineType || (cuisineType === "outros" && !customCuisine)}>
                Próximo
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Photo Upload */}
        {step === 2 && importSource === "photo" && (
          <div className="space-y-4">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
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
                <img src={imagePreview} alt="Preview do cardápio" className="w-full max-h-80 object-contain rounded-lg border" />
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => { setImagePreview(null); setImageBase64(null); }}
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
              <Button onClick={handleAnalyzePhoto} disabled={!imageBase64 || isAnalyzing}>
                {isAnalyzing ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1" />Analisando...</>
                ) : (
                  <><Camera className="h-4 w-4 mr-1" />Analisar Cardápio</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: URL Input */}
        {step === 2 && importSource === "url" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Link do cardápio digital</Label>
              <Input
                type="url"
                placeholder="https://exemplo.com/cardapio"
                value={menuUrl}
                onChange={(e) => setMenuUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Cole o link completo do cardápio digital. Funciona melhor com sites que exibem os produtos diretamente na página (sem login).
              </p>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
              <Button onClick={handleAnalyzeUrl} disabled={!menuUrl.trim() || isAnalyzing}>
                {isAnalyzing ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1" />Analisando...</>
                ) : (
                  <><Link className="h-4 w-4 mr-1" />Analisar Link</>
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
                  <Input value={cat.name} onChange={(e) => updateCategoryName(catIdx, e.target.value)} className="font-semibold text-base" />
                  <Button variant="ghost" size="icon" onClick={() => removeCategory(catIdx)} className="text-destructive shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2 pl-2">
                  {getItems(cat).map((item, itemIdx) => (
                    <div key={itemIdx} className="flex items-start gap-2 p-2 rounded bg-muted/50">
                      {/* Image upload */}
                      {!isComplements && (
                        <label className="shrink-0 w-14 h-14 rounded border border-dashed border-border flex items-center justify-center cursor-pointer overflow-hidden hover:border-primary/50 transition-colors relative group">
                          {item.image_url ? (
                            <>
                              <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Camera className="h-4 w-4 text-white" />
                              </div>
                            </>
                          ) : (
                            <Camera className="h-4 w-4 text-muted-foreground" />
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 5 * 1024 * 1024) {
                                toast.error("Imagem muito grande (máx 5MB)");
                                return;
                              }
                              const ext = file.name.split(".").pop() || "jpg";
                              const path = `${restaurantId}/${Date.now()}_${itemIdx}.${ext}`;
                              const { error: uploadErr } = await supabase.storage
                                .from("products")
                                .upload(path, file, { upsert: true });
                              if (uploadErr) {
                                toast.error("Erro ao enviar imagem");
                                return;
                              }
                              const { data: urlData } = supabase.storage.from("products").getPublicUrl(path);
                              updateItem(catIdx, itemIdx, "image_url", urlData.publicUrl);
                            }}
                          />
                        </label>
                      )}
                      <div className="flex-1 space-y-1">
                        <Input value={item.name} onChange={(e) => updateItem(catIdx, itemIdx, "name", e.target.value)} placeholder={`Nome do ${isComplements ? "complemento" : "produto"}`} className="h-8 text-sm" />
                        <Textarea value={item.description || ""} onChange={(e) => updateItem(catIdx, itemIdx, "description", e.target.value)} placeholder="Descrição (opcional)" className="min-h-[40px] text-xs resize-none" rows={1} />
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs text-muted-foreground">R$</span>
                        <Input type="number" step="0.01" min="0" value={item.price} onChange={(e) => updateItem(catIdx, itemIdx, "price", parseFloat(e.target.value) || 0)} className="w-20 h-8 text-sm" />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(catIdx, itemIdx)}>
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
                {importSource === "url" ? "Novo Link" : "Nova Foto"}
              </Button>
              <Button onClick={handleConfirmImport} disabled={isSaving || !totalItems}>
                {isSaving ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-1" />Importando...</>
                ) : (
                  <><Check className="h-4 w-4 mr-1" />Importar {totalItems} {isComplements ? "complementos" : "produtos"}</>
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

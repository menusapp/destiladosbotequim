import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, Clock, Package, DollarSign, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProductIngredient {
  id: string;
  stock_item_id: string;
  quantity: number;
  stock_item_name?: string;
  stock_item_unit?: string;
  stock_item_price?: number;
}

interface ProductExtra {
  id: string;
  name: string;
  price: number;
  ingredients?: ProductIngredient[];
  cost?: number;
}

interface Category {
  id: string;
  name: string;
}

interface StockItem {
  id: string;
  name: string;
  unit: string;
  price_per_unit: number;
}

interface ExtraCategory {
  id: string;
  name: string;
  restaurant_id: string;
}

interface ProductFormProps {
  productName: string;
  setProductName: (value: string) => void;
  productDescription: string;
  setProductDescription: (value: string) => void;
  productPrice: string;
  setProductPrice: (value: string) => void;
  productPrepTime: string;
  setProductPrepTime: (value: string) => void;
  productCategoryId: string;
  setProductCategoryId: (value: string) => void;
  productImageUrl: string | null;
  setProductImage: (file: File | null) => void;
  productImage: File | null;
  categories: Category[];
  ingredients: ProductIngredient[];
  stockItems: StockItem[];
  selectedStockItem: string;
  setSelectedStockItem: (value: string) => void;
  ingredientQuantity: string;
  setIngredientQuantity: (value: string) => void;
  handleAddIngredient: () => void;
  handleRemoveIngredient: (id: string) => void;
  extras: ProductExtra[];
  extraName: string;
  setExtraName: (value: string) => void;
  extraPrice: string;
  setExtraPrice: (value: string) => void;
  extraIngredients: ProductIngredient[];
  selectedExtraStockItem: string;
  setSelectedExtraStockItem: (value: string) => void;
  extraIngredientQuantity: string;
  setExtraIngredientQuantity: (value: string) => void;
  editingExtraIndex: number | null;
  handleAddExtra: () => void;
  handleEditExtra: (index: number) => void;
  handleRemoveExtra: (id: string) => void;
  handleAddExtraIngredient: () => void;
  handleRemoveExtraIngredient: (id: string) => void;
  extraCategories: ExtraCategory[];
  handleLoadExtrasFromCategory: (categoryId: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  editingProduct: any;
}

export const ProductForm = ({
  productName,
  setProductName,
  productDescription,
  setProductDescription,
  productPrice,
  setProductPrice,
  productPrepTime,
  setProductPrepTime,
  productCategoryId,
  setProductCategoryId,
  productImageUrl,
  setProductImage,
  productImage,
  categories,
  ingredients,
  stockItems,
  selectedStockItem,
  setSelectedStockItem,
  ingredientQuantity,
  setIngredientQuantity,
  handleAddIngredient,
  handleRemoveIngredient,
  extras,
  extraName,
  setExtraName,
  extraPrice,
  setExtraPrice,
  extraIngredients,
  selectedExtraStockItem,
  setSelectedExtraStockItem,
  extraIngredientQuantity,
  setExtraIngredientQuantity,
  editingExtraIndex,
  handleAddExtra,
  handleEditExtra,
  handleRemoveExtra,
  handleAddExtraIngredient,
  handleRemoveExtraIngredient,
  extraCategories,
  handleLoadExtrasFromCategory,
  onSubmit,
  editingProduct,
}: ProductFormProps) => {
  const calculateProductCost = () => {
    return ingredients.reduce((sum, ing) => {
      return sum + (ing.quantity * (ing.stock_item_price || 0));
    }, 0);
  };

  const calculateExtraCost = (extraIngredients: ProductIngredient[]) => {
    return extraIngredients.reduce((sum, ing) => {
      return sum + (ing.quantity * (ing.stock_item_price || 0));
    }, 0);
  };

  const productCost = calculateProductCost();
  const price = parseFloat(productPrice) || 0;
  const margin = price > 0 ? ((price - productCost) / price) * 100 : 0;
  const cmv = price > 0 ? (productCost / price) * 100 : 0;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Seção 1: Informações Básicas */}
      <Card className="border-2 border-primary/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Info className="w-5 h-5 text-primary" />
            Informações Básicas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-base font-semibold">
              Nome do Produto *
            </Label>
            <Input
              id="name"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              required
              className="h-12 text-base border-2 focus:border-primary"
              placeholder="Ex: X-Burger Especial"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-base font-semibold">
              Descrição
            </Label>
            <Textarea
              id="description"
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              className="min-h-[100px] text-base border-2 focus:border-primary resize-none"
              placeholder="Descreva seu produto..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image" className="text-base font-semibold">
              Imagem do Produto
            </Label>
            {productImageUrl && !productImage && (
              <div className="mb-3">
                <img
                  src={productImageUrl}
                  alt="Preview"
                  className="w-32 h-32 object-cover rounded-lg border-2 border-border shadow-md"
                />
              </div>
            )}
            <Input
              id="image"
              type="file"
              accept="image/*"
              onChange={(e) => setProductImage(e.target.files?.[0] || null)}
              className="h-12 text-base border-2 focus:border-primary cursor-pointer"
            />
          </div>
        </CardContent>
      </Card>

      {/* Seção 2: Preço e Tempo */}
      <Card className="border-2 border-accent/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-accent/10 via-accent/5 to-transparent pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <DollarSign className="w-5 h-5 text-accent" />
            Precificação e Tempo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="price" className="text-base font-semibold">
                Preço de Venda (R$) *
              </Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={productPrice}
                onChange={(e) => setProductPrice(e.target.value)}
                required
                className="h-12 text-base border-2 focus:border-accent"
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prepTime" className="text-base font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-accent" />
                Tempo de Preparo (min)
              </Label>
              <Input
                id="prepTime"
                type="number"
                min="0"
                value={productPrepTime}
                onChange={(e) => setProductPrepTime(e.target.value)}
                className="h-12 text-base border-2 focus:border-accent"
                placeholder="30"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Tempo estimado em minutos para preparar este produto
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category" className="text-base font-semibold">
              Categoria *
            </Label>
            <Select
              value={productCategoryId}
              onValueChange={setProductCategoryId}
              required
            >
              <SelectTrigger className="h-12 text-base border-2 focus:border-accent">
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id} className="text-base">
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Análise de Custo */}
          {ingredients.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 border-2 border-border">
              <h4 className="font-semibold text-base mb-3">Análise de Custo</h4>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="bg-card p-3 rounded-md border">
                  <p className="text-muted-foreground text-xs mb-1">Custo Total</p>
                  <p className="font-bold text-base">
                    R$ {productCost.toFixed(2)}
                  </p>
                </div>
                <div className="bg-card p-3 rounded-md border">
                  <p className="text-muted-foreground text-xs mb-1">Margem</p>
                  <p className="font-bold text-base text-green-600">
                    {margin.toFixed(1)}%
                  </p>
                </div>
                <div className="bg-card p-3 rounded-md border">
                  <p className="text-muted-foreground text-xs mb-1">CMV</p>
                  <p className="font-bold text-base text-orange-600">
                    {cmv.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seção 3: Receita (Insumos) */}
      <Card className="border-2 border-secondary/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-secondary/10 via-secondary/5 to-transparent pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Package className="w-5 h-5 text-secondary" />
            Receita (Insumos)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="md:col-span-3 space-y-2">
                <Label className="text-sm font-semibold">Insumo</Label>
                <Select
                  value={selectedStockItem}
                  onValueChange={setSelectedStockItem}
                >
                  <SelectTrigger className="h-11 border-2">
                    <SelectValue placeholder="Selecione um insumo" />
                  </SelectTrigger>
                  <SelectContent>
                    {stockItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.unit}) - R$ {item.price_per_unit.toFixed(2)}/{item.unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Quantidade</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={ingredientQuantity}
                  onChange={(e) => setIngredientQuantity(e.target.value)}
                  className="h-11 border-2"
                  placeholder="0.00"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  onClick={handleAddIngredient}
                  className="h-11 w-full"
                  variant="secondary"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar
                </Button>
              </div>
            </div>

            {ingredients.length > 0 && (
              <div className="space-y-2 mt-4">
                <h4 className="font-semibold text-sm">Insumos Adicionados:</h4>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                  {ingredients.map((ing) => (
                    <div
                      key={ing.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-md border-2 border-border hover:border-secondary/50 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {ing.stock_item_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ing.quantity} {ing.stock_item_unit} × R$ {ing.stock_item_price?.toFixed(2)} = 
                          <span className="font-semibold text-foreground ml-1">
                            R$ {(ing.quantity * (ing.stock_item_price || 0)).toFixed(2)}
                          </span>
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveIngredient(ing.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Seção 4: Adicionais */}
      <Card className="border-2 border-primary/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pb-4">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Plus className="w-5 h-5 text-primary" />
            Adicionais (Opcionais)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          {/* Importar de Categoria */}
          {extraCategories.length > 0 && (
            <div className="space-y-2 pb-4 border-b-2 border-border">
              <Label className="text-sm font-semibold">
                Importar Adicionais de Categoria
              </Label>
              <Select onValueChange={handleLoadExtrasFromCategory}>
                <SelectTrigger className="h-11 border-2">
                  <SelectValue placeholder="Selecione uma categoria de adicionais" />
                </SelectTrigger>
                <SelectContent>
                  {extraCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Formulário de Adicional */}
          <div className="space-y-4 bg-muted/30 p-4 rounded-lg border-2 border-dashed border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Nome do Adicional</Label>
                <Input
                  value={extraName}
                  onChange={(e) => setExtraName(e.target.value)}
                  placeholder="Ex: Bacon Extra"
                  className="h-11 border-2"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Preço (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={extraPrice}
                  onChange={(e) => setExtraPrice(e.target.value)}
                  placeholder="0.00"
                  className="h-11 border-2"
                />
              </div>
            </div>

            {/* Insumos do Adicional */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Insumos do Adicional</Label>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="md:col-span-3 space-y-2">
                  <Select
                    value={selectedExtraStockItem}
                    onValueChange={setSelectedExtraStockItem}
                  >
                    <SelectTrigger className="h-10 border-2">
                      <SelectValue placeholder="Insumo" />
                    </SelectTrigger>
                    <SelectContent>
                      {stockItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} - R$ {item.price_per_unit.toFixed(2)}/{item.unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={extraIngredientQuantity}
                    onChange={(e) => setExtraIngredientQuantity(e.target.value)}
                    placeholder="Qtd"
                    className="h-10 border-2"
                  />
                </div>
                <div>
                  <Button
                    type="button"
                    onClick={handleAddExtraIngredient}
                    variant="outline"
                    className="h-10 w-full"
                    size="sm"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {extraIngredients.length > 0 && (
                <div className="space-y-2">
                  {extraIngredients.map((ing) => (
                    <div
                      key={ing.id}
                      className="flex items-center justify-between p-2 bg-card rounded border"
                    >
                      <span className="text-sm">
                        {ing.stock_item_name} - {ing.quantity} {ing.stock_item_unit}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveExtraIngredient(ing.id)}
                        className="h-7 w-7 p-0"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button
              type="button"
              onClick={handleAddExtra}
              variant="default"
              className="w-full h-11"
            >
              {editingExtraIndex !== null ? "Atualizar Adicional" : "Adicionar ao Produto"}
            </Button>
          </div>

          {/* Lista de Adicionais */}
          {extras.length > 0 && (
            <div className="space-y-3 mt-4">
              <h4 className="font-semibold text-sm">Adicionais do Produto:</h4>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {extras.map((extra, index) => {
                  const extraCost = calculateExtraCost(extra.ingredients || []);
                  const extraMargin = extra.price > 0 ? ((extra.price - extraCost) / extra.price) * 100 : 0;
                  
                  return (
                    <div
                      key={extra.id}
                      className="p-4 bg-muted/50 rounded-lg border-2 border-border hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-base">{extra.name}</p>
                          <p className="text-sm text-muted-foreground">
                            R$ {extra.price.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditExtra(index)}
                          >
                            Editar
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveExtra(extra.id)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {extra.ingredients && extra.ingredients.length > 0 && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground">Insumos:</p>
                          <div className="space-y-1">
                            {extra.ingredients.map((ing) => (
                              <p key={ing.id} className="text-xs text-muted-foreground pl-2">
                                • {ing.stock_item_name} - {ing.quantity} {ing.stock_item_unit}
                              </p>
                            ))}
                          </div>
                          <div className="flex gap-4 mt-2 pt-2 border-t">
                            <p className="text-xs">
                              <span className="text-muted-foreground">Custo:</span>{" "}
                              <span className="font-semibold">R$ {extraCost.toFixed(2)}</span>
                            </p>
                            <p className="text-xs">
                              <span className="text-muted-foreground">Margem:</span>{" "}
                              <span className="font-semibold text-green-600">
                                {extraMargin.toFixed(1)}%
                              </span>
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Botão de Salvar */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t-2 border-border p-4 -mx-6 -mb-6">
        <Button
          type="submit"
          className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
        >
          {editingProduct ? "Atualizar Produto" : "Criar Produto"}
        </Button>
      </div>
    </form>
  );
};

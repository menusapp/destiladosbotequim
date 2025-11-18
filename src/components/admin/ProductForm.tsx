import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";

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

  const productCost = calculateProductCost();
  const parsedProductPrice = parseFloat(productPrice) || 0;
  const cmvPercentage = parsedProductPrice > 0 ? (productCost / parsedProductPrice) * 100 : 0;

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* INFORMAÇÕES BÁSICAS */}
      <div className="bg-gradient-to-br from-background to-muted/20 rounded-xl border border-border/50 overflow-hidden">
        <div className="bg-primary/5 px-6 py-4 border-b border-border/50">
          <h3 className="text-base font-semibold text-foreground">Informações Básicas</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Dados principais do produto</p>
        </div>
        
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="lg:col-span-2 space-y-2">
              <Label htmlFor="product-name" className="text-sm font-medium">
                Nome do Produto <span className="text-destructive">*</span>
              </Label>
              <Input
                id="product-name"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Ex: Pizza Margherita"
                required
                className="h-11"
              />
            </div>

            <div className="lg:col-span-2 space-y-2">
              <Label htmlFor="product-description" className="text-sm font-medium">
                Descrição
              </Label>
              <Textarea
                id="product-description"
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="Descreva o produto..."
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-category" className="text-sm font-medium">
                Categoria <span className="text-destructive">*</span>
              </Label>
              <Select value={productCategoryId} onValueChange={setProductCategoryId}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product-prep-time" className="text-sm font-medium">
                Tempo de Preparo (min)
              </Label>
              <Input
                id="product-prep-time"
                type="number"
                min="1"
                value={productPrepTime}
                onChange={(e) => setProductPrepTime(e.target.value)}
                placeholder="30"
                className="h-11"
              />
            </div>

            <div className="lg:col-span-2 space-y-2">
              <Label htmlFor="product-image" className="text-sm font-medium">
                Imagem do Produto
              </Label>
              {productImageUrl && !productImage && (
                <img 
                  src={productImageUrl} 
                  alt="Preview" 
                  className="w-32 h-32 object-cover rounded-lg border border-border mb-2" 
                />
              )}
              <Input
                id="product-image"
                type="file"
                accept="image/*"
                onChange={(e) => setProductImage(e.target.files?.[0] || null)}
                className="cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* PREÇO E ANÁLISE */}
      <div className="bg-gradient-to-br from-background to-muted/20 rounded-xl border border-border/50 overflow-hidden">
        <div className="bg-primary/5 px-6 py-4 border-b border-border/50">
          <h3 className="text-base font-semibold text-foreground">Preço e Análise</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Precificação e indicadores financeiros</p>
        </div>
        
        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="product-price" className="text-sm font-medium">
              Preço de Venda (R$) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="product-price"
              type="number"
              step="0.01"
              value={productPrice}
              onChange={(e) => setProductPrice(e.target.value)}
              placeholder="0.00"
              required
              className="h-11 text-lg font-semibold"
            />
          </div>

          {productCost > 0 && parsedProductPrice > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-muted/50 rounded-lg p-4 text-center border border-border/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Custo</p>
                <p className="text-lg font-bold text-foreground">R$ {productCost.toFixed(2)}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center border border-border/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Margem</p>
                <p className="text-lg font-bold text-green-600">
                  {((parsedProductPrice - productCost) / parsedProductPrice * 100).toFixed(1)}%
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center border border-border/50">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">CMV</p>
                <p className={`text-lg font-bold ${
                  cmvPercentage > 35 ? 'text-red-600' : 
                  cmvPercentage > 30 ? 'text-yellow-600' : 
                  'text-green-600'
                }`}>
                  {cmvPercentage.toFixed(1)}%
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RECEITA (INSUMOS) */}
      <div className="bg-gradient-to-br from-background to-muted/20 rounded-xl border border-border/50 overflow-hidden">
        <div className="bg-primary/5 px-6 py-4 border-b border-border/50 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Receita (Insumos) <span className="text-destructive">*</span>
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">Configure os insumos do produto</p>
          </div>
          {productCost > 0 && (
            <div className="bg-primary/10 px-3 py-1.5 rounded-full">
              <span className="text-sm font-semibold">R$ {productCost.toFixed(2)}</span>
            </div>
          )}
        </div>
        
        <div className="p-6 space-y-4">
          {/* Adicionar Insumo */}
          <div className="bg-muted/30 rounded-lg p-4 border border-dashed border-border">
            <div className="flex gap-2 flex-col sm:flex-row">
              <div className="flex-1 min-w-[200px]">
                <Select value={selectedStockItem} onValueChange={setSelectedStockItem}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Selecione um insumo" />
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
              <Input
                type="number"
                step="0.01"
                placeholder="Quantidade"
                value={ingredientQuantity}
                onChange={(e) => setIngredientQuantity(e.target.value)}
                className="w-full sm:w-32 h-10"
              />
              <Button type="button" onClick={handleAddIngredient} size="default" className="h-10">
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
          </div>

          {/* Lista de Insumos */}
          {ingredients.length > 0 ? (
            <div className="space-y-2">
              {ingredients.map((ing) => (
                <div 
                  key={ing.id} 
                  className="flex items-center justify-between p-3 bg-background rounded-lg border border-border hover:border-primary/50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{ing.stock_item_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
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
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed">
              <p className="text-sm text-muted-foreground">
                Nenhum insumo adicionado. Adicione pelo menos 1 insumo.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ADICIONAIS */}
      <div className="bg-gradient-to-br from-background to-muted/20 rounded-xl border border-border/50 overflow-hidden">
        <div className="bg-primary/5 px-6 py-4 border-b border-border/50">
          <h3 className="text-base font-semibold text-foreground">Adicionais</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Configure opções extras para o produto (opcional)</p>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Carregar de Categoria */}
          {extraCategories.length > 0 && (
            <div className="bg-muted/30 rounded-lg p-4 border border-border">
              <Label className="text-xs font-medium mb-2 block">Importar de categoria:</Label>
              <Select onValueChange={handleLoadExtrasFromCategory}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Selecione uma categoria" />
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
          <div className="bg-muted/30 rounded-lg p-4 border border-dashed border-border space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                placeholder="Nome do adicional"
                value={extraName}
                onChange={(e) => setExtraName(e.target.value)}
                className="h-10"
              />
              <Input
                type="number"
                step="0.01"
                placeholder="Preço (R$)"
                value={extraPrice}
                onChange={(e) => setExtraPrice(e.target.value)}
                className="h-10"
              />
            </div>

            {/* Insumos do Adicional */}
            <div className="space-y-2 pt-2 border-t border-border/50">
              <Label className="text-xs font-medium">Insumos do adicional (opcional):</Label>
              <div className="flex gap-2 flex-col sm:flex-row">
                <div className="flex-1 min-w-[150px]">
                  <Select value={selectedExtraStockItem} onValueChange={setSelectedExtraStockItem}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Selecione insumo" />
                    </SelectTrigger>
                    <SelectContent>
                      {stockItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Qtd"
                  value={extraIngredientQuantity}
                  onChange={(e) => setExtraIngredientQuantity(e.target.value)}
                  className="w-full sm:w-24 h-10"
                />
                <Button type="button" onClick={handleAddExtraIngredient} size="default" variant="outline" className="h-10">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {extraIngredients.length > 0 && (
                <div className="space-y-1 mt-2">
                  {extraIngredients.map((ing) => (
                    <div key={ing.id} className="flex items-center justify-between text-xs p-2 bg-background rounded border border-border">
                      <span className="text-muted-foreground">{ing.stock_item_name}: {ing.quantity} {ing.stock_item_unit}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveExtraIngredient(ing.id)}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button type="button" onClick={handleAddExtra} className="w-full h-10">
              {editingExtraIndex !== null ? 'Atualizar Adicional' : 'Adicionar Adicional'}
            </Button>
          </div>

          {/* Lista de Adicionais */}
          {extras.length > 0 && (
            <div className="space-y-2">
              {extras.map((extra) => (
                <div 
                  key={extra.id} 
                  className="flex items-center justify-between p-3 bg-background rounded-lg border border-border hover:border-primary/50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium text-sm">{extra.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      R$ {extra.price.toFixed(2)}
                      {extra.cost && extra.cost > 0 && (
                        <span className="ml-2">• Custo: R$ {extra.cost.toFixed(2)}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const index = extras.indexOf(extra);
                        handleEditExtra(index);
                      }}
                      className="h-8"
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveExtra(extra.id)}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* BOTÃO DE SALVAR */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border pt-4 pb-2">
        <Button type="submit" className="w-full h-12 text-base font-semibold">
          {editingProduct ? "Atualizar Produto" : "Criar Produto"}
        </Button>
      </div>
    </form>
  );
};

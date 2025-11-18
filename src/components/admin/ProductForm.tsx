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
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Bloco 1: Dados Básicos */}
      <Card className="p-5 bg-card/50 border-primary/20 shadow-sm">
        <h3 className="text-lg font-semibold mb-4 text-primary flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm">1</span>
          Dados Básicos
        </h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product-name" className="text-base">Nome do Produto *</Label>
            <Input
              id="product-name"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Ex: Pizza Margherita"
              required
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-description" className="text-base">Descrição</Label>
            <Textarea
              id="product-description"
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              placeholder="Descreva o produto de forma atrativa para o cliente..."
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-image" className="text-base">Foto do Produto</Label>
            {productImageUrl && !productImage && (
              <div className="mb-2">
                <img 
                  src={productImageUrl} 
                  alt="Preview" 
                  className="w-40 h-40 object-cover rounded-lg border-2 border-primary/20 shadow-sm" 
                />
              </div>
            )}
            <Input
              id="product-image"
              type="file"
              accept="image/*"
              onChange={(e) => setProductImage(e.target.files?.[0] || null)}
              className="cursor-pointer"
            />
            <p className="text-xs text-muted-foreground">Recomendado: imagem quadrada, mínimo 500x500px</p>
          </div>
        </div>
      </Card>

      {/* Bloco 2: Preço, Custo, Margem e CMV */}
      <Card className="p-5 bg-card/50 border-primary/20 shadow-sm">
        <h3 className="text-lg font-semibold mb-4 text-primary flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm">2</span>
          Preço e Análise Financeira
        </h3>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product-price" className="text-base">Preço de Venda (R$) *</Label>
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
            <div className="space-y-2">
              <Label htmlFor="product-prep-time" className="text-base">Tempo de Preparo (min)</Label>
              <Input
                id="product-prep-time"
                type="number"
                min="1"
                value={productPrepTime}
                onChange={(e) => setProductPrepTime(e.target.value)}
                placeholder="30"
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">Tempo estimado de preparo</p>
            </div>
          </div>

          {/* Indicadores de Custo e Margem */}
          {productCost > 0 && parsedProductPrice > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border border-primary/20">
              <div className="text-center p-3 bg-background/50 rounded-md">
                <p className="text-xs text-muted-foreground mb-1">Custo Total</p>
                <p className="text-xl font-bold text-foreground">R$ {productCost.toFixed(2)}</p>
              </div>
              <div className="text-center p-3 bg-background/50 rounded-md">
                <p className="text-xs text-muted-foreground mb-1">Margem de Lucro</p>
                <p className="text-xl font-bold text-green-600">
                  {((parsedProductPrice - productCost) / parsedProductPrice * 100).toFixed(1)}%
                </p>
              </div>
              <div className="text-center p-3 bg-background/50 rounded-md">
                <p className="text-xs text-muted-foreground mb-1">CMV</p>
                <p className={`text-xl font-bold ${cmvPercentage > 35 ? 'text-red-600' : cmvPercentage > 30 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {cmvPercentage.toFixed(1)}%
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Bloco 3: Categoria */}
      <Card className="p-5 bg-card/50 border-primary/20 shadow-sm">
        <h3 className="text-lg font-semibold mb-4 text-primary flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm">3</span>
          Categoria
        </h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product-category" className="text-base">Categoria *</Label>
            <Select value={productCategoryId} onValueChange={setProductCategoryId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              A categoria define onde o produto aparece no cardápio digital
            </p>
          </div>
        </div>
      </Card>

      {/* Bloco 4: Insumos */}
      <Card className="p-5 bg-card/50 border-primary/20 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm">4</span>
            Insumos * (Obrigatório)
          </h3>
          {productCost > 0 && (
            <div className="text-sm bg-primary/10 px-3 py-1.5 rounded-full font-semibold">
              Custo: R$ {productCost.toFixed(2)}
            </div>
          )}
        </div>
        
        <p className="text-sm text-muted-foreground mb-4">
          Configure os insumos utilizados neste produto para cálculo automático de custo e controle de estoque
        </p>

        <div className="space-y-3">
          {/* Adicionar Insumo */}
          <div className="p-4 bg-muted/30 rounded-lg border border-border">
            <div className="flex gap-2 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Select value={selectedStockItem} onValueChange={setSelectedStockItem}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um insumo" />
                  </SelectTrigger>
                  <SelectContent>
                    {stockItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-32">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Qtd"
                  value={ingredientQuantity}
                  onChange={(e) => setIngredientQuantity(e.target.value)}
                />
              </div>
              <Button type="button" onClick={handleAddIngredient} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Lista de Insumos */}
          {ingredients.length > 0 && (
            <div className="space-y-2">
              {ingredients.map((ing) => (
                <div 
                  key={ing.id} 
                  className="flex items-center justify-between p-3 bg-background rounded-md border border-border hover:border-primary/50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium">{ing.stock_item_name}</p>
                    <p className="text-sm text-muted-foreground">
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
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {ingredients.length === 0 && (
            <div className="text-center p-6 bg-muted/20 rounded-lg border-2 border-dashed">
              <p className="text-sm text-muted-foreground">
                Nenhum insumo adicionado. Adicione pelo menos 1 insumo para continuar.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Bloco 5: Adicionais */}
      <Card className="p-5 bg-card/50 border-primary/20 shadow-sm">
        <h3 className="text-lg font-semibold mb-4 text-primary flex items-center gap-2">
          <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm">5</span>
          Adicionais (Opcional)
        </h3>

        <p className="text-sm text-muted-foreground mb-4">
          Configure adicionais que o cliente pode escolher ao pedir este produto
        </p>

        {/* Carregar de Categoria */}
        {extraCategories.length > 0 && (
          <div className="mb-4 p-4 bg-muted/30 rounded-lg border border-border">
            <Label className="text-sm mb-2 block">Carregar adicionais de uma categoria existente:</Label>
            <Select onValueChange={handleLoadExtrasFromCategory}>
              <SelectTrigger>
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
        <div className="p-4 bg-muted/30 rounded-lg border border-border mb-4">
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Nome do adicional (ex: Bacon extra)"
                  value={extraName}
                  onChange={(e) => setExtraName(e.target.value)}
                />
              </div>
              <div className="w-32">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Preço"
                  value={extraPrice}
                  onChange={(e) => setExtraPrice(e.target.value)}
                />
              </div>
            </div>

            {/* Insumos do Adicional */}
            <div className="space-y-2">
              <Label className="text-xs">Insumos do adicional (opcional):</Label>
              <div className="flex gap-2 flex-wrap">
                <div className="flex-1 min-w-[150px]">
                  <Select value={selectedExtraStockItem} onValueChange={setSelectedExtraStockItem}>
                    <SelectTrigger>
                      <SelectValue placeholder="Insumo" />
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
                <div className="w-24">
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Qtd"
                    value={extraIngredientQuantity}
                    onChange={(e) => setExtraIngredientQuantity(e.target.value)}
                  />
                </div>
                <Button type="button" onClick={handleAddExtraIngredient} size="sm" variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {extraIngredients.length > 0 && (
                <div className="space-y-1 mt-2">
                  {extraIngredients.map((ing) => (
                    <div key={ing.id} className="flex items-center justify-between text-xs p-2 bg-background rounded">
                      <span>{ing.stock_item_name}: {ing.quantity} {ing.stock_item_unit}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveExtraIngredient(ing.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button type="button" onClick={handleAddExtra} variant="default" className="w-full">
              {editingExtraIndex !== null ? 'Atualizar Adicional' : 'Adicionar Adicional'}
            </Button>
          </div>
        </div>

        {extras.length > 0 && (
          <div className="space-y-2">
            {extras.map((extra) => (
              <div 
                key={extra.id} 
                className="flex items-center justify-between p-3 bg-background rounded-md border border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex-1">
                  <p className="font-medium">{extra.name}</p>
                  <p className="text-sm text-muted-foreground">
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
                  >
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveExtra(extra.id)}
                  >
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Botão de Salvar */}
      <div className="flex gap-3 pt-4">
        <Button type="submit" className="flex-1 h-11 text-base font-semibold">
          {editingProduct ? "Atualizar Produto" : "Criar Produto"}
        </Button>
      </div>
    </form>
  );
};

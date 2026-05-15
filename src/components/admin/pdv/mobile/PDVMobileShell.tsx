/**
 * PDVMobileShell — Experiência handheld mobile-first do PDV.
 *
 * Recebe TODO o estado/handlers do PDVTab via props (não duplica regras de negócio).
 * Apenas reorganiza a UI para uso operacional rápido com uma mão.
 *
 * Fluxo:
 *   1) Tipo (Mesa / Delivery / Retirada)
 *   2) (se Mesa) Grid visual de mesas
 *   3) Catálogo: categorias horizontais sticky + grid compacto 2 colunas
 *   4) Cart bar fixa inferior → bottom sheet com checkout colapsável
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, ChevronLeft, ShoppingBag, Plus, Minus, ChevronDown, Trash2, Loader2, Zap, Users, Bike, ShoppingBasket } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { normalizeSearch } from "@/lib/searchNormalize";
import { cn } from "@/lib/utils";

// ---------- Tipos públicos (sub-conjunto do PDVTab; sem regras de negócio) ----------
export interface PDVMobileCartItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  notes?: string;
  extras: { extraId: string; name: string; price: number; is_complement?: boolean }[];
}

export interface PDVMobileTable {
  id: string;
  table_number: number;
  table_name: string | null;
  is_occupied: boolean;
  is_hidden: boolean;
  comandas?: { id: string }[];
}

export interface PDVMobileShellProps {
  // catálogo
  products: any[];
  // pedido
  orderType: "mesa" | "delivery" | "retirada";
  setOrderType: (t: "mesa" | "delivery" | "retirada") => void;
  cart: PDVMobileCartItem[];
  setCart: React.Dispatch<React.SetStateAction<PDVMobileCartItem[]>>;
  onOpenProduct: (product: any) => Promise<void> | void;
  // mesas
  tables?: PDVMobileTable[];
  selectedTableId: string;
  setSelectedTableId: (id: string) => void;
  pendingByTable: Map<string, number>;
  reservationByTable: Map<string, { reservation_time: string | null }>;
  // cliente / endereço / pagamento
  customerName: string;
  setCustomerName: (v: string) => void;
  customerPhone: string;
  setCustomerPhone: (v: string) => void;
  customerCpf: string;
  onCpfChange: (v: string) => void;
  cpfSearching: boolean;
  notes: string;
  setNotes: (v: string) => void;
  paymentType: string;
  setPaymentType: (v: string) => void;
  deliveryAddress: string;
  setDeliveryAddress: (v: string) => void;
  deliveryNeighborhood: string;
  setDeliveryNeighborhood: (v: string) => void;
  deliveryCep: string;
  setDeliveryCep: (v: string) => void;
  deliveryCity: string;
  setDeliveryCity: (v: string) => void;
  // totais
  cartSubtotal: number;
  cartTotal: number;
  resolvedDeliveryFee: number;
  // ações
  onSubmit: () => Promise<void> | void;
  submitting: boolean;
  onClearForm: () => void;
}

const CHIP = "h-9 px-3.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all active:scale-95";

export const PDVMobileShell = (props: PDVMobileShellProps) => {
  const { products, orderType, setOrderType, cart, setCart, onOpenProduct,
          tables, selectedTableId, setSelectedTableId, pendingByTable, reservationByTable,
          customerName, setCustomerName, customerPhone, setCustomerPhone, customerCpf, onCpfChange, cpfSearching,
          notes, setNotes, paymentType, setPaymentType,
          deliveryAddress, setDeliveryAddress, deliveryNeighborhood, setDeliveryNeighborhood,
          deliveryCep, setDeliveryCep, deliveryCity, setDeliveryCity,
          cartSubtotal, cartTotal, resolvedDeliveryFee, onSubmit, submitting, onClearForm } = props;

  type Step = "type" | "table" | "catalog";
  const [step, setStep] = useState<Step>("type");
  const [activeCategoryId, setActiveCategoryId] = useState<string>("__all__");
  const [search, setSearch] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // se mesa já estiver selecionada (vinda do TableDetailDialog), pular direto pro catálogo
  useEffect(() => {
    if (orderType === "mesa" && selectedTableId) setStep("catalog");
  }, [orderType, selectedTableId]);

  // Categorias derivadas dos produtos
  const categories = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    (products || []).forEach((p: any) => {
      const c = p.categories;
      if (c?.id && !map.has(c.id)) map.set(c.id, { id: c.id, name: c.name });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [products]);

  // Top vendidos: heurística simples por order_count se existir, senão primeiros do catálogo
  const topProducts = useMemo(() => {
    const sorted = [...(products || [])].sort((a, b) => (b.order_count ?? 0) - (a.order_count ?? 0));
    return sorted.slice(0, 6);
  }, [products]);

  // Filtragem por categoria + busca (acentos-insensitive + abreviação por palavra)
  const filteredProducts = useMemo(() => {
    let list = products || [];
    if (activeCategoryId !== "__all__" && activeCategoryId !== "__top__") {
      list = list.filter((p: any) => p.categories?.id === activeCategoryId);
    }
    if (activeCategoryId === "__top__") list = topProducts;
    const q = normalizeSearch(search).trim();
    if (!q) return list;
    const tokens = q.split(/\s+/).filter(Boolean);
    return list.filter((p: any) => {
      const hay = normalizeSearch(p.name + " " + (p.description || ""));
      return tokens.every((t) => hay.includes(t));
    });
  }, [products, activeCategoryId, search, topProducts]);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  // ----- Etapa 1: tipo -----
  if (step === "type") {
    return (
      <div className="fixed inset-0 top-14 bg-background z-30 flex flex-col">
        <div className="px-5 pt-6 pb-4">
          <h2 className="text-2xl font-bold text-foreground">Novo pedido</h2>
          <p className="text-sm text-muted-foreground mt-1">Escolha o tipo para começar</p>
        </div>
        <div className="flex-1 px-5 space-y-3">
          <TypeCard
            icon={<Users className="w-7 h-7" />}
            title="Mesa"
            subtitle="Atender no salão"
            onClick={() => { setOrderType("mesa"); setStep("table"); }}
          />
          <TypeCard
            icon={<Bike className="w-7 h-7" />}
            title="Delivery"
            subtitle="Entrega no endereço"
            onClick={() => { setOrderType("delivery"); setStep("catalog"); }}
          />
          <TypeCard
            icon={<ShoppingBasket className="w-7 h-7" />}
            title="Retirada"
            subtitle="Cliente vem buscar"
            onClick={() => { setOrderType("retirada"); setStep("catalog"); }}
          />
        </div>
      </div>
    );
  }

  // ----- Etapa 2: grid de mesas -----
  if (step === "table") {
    return (
      <div className="fixed inset-0 top-14 bg-background z-30 flex flex-col">
        <div className="flex items-center gap-2 px-3 py-3 border-b border-border">
          <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setStep("type")}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-lg font-bold flex-1">Selecione a mesa</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-3 gap-2.5">
            {tables?.filter((t) => !t.is_hidden).map((t) => {
              const occupied = t.is_occupied;
              const reserved = !occupied && reservationByTable.has(t.id);
              const hasPending = (pendingByTable.get(t.id) || 0) > 0;
              return (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTableId(t.id); setStep("catalog"); }}
                  className={cn(
                    "relative aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all touch-manipulation",
                    occupied ? "bg-destructive/10 border-destructive/40 text-destructive" :
                    reserved ? "bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-400" :
                    "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                  )}
                >
                  {hasPending && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-destructive animate-pulse" />
                  )}
                  <span className="text-3xl font-bold leading-none">{t.table_number}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide">
                    {occupied ? "Ocupada" : reserved ? "Reservada" : "Livre"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ----- Etapa 3: catálogo -----
  return (
    <div className="fixed inset-0 top-14 bg-background z-30 flex flex-col">
      {/* Header compacto */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-background">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={() => {
            if (orderType === "mesa") setStep("table");
            else setStep("type");
          }}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase font-bold tracking-wider text-muted-foreground leading-none">
            {orderType === "mesa" ? `Mesa ${tables?.find((t) => t.id === selectedTableId)?.table_number ?? ""}` :
             orderType === "delivery" ? "Delivery" : "Retirada"}
          </p>
          <p className="text-sm font-semibold truncate">Adicionar produtos</p>
        </div>
        {cart.length > 0 && (
          <Button variant="ghost" size="sm" className="h-10 px-3 text-xs text-muted-foreground" onClick={onClearForm}>
            Limpar
          </Button>
        )}
      </div>

      {/* Busca */}
      <div className="px-3 pt-2.5 pb-2 bg-background">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            inputMode="search"
            placeholder="Buscar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9 h-11 text-base rounded-xl"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted"
              aria-label="Limpar busca"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Categorias horizontais sticky */}
      <div className="sticky top-0 z-10 px-3 py-2 bg-background border-b border-border overflow-x-auto scrollbar-none">
        <div className="flex gap-2 w-max">
          <button
            onClick={() => setActiveCategoryId("__all__")}
            className={cn(CHIP, activeCategoryId === "__all__" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
          >
            Todos
          </button>
          {topProducts.length > 0 && (
            <button
              onClick={() => setActiveCategoryId("__top__")}
              className={cn(CHIP, "flex items-center gap-1",
                activeCategoryId === "__top__" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
            >
              <Zap className="w-3.5 h-3.5" /> Mais pedidos
            </button>
          )}
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategoryId(c.id)}
              className={cn(CHIP, activeCategoryId === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Grid compacto de produtos */}
      <div className="flex-1 overflow-y-auto px-3 pt-3 pb-40">
        {filteredProducts.length === 0 ? (
          <div className="text-center py-16 text-sm text-muted-foreground">
            Nenhum produto encontrado
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {filteredProducts.map((p: any) => (
              <ProductCard
                key={p.id}
                product={p}
                onTap={() => onOpenProduct(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Cart bar fixa — sempre visível durante a montagem do pedido */}
      <div
        className="fixed left-0 right-0 z-40 px-3 pointer-events-none"
        style={{ bottom: 0, paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))", paddingTop: "0.75rem" }}
      >
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[140%] bg-gradient-to-t from-background via-background/95 to-transparent -z-10" />
        <button
          onClick={() => cart.length > 0 && setCartOpen(true)}
          disabled={cart.length === 0}
          aria-label={cart.length === 0 ? "Adicione produtos para criar o pedido" : "Criar pedido"}
          className={cn(
            "pointer-events-auto w-full rounded-2xl shadow-2xl backdrop-blur-md transition-all duration-200 touch-manipulation",
            "flex items-center justify-between px-4 py-3",
            cart.length === 0
              ? "bg-muted/90 text-muted-foreground cursor-not-allowed"
              : "bg-primary text-primary-foreground active:scale-[0.98]"
          )}
          style={{ minHeight: "60px" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <ShoppingBag className="w-6 h-6" />
              {cartCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-5 min-w-5 px-1 bg-primary-foreground text-primary text-[11px] font-bold flex items-center justify-center pointer-events-none">
                  {cartCount}
                </Badge>
              )}
            </div>
            <div className="flex flex-col items-start leading-tight min-w-0">
              <span className="text-[11px] font-medium opacity-80">
                {cart.length === 0
                  ? "Nenhum item ainda"
                  : `${cartCount} ${cartCount === 1 ? "item" : "itens"}`}
              </span>
              <span className="text-base font-bold">
                {cart.length === 0 ? "Adicione produtos" : `R$ ${cartTotal.toFixed(2)}`}
              </span>
            </div>
          </div>
          <span className={cn(
            "text-sm font-bold px-4 py-2 rounded-xl transition-all whitespace-nowrap",
            cart.length === 0
              ? "bg-muted-foreground/10"
              : "bg-primary-foreground/15"
          )}>
            Criar Pedido
          </span>
        </button>
      </div>

      {/* Bottom sheet do carrinho / checkout */}
      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        setCart={setCart}
        orderType={orderType}
        cartSubtotal={cartSubtotal}
        cartTotal={cartTotal}
        deliveryFee={resolvedDeliveryFee}
        // checkout fields
        customerName={customerName}
        setCustomerName={setCustomerName}
        customerPhone={customerPhone}
        setCustomerPhone={setCustomerPhone}
        customerCpf={customerCpf}
        onCpfChange={onCpfChange}
        cpfSearching={cpfSearching}
        notes={notes}
        setNotes={setNotes}
        paymentType={paymentType}
        setPaymentType={setPaymentType}
        deliveryAddress={deliveryAddress}
        setDeliveryAddress={setDeliveryAddress}
        deliveryNeighborhood={deliveryNeighborhood}
        setDeliveryNeighborhood={setDeliveryNeighborhood}
        deliveryCep={deliveryCep}
        setDeliveryCep={setDeliveryCep}
        deliveryCity={deliveryCity}
        setDeliveryCity={setDeliveryCity}
        submitting={submitting}
        onSubmit={async () => {
          await onSubmit();
          setCartOpen(false);
          setStep("type");
        }}
      />
    </div>
  );
};

// =============== Sub-componentes ===============

const TypeCard = ({ icon, title, subtitle, onClick }: { icon: React.ReactNode; title: string; subtitle: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-4 p-5 rounded-2xl bg-card border border-border active:scale-[0.98] transition-all touch-manipulation hover:border-primary/40"
  >
    <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
      {icon}
    </div>
    <div className="flex-1 text-left">
      <p className="text-lg font-bold text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
    <ChevronLeft className="w-5 h-5 text-muted-foreground rotate-180" />
  </button>
);

const ProductCard = ({ product, onTap }: { product: any; onTap: () => void }) => {
  const price = product.promotional_price ?? product.price;
  return (
    <button
      onClick={onTap}
      className="relative bg-card border border-border rounded-xl overflow-hidden flex flex-col text-left active:scale-[0.97] transition-all touch-manipulation"
    >
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.name}
          loading="lazy"
          className="w-full aspect-[4/3] object-cover"
        />
      ) : (
        <div className="w-full aspect-[4/3] bg-muted flex items-center justify-center text-3xl font-bold text-muted-foreground">
          {product.name.charAt(0)}
        </div>
      )}
      <div className="p-2 pb-2.5 flex-1 flex flex-col gap-1">
        <p className="text-[13px] font-semibold leading-tight line-clamp-2 text-foreground">
          {product.name}
        </p>
        <div className="flex items-end justify-between mt-auto pt-1">
          <span className="text-sm font-bold text-foreground">R$ {Number(price).toFixed(2)}</span>
          <span className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
            <Plus className="w-5 h-5" />
          </span>
        </div>
      </div>
    </button>
  );
};

// ----------- Cart sheet (carrinho + checkout colapsável) -----------

interface CartSheetProps {
  open: boolean;
  onClose: () => void;
  cart: PDVMobileCartItem[];
  setCart: React.Dispatch<React.SetStateAction<PDVMobileCartItem[]>>;
  orderType: "mesa" | "delivery" | "retirada";
  cartSubtotal: number;
  cartTotal: number;
  deliveryFee: number;
  customerName: string; setCustomerName: (v: string) => void;
  customerPhone: string; setCustomerPhone: (v: string) => void;
  customerCpf: string; onCpfChange: (v: string) => void; cpfSearching: boolean;
  notes: string; setNotes: (v: string) => void;
  paymentType: string; setPaymentType: (v: string) => void;
  deliveryAddress: string; setDeliveryAddress: (v: string) => void;
  deliveryNeighborhood: string; setDeliveryNeighborhood: (v: string) => void;
  deliveryCep: string; setDeliveryCep: (v: string) => void;
  deliveryCity: string; setDeliveryCity: (v: string) => void;
  submitting: boolean;
  onSubmit: () => void;
}

const CartSheet = (p: CartSheetProps) => {
  const updateQty = (idx: number, delta: number) => {
    p.setCart((prev) => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it));
  };
  const removeItem = (idx: number) => p.setCart((prev) => prev.filter((_, i) => i !== idx));

  return (
    <Sheet open={p.open} onOpenChange={(o) => !o && p.onClose()}>
      <SheetContent
        side="bottom"
        className="h-[92vh] p-0 rounded-t-2xl flex flex-col gap-0"
      >
        {/* Handle + header */}
        <div className="shrink-0">
          <div className="mx-auto mt-2 mb-2 h-1.5 w-12 rounded-full bg-muted-foreground/20" />
          <div className="px-4 pb-3 flex items-center justify-between border-b border-border">
            <div>
              <h3 className="text-lg font-bold">Pedido atual</h3>
              <p className="text-xs text-muted-foreground">
                {p.cart.length} {p.cart.length === 1 ? "item" : "itens"}
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-10 w-10" onClick={p.onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Scroll body */}
        <div className="flex-1 overflow-y-auto">
          {/* Itens */}
          <div className="px-4 py-3 space-y-2">
            {p.cart.map((item, idx) => {
              const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
              const lineTotal = (item.price + extrasTotal) * item.quantity;
              return (
                <div key={idx} className="bg-card border border-border rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{item.productName}</p>
                      {item.extras.length > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                          {item.extras.map((e) => e.name).join(" • ")}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-[11px] text-muted-foreground italic mt-0.5">
                          📝 {item.notes}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => removeItem(idx)}
                      className="h-9 w-9 -mt-1 -mr-1 rounded-lg flex items-center justify-center text-destructive active:bg-destructive/10"
                      aria-label="Remover item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                      <button
                        onClick={() => updateQty(idx, -1)}
                        className="h-9 w-9 rounded-md flex items-center justify-center text-foreground active:bg-background"
                        aria-label="Diminuir"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="min-w-[26px] text-center text-sm font-bold">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(idx, 1)}
                        className="h-9 w-9 rounded-md flex items-center justify-center text-primary active:bg-background"
                        aria-label="Aumentar"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="text-sm font-bold">R$ {lineTotal.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Cliente (recolhível) */}
          <CollapsibleSection title="Cliente" defaultOpen={p.orderType !== "mesa"}>
            <div className="space-y-2.5">
              <div>
                <Label className="text-xs">Nome *</Label>
                <Input
                  value={p.customerName}
                  onChange={(e) => p.setCustomerName(e.target.value)}
                  placeholder="Nome do cliente"
                  className="h-11 text-base"
                />
              </div>
              {(p.orderType === "delivery" || p.orderType === "retirada") && (
                <div>
                  <Label className="text-xs">Telefone {p.orderType === "delivery" && "*"}</Label>
                  <Input
                    inputMode="tel"
                    value={p.customerPhone}
                    onChange={(e) => p.setCustomerPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="h-11 text-base"
                  />
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Endereço (delivery) */}
          {p.orderType === "delivery" && (
            <CollapsibleSection title="Endereço de entrega" defaultOpen>
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">CEP</Label>
                    <Input
                      inputMode="numeric"
                      value={p.deliveryCep}
                      onChange={(e) => p.setDeliveryCep(e.target.value)}
                      placeholder="00000-000"
                      className="h-11 text-base"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Bairro</Label>
                    <Input
                      value={p.deliveryNeighborhood}
                      onChange={(e) => p.setDeliveryNeighborhood(e.target.value)}
                      className="h-11 text-base"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Endereço *</Label>
                  <Input
                    value={p.deliveryAddress}
                    onChange={(e) => p.setDeliveryAddress(e.target.value)}
                    placeholder="Rua, número, complemento"
                    className="h-11 text-base"
                  />
                </div>
                <div>
                  <Label className="text-xs">Cidade</Label>
                  <Input
                    value={p.deliveryCity}
                    onChange={(e) => p.setDeliveryCity(e.target.value)}
                    placeholder="Cidade - UF"
                    className="h-11 text-base"
                  />
                </div>
              </div>
            </CollapsibleSection>
          )}

          {/* Pagamento */}
          <CollapsibleSection title="Pagamento" defaultOpen={false}>
            <Select value={p.paymentType} onValueChange={p.setPaymentType}>
              <SelectTrigger className="h-11 text-base">
                <SelectValue placeholder="Método de pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Dinheiro</SelectItem>
                <SelectItem value="debit">Débito</SelectItem>
                <SelectItem value="credit">Crédito</SelectItem>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="meal_voucher">Vale Refeição</SelectItem>
                <SelectItem value="employee_credit">Crédito de Funcionário</SelectItem>
              </SelectContent>
            </Select>
          </CollapsibleSection>

          {/* Dados fiscais */}
          <CollapsibleSection title="Dados fiscais (CPF na nota)" defaultOpen={false}>
            <div>
              <Label className="text-xs">CPF</Label>
              <div className="relative">
                <Input
                  inputMode="numeric"
                  value={p.customerCpf}
                  onChange={(e) => p.onCpfChange(e.target.value)}
                  placeholder="000.000.000-00"
                  className="h-11 text-base pr-10"
                />
                {p.cpfSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>
          </CollapsibleSection>

          {/* Observações */}
          <CollapsibleSection title="Observações" defaultOpen={false}>
            <Textarea
              value={p.notes}
              onChange={(e) => p.setNotes(e.target.value)}
              placeholder="Observações do pedido..."
              className="min-h-[70px] text-base"
            />
          </CollapsibleSection>

          <div className="h-4" />
        </div>

        {/* Footer fixo: total + confirmar */}
        <div
          className="shrink-0 border-t border-border bg-background px-4 pt-3"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="space-y-1 mb-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>R$ {p.cartSubtotal.toFixed(2)}</span>
            </div>
            {p.orderType === "delivery" && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Taxa de entrega</span>
                <span>{p.deliveryFee > 0 ? `R$ ${p.deliveryFee.toFixed(2)}` : "Grátis"}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold pt-1 border-t border-border">
              <span>Total</span>
              <span className="text-primary">R$ {p.cartTotal.toFixed(2)}</span>
            </div>
          </div>
          <Button
            className="w-full h-13 text-base font-bold"
            style={{ height: "52px" }}
            onClick={p.onSubmit}
            disabled={p.submitting || p.cart.length === 0 || !p.customerName.trim()}
          >
            {p.submitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            {p.submitting ? "Enviando..." : "Confirmar pedido"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const CollapsibleSection = ({
  title, defaultOpen = false, children,
}: { title: string; defaultOpen?: boolean; children: React.ReactNode }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3.5 active:bg-muted/50">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4">{children}</div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default PDVMobileShell;

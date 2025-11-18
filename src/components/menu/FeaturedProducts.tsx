import { Product } from "@/types/menu";

interface FeaturedProductsProps {
  products: Product[];
  primaryColor: string;
  onProductClick: (product: Product) => void;
  title?: string;
}

export const FeaturedProducts = ({
  products,
  primaryColor,
  onProductClick,
  title = "Destaques",
}: FeaturedProductsProps) => {
  if (products.length === 0) return null;

  return (
    <div className="px-4 py-6">
      {title && (
        <h2 className="text-2xl font-bold text-foreground mb-4">{title}</h2>
      )}
      <div className="grid grid-cols-2 gap-3">
        {products.map((product) => (
          <button
            key={product.id}
            onClick={() => product.available && onProductClick(product)}
            className="bg-card rounded-2xl shadow-sm overflow-hidden cursor-pointer active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!product.available}
          >
            <div className="relative aspect-square bg-muted">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center text-white text-2xl font-bold"
                  style={{ backgroundColor: primaryColor }}
                >
                  {product.name.charAt(0)}
                </div>
              )}
              {!product.available && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white text-xs font-semibold bg-black/70 px-2 py-1 rounded">
                    Indisponível
                  </span>
                </div>
              )}
            </div>
            <div className="p-3 text-left">
              <h3 className="font-semibold text-sm mb-1 line-clamp-2">
                {product.name}
              </h3>
              <p className="text-lg font-bold" style={{ color: primaryColor }}>
                R$ {product.price.toFixed(2)}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

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
      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
        {products.map((product) => (
          <button
            key={product.id}
            onClick={() => product.available && onProductClick(product)}
            className="flex-none w-36 group"
            disabled={!product.available}
          >
            <div className="relative">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-36 h-36 object-cover rounded-2xl shadow-md group-hover:shadow-lg transition-shadow"
                />
              ) : (
                <div
                  className="w-36 h-36 rounded-2xl shadow-md flex items-center justify-center text-white text-xl font-bold"
                  style={{ backgroundColor: primaryColor }}
                >
                  {product.name.charAt(0)}
                </div>
              )}
              {!product.available && (
                <div className="absolute inset-0 bg-black/50 rounded-2xl flex items-center justify-center">
                  <span className="text-white text-xs font-semibold bg-black/70 px-2 py-1 rounded">
                    Indisponível
                  </span>
                </div>
              )}
              <div className="absolute top-2 left-2 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-md">
                Mais pedido
              </div>
            </div>
            <div className="mt-2">
              <p className="font-bold text-foreground" style={{ color: primaryColor }}>
                R$ {product.price.toFixed(2)}
              </p>
              <p className="text-sm font-medium text-foreground line-clamp-2">
                {product.name}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

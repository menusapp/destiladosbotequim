export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  available: boolean;
  image_url: string | null;
}

export interface ProductExtra {
  id: string;
  name: string;
  price: number;
}

export interface Category {
  id: string;
  name: string;
  products: Product[];
}

export interface Restaurant {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  is_open: boolean;
  service_fee_percentage?: number;
  prep_time_minutes?: number;
}

export interface CartItemExtra {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  extras: CartItemExtra[];
  notes?: string;
}

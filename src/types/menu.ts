export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  promotional_price?: number | null;
  available: boolean;
  image_url: string | null;
  prep_time_minutes?: number;
  is_featured?: boolean;
  featured_active?: boolean | null;
  featured_schedule?: any;
  featured_display_order?: number;
}

export interface ProductExtra {
  id: string;
  name: string;
  price: number;
  description?: string | null;
  is_required?: boolean;
  min_selection?: number;
  max_selection?: number;
  extra_category_id?: string;
  extra_category_name?: string;
}

export interface Category {
  id: string;
  name: string;
  products: Product[];
}

export interface Restaurant {
  id: string;
  name: string;
  slug?: string;
  logo_url: string | null;
  banner_url?: string | null;
  primary_color: string;
  is_open: boolean;
  service_fee_percentage?: number;
  service_fee_enabled?: boolean;
  prep_time_minutes?: number;
  login_require_name?: boolean;
  login_require_phone?: boolean;
}

export interface CartItemExtra {
  id: string;
  name: string;
  price: number;
  isComplementItem?: boolean;
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  extras: CartItemExtra[];
  notes?: string;
  isRewardItem?: boolean;
  rewardId?: string;
  isCouponFreeItem?: boolean;
  couponId?: string;
}

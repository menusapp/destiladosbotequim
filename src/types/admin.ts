export interface AdminOrder {
  id: string;
  customer_name: string;
  customer_cpf: string;
  status: string;
  created_at: string;
  notes: string | null;
  order_type?: string;
  delivery_phone?: string;
  delivery_address?: string;
  tables?: {
    table_number: number;
    restaurant_id: string;
  };
  order_items: Array<{
    id: string;
    quantity: number;
    price_at_order: number;
    notes: string | null;
    products: {
      name: string;
    } | null;
    order_item_extras: Array<{
      price_at_order: number;
      product_extras: {
        name: string;
      } | null;
    }>;
  }>;
}

export interface AdminBill {
  id: string;
  status: string;
  subtotal: number;
  service_fee: number;
  total_amount: number;
  payment_method: string;
  change_amount: number | null;
  created_at: string;
  tables: {
    table_number: number;
  };
  orders: Array<{
    customer_name: string;
    customer_cpf: string;
    notes: string | null;
    order_items: Array<{
      quantity: number;
      price_at_order: number;
      notes: string | null;
      products: {
        name: string;
      } | null;
      order_item_extras: Array<{
        price_at_order: number;
        product_extras: { name: string } | null;
      }>;
    }>;
  }>;
}

export interface ProductWithExtras {
  id: string;
  name: string;
  description: string | null;
  price: number;
  available: boolean;
  image_url: string | null;
  prep_time_minutes?: number;
  product_extras?: Array<{
    id: string;
    name: string;
    price: number;
  }>;
}

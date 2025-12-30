export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      app_versions: {
        Row: {
          created_at: string | null
          download_url_linux: string | null
          download_url_mac: string | null
          download_url_windows: string | null
          id: string
          is_current: boolean | null
          release_notes: string | null
          version: string
        }
        Insert: {
          created_at?: string | null
          download_url_linux?: string | null
          download_url_mac?: string | null
          download_url_windows?: string | null
          id?: string
          is_current?: boolean | null
          release_notes?: string | null
          version: string
        }
        Update: {
          created_at?: string | null
          download_url_linux?: string | null
          download_url_mac?: string | null
          download_url_windows?: string | null
          id?: string
          is_current?: boolean | null
          release_notes?: string | null
          version?: string
        }
        Relationships: []
      }
      bills: {
        Row: {
          change_amount: number | null
          comanda_id: string | null
          created_at: string | null
          id: string
          paid_at: string | null
          payment_method: string | null
          service_fee: number
          status: string | null
          subtotal: number
          table_id: string
          total_amount: number
        }
        Insert: {
          change_amount?: number | null
          comanda_id?: string | null
          created_at?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          service_fee: number
          status?: string | null
          subtotal: number
          table_id: string
          total_amount: number
        }
        Update: {
          change_amount?: number | null
          comanda_id?: string | null
          created_at?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          service_fee?: number
          status?: string | null
          subtotal?: number
          table_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "bills_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "comandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          close_time: string | null
          created_at: string | null
          day_of_week: number
          id: string
          is_open: boolean | null
          open_time: string | null
          restaurant_id: string
          updated_at: string | null
        }
        Insert: {
          close_time?: string | null
          created_at?: string | null
          day_of_week: number
          id?: string
          is_open?: boolean | null
          open_time?: string | null
          restaurant_id: string
          updated_at?: string | null
        }
        Update: {
          close_time?: string | null
          created_at?: string | null
          day_of_week?: number
          id?: string
          is_open?: boolean | null
          open_time?: string | null
          restaurant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      card_fees: {
        Row: {
          card_brand: string
          created_at: string | null
          fee_percentage: number
          id: string
          restaurant_id: string
          updated_at: string | null
        }
        Insert: {
          card_brand: string
          created_at?: string | null
          fee_percentage?: number
          id?: string
          restaurant_id: string
          updated_at?: string | null
        }
        Update: {
          card_brand?: string
          created_at?: string | null
          fee_percentage?: number
          id?: string
          restaurant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_fees_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      card_fees_config: {
        Row: {
          created_at: string | null
          credit_fee: number
          debit_fee: number
          id: string
          restaurant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          credit_fee?: number
          debit_fee?: number
          id?: string
          restaurant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          credit_fee?: number
          debit_fee?: number
          id?: string
          restaurant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_fees_config_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_movements: {
        Row: {
          amount: number
          bill_id: string | null
          cash_session_id: string
          category: string | null
          created_at: string | null
          created_by: string
          description: string
          id: string
          movement_type: string
          payment_method: string | null
          restaurant_id: string
        }
        Insert: {
          amount: number
          bill_id?: string | null
          cash_session_id: string
          category?: string | null
          created_at?: string | null
          created_by: string
          description: string
          id?: string
          movement_type: string
          payment_method?: string | null
          restaurant_id: string
        }
        Update: {
          amount?: number
          bill_id?: string | null
          cash_session_id?: string
          category?: string | null
          created_at?: string | null
          created_by?: string
          description?: string
          id?: string
          movement_type?: string
          payment_method?: string | null
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_movements_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_register_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_movements_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_register_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_balance: number | null
          created_at: string | null
          difference: number | null
          expected_balance: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_balance: number
          restaurant_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_balance?: number | null
          created_at?: string | null
          difference?: number | null
          expected_balance?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_balance?: number
          restaurant_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_balance?: number | null
          created_at?: string | null
          difference?: number | null
          expected_balance?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_balance?: number
          restaurant_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_register_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          name: string
          restaurant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name: string
          restaurant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          name?: string
          restaurant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      comandas: {
        Row: {
          closed_at: string | null
          created_at: string | null
          customer_cpf: string
          customer_name: string
          id: string
          restaurant_id: string
          status: string | null
          table_id: string
          updated_at: string | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string | null
          customer_cpf: string
          customer_name: string
          id?: string
          restaurant_id: string
          status?: string | null
          table_id: string
          updated_at?: string | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string | null
          customer_cpf?: string
          customer_name?: string
          id?: string
          restaurant_id?: string
          status?: string | null
          table_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comandas_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comandas_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      counter_order_item_extras: {
        Row: {
          counter_order_item_id: string
          created_at: string
          id: string
          price_at_order: number
          product_extra_id: string | null
        }
        Insert: {
          counter_order_item_id: string
          created_at?: string
          id?: string
          price_at_order: number
          product_extra_id?: string | null
        }
        Update: {
          counter_order_item_id?: string
          created_at?: string
          id?: string
          price_at_order?: number
          product_extra_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "counter_order_item_extras_counter_order_item_id_fkey"
            columns: ["counter_order_item_id"]
            isOneToOne: false
            referencedRelation: "counter_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counter_order_item_extras_product_extra_id_fkey"
            columns: ["product_extra_id"]
            isOneToOne: false
            referencedRelation: "product_extras"
            referencedColumns: ["id"]
          },
        ]
      }
      counter_order_items: {
        Row: {
          cost_snapshot: number | null
          counter_order_id: string
          created_at: string
          id: string
          notes: string | null
          price_at_order: number
          product_id: string | null
          quantity: number
        }
        Insert: {
          cost_snapshot?: number | null
          counter_order_id: string
          created_at?: string
          id?: string
          notes?: string | null
          price_at_order: number
          product_id?: string | null
          quantity?: number
        }
        Update: {
          cost_snapshot?: number | null
          counter_order_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          price_at_order?: number
          product_id?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "counter_order_items_counter_order_id_fkey"
            columns: ["counter_order_id"]
            isOneToOne: false
            referencedRelation: "counter_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counter_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      counter_orders: {
        Row: {
          created_at: string
          created_by: string
          customer_cpf: string | null
          customer_name: string
          fee_amount: number | null
          fee_type: string | null
          fee_value: number | null
          finalized_at: string | null
          id: string
          notes: string | null
          payment_method: string | null
          restaurant_id: string
          status: string
          subtotal: number
          table_id: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          customer_cpf?: string | null
          customer_name: string
          fee_amount?: number | null
          fee_type?: string | null
          fee_value?: number | null
          finalized_at?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          restaurant_id: string
          status?: string
          subtotal?: number
          table_id: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          customer_cpf?: string | null
          customer_name?: string
          fee_amount?: number | null
          fee_type?: string | null
          fee_value?: number | null
          finalized_at?: string | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          restaurant_id?: string
          status?: string
          subtotal?: number
          table_id?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "counter_orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "counter_orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          coupon_type: string | null
          created_at: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean | null
          max_discount: number | null
          min_order_value: number | null
          restaurant_id: string
          target_extra_id: string | null
          target_product_extra_id: string | null
          target_product_id: string | null
          updated_at: string | null
          usage_limit: number | null
          usage_limit_per_user: number | null
          used_count: number | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          code: string
          coupon_type?: string | null
          created_at?: string | null
          discount_type: string
          discount_value: number
          id?: string
          is_active?: boolean | null
          max_discount?: number | null
          min_order_value?: number | null
          restaurant_id: string
          target_extra_id?: string | null
          target_product_extra_id?: string | null
          target_product_id?: string | null
          updated_at?: string | null
          usage_limit?: number | null
          usage_limit_per_user?: number | null
          used_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          code?: string
          coupon_type?: string | null
          created_at?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean | null
          max_discount?: number | null
          min_order_value?: number | null
          restaurant_id?: string
          target_extra_id?: string | null
          target_product_extra_id?: string | null
          target_product_id?: string | null
          updated_at?: string | null
          usage_limit?: number | null
          usage_limit_per_user?: number | null
          used_count?: number | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_target_extra_id_fkey"
            columns: ["target_extra_id"]
            isOneToOne: false
            referencedRelation: "extra_category_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_target_product_extra_id_fkey"
            columns: ["target_product_extra_id"]
            isOneToOne: false
            referencedRelation: "product_extras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_target_product_id_fkey"
            columns: ["target_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          city: string
          complement: string | null
          created_at: string | null
          customer_cpf: string
          customer_name: string
          customer_phone: string
          id: string
          is_default: boolean | null
          neighborhood: string
          number: string
          state: string
          street: string
          updated_at: string | null
          zip_code: string
        }
        Insert: {
          city: string
          complement?: string | null
          created_at?: string | null
          customer_cpf: string
          customer_name: string
          customer_phone: string
          id?: string
          is_default?: boolean | null
          neighborhood: string
          number: string
          state: string
          street: string
          updated_at?: string | null
          zip_code: string
        }
        Update: {
          city?: string
          complement?: string | null
          created_at?: string | null
          customer_cpf?: string
          customer_name?: string
          customer_phone?: string
          id?: string
          is_default?: boolean | null
          neighborhood?: string
          number?: string
          state?: string
          street?: string
          updated_at?: string | null
          zip_code?: string
        }
        Relationships: []
      }
      customer_loyalty_progress: {
        Row: {
          created_at: string | null
          customer_cpf: string
          id: string
          last_reward_trigger: number | null
          program_id: string
          purchase_count: number | null
          restaurant_id: string
          total_spent: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_cpf: string
          id?: string
          last_reward_trigger?: number | null
          program_id: string
          purchase_count?: number | null
          restaurant_id: string
          total_spent?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_cpf?: string
          id?: string
          last_reward_trigger?: number | null
          program_id?: string
          purchase_count?: number | null
          restaurant_id?: string
          total_spent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_loyalty_progress_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_loyalty_progress_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          cpf: string
          created_at: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          restaurant_id: string
          updated_at: string | null
        }
        Insert: {
          cpf: string
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          restaurant_id: string
          updated_at?: string | null
        }
        Update: {
          cpf?: string
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          restaurant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_config: {
        Row: {
          created_at: string | null
          delivery_fee: number | null
          estimated_time_minutes: number | null
          id: string
          min_order_value: number | null
          restaurant_id: string
          store_address: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_fee?: number | null
          estimated_time_minutes?: number | null
          id?: string
          min_order_value?: number | null
          restaurant_id: string
          store_address?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_fee?: number | null
          estimated_time_minutes?: number | null
          id?: string
          min_order_value?: number | null
          restaurant_id?: string
          store_address?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_config_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          center_lat: number | null
          center_lng: number | null
          created_at: string | null
          delivery_fee: number | null
          estimated_time_minutes: number | null
          id: string
          is_active: boolean | null
          min_order_value: number | null
          neighborhoods: string[] | null
          radius_km: number | null
          restaurant_id: string
          updated_at: string | null
          zip_codes: string[] | null
          zone_name: string
          zone_type: string | null
        }
        Insert: {
          center_lat?: number | null
          center_lng?: number | null
          created_at?: string | null
          delivery_fee?: number | null
          estimated_time_minutes?: number | null
          id?: string
          is_active?: boolean | null
          min_order_value?: number | null
          neighborhoods?: string[] | null
          radius_km?: number | null
          restaurant_id: string
          updated_at?: string | null
          zip_codes?: string[] | null
          zone_name: string
          zone_type?: string | null
        }
        Update: {
          center_lat?: number | null
          center_lng?: number | null
          created_at?: string | null
          delivery_fee?: number | null
          estimated_time_minutes?: number | null
          id?: string
          is_active?: boolean | null
          min_order_value?: number | null
          neighborhoods?: string[] | null
          radius_km?: number | null
          restaurant_id?: string
          updated_at?: string | null
          zip_codes?: string[] | null
          zone_name?: string
          zone_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_zones_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      extra_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          restaurant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          restaurant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          restaurant_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      extra_category_item_ingredients: {
        Row: {
          category_item_id: string
          created_at: string | null
          id: string
          quantity: number
          stock_item_id: string
        }
        Insert: {
          category_item_id: string
          created_at?: string | null
          id?: string
          quantity?: number
          stock_item_id: string
        }
        Update: {
          category_item_id?: string
          created_at?: string | null
          id?: string
          quantity?: number
          stock_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "extra_category_item_ingredients_category_item_id_fkey"
            columns: ["category_item_id"]
            isOneToOne: false
            referencedRelation: "extra_category_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extra_category_item_ingredients_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      extra_category_items: {
        Row: {
          category_id: string
          created_at: string | null
          id: string
          name: string
          price: number
          updated_at: string | null
        }
        Insert: {
          category_id: string
          created_at?: string | null
          id?: string
          name: string
          price?: number
          updated_at?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string | null
          id?: string
          name?: string
          price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extra_category_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "extra_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_costs: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          name: string
          restaurant_id: string
          updated_at: string | null
        }
        Insert: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          restaurant_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          restaurant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixed_costs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      labor_costs: {
        Row: {
          created_at: string | null
          employee_name: string
          id: string
          restaurant_id: string
          role: string | null
          salary: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          employee_name: string
          id?: string
          restaurant_id: string
          role?: string | null
          salary?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          employee_name?: string
          id?: string
          restaurant_id?: string
          role?: string | null
          salary?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "labor_costs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_points: {
        Row: {
          created_at: string | null
          customer_cpf: string
          id: string
          last_updated: string | null
          points_balance: number | null
          restaurant_id: string
          total_earned: number | null
          total_redeemed: number | null
        }
        Insert: {
          created_at?: string | null
          customer_cpf: string
          id?: string
          last_updated?: string | null
          points_balance?: number | null
          restaurant_id: string
          total_earned?: number | null
          total_redeemed?: number | null
        }
        Update: {
          created_at?: string | null
          customer_cpf?: string
          id?: string
          last_updated?: string | null
          points_balance?: number | null
          restaurant_id?: string
          total_earned?: number | null
          total_redeemed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_points_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_program_rewards: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          program_id: string
          reward_product_id: string | null
          reward_type: string
          reward_value: number | null
          trigger_value: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          program_id: string
          reward_product_id?: string | null
          reward_type: string
          reward_value?: number | null
          trigger_value: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          program_id?: string
          reward_product_id?: string | null
          reward_type?: string
          reward_value?: number | null
          trigger_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_program_rewards_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_program_rewards_reward_product_id_fkey"
            columns: ["reward_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_programs: {
        Row: {
          activated_at: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          restaurant_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          activated_at?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          restaurant_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          activated_at?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          restaurant_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_programs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          created_at: string | null
          customer_cpf: string
          id: string
          order_id: string | null
          points: number
          restaurant_id: string
          type: string
        }
        Insert: {
          created_at?: string | null
          customer_cpf: string
          id?: string
          order_id?: string | null
          points: number
          restaurant_id: string
          type: string
        }
        Update: {
          created_at?: string | null
          customer_cpf?: string
          id?: string
          order_id?: string | null
          points?: number
          restaurant_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaign_rules: {
        Row: {
          campaign_id: string
          created_at: string | null
          delay_unit: string
          delay_value: number
          discount_target_category_id: string | null
          discount_target_product_id: string | null
          discount_target_type: string | null
          discount_type: string | null
          discount_validity_days: number | null
          discount_value: number | null
          id: string
          message_template: string
          order_type_filter: string | null
          trigger_category_id: string | null
          trigger_product_id: string | null
          trigger_type: string
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          delay_unit?: string
          delay_value?: number
          discount_target_category_id?: string | null
          discount_target_product_id?: string | null
          discount_target_type?: string | null
          discount_type?: string | null
          discount_validity_days?: number | null
          discount_value?: number | null
          id?: string
          message_template: string
          order_type_filter?: string | null
          trigger_category_id?: string | null
          trigger_product_id?: string | null
          trigger_type: string
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          delay_unit?: string
          delay_value?: number
          discount_target_category_id?: string | null
          discount_target_product_id?: string | null
          discount_target_type?: string | null
          discount_type?: string | null
          discount_validity_days?: number | null
          discount_value?: number | null
          id?: string
          message_template?: string
          order_type_filter?: string | null
          trigger_category_id?: string | null
          trigger_product_id?: string | null
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaign_rules_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_campaign_rules_discount_target_category_id_fkey"
            columns: ["discount_target_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_campaign_rules_discount_target_product_id_fkey"
            columns: ["discount_target_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_campaign_rules_trigger_category_id_fkey"
            columns: ["trigger_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_campaign_rules_trigger_product_id_fkey"
            columns: ["trigger_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          restaurant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          restaurant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          restaurant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_scheduled_messages: {
        Row: {
          campaign_id: string | null
          coupon_code: string | null
          created_at: string | null
          customer_cpf: string
          customer_name: string
          customer_phone: string
          error_message: string | null
          id: string
          message_text: string
          order_id: string | null
          restaurant_id: string
          rule_id: string | null
          scheduled_for: string
          sent_at: string | null
          status: string | null
        }
        Insert: {
          campaign_id?: string | null
          coupon_code?: string | null
          created_at?: string | null
          customer_cpf: string
          customer_name: string
          customer_phone: string
          error_message?: string | null
          id?: string
          message_text: string
          order_id?: string | null
          restaurant_id: string
          rule_id?: string | null
          scheduled_for: string
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          campaign_id?: string | null
          coupon_code?: string | null
          created_at?: string | null
          customer_cpf?: string
          customer_name?: string
          customer_phone?: string
          error_message?: string | null
          id?: string
          message_text?: string
          order_id?: string | null
          restaurant_id?: string
          rule_id?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_scheduled_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_scheduled_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_scheduled_messages_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_scheduled_messages_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaign_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_costs: {
        Row: {
          created_at: string | null
          fixed_cost: number
          id: string
          labor_cost: number
          month_year: string
          restaurant_id: string
          updated_at: string | null
          variable_cost: number
          variable_cost_type: string
        }
        Insert: {
          created_at?: string | null
          fixed_cost?: number
          id?: string
          labor_cost?: number
          month_year: string
          restaurant_id: string
          updated_at?: string | null
          variable_cost?: number
          variable_cost_type?: string
        }
        Update: {
          created_at?: string | null
          fixed_cost?: number
          id?: string
          labor_cost?: number
          month_year?: string
          restaurant_id?: string
          updated_at?: string | null
          variable_cost?: number
          variable_cost_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_costs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_extras: {
        Row: {
          created_at: string | null
          id: string
          order_item_id: string
          price_at_order: number
          product_extra_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_item_id: string
          price_at_order: number
          product_extra_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          order_item_id?: string
          price_at_order?: number
          product_extra_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_item_extras_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_extras_product_extra_id_fkey"
            columns: ["product_extra_id"]
            isOneToOne: false
            referencedRelation: "product_extras"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          order_id: string
          price_at_order: number
          product_id: string | null
          quantity: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id: string
          price_at_order: number
          product_id?: string | null
          quantity?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          price_at_order?: number
          product_id?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          comanda_id: string | null
          coupon_code: string | null
          coupon_discount: number | null
          created_at: string | null
          customer_cpf: string
          customer_name: string
          delivery_address: string | null
          delivery_city: string | null
          delivery_fee: number | null
          delivery_neighborhood: string | null
          delivery_phone: string | null
          delivery_type: string | null
          id: string
          loyalty_points_earned: number | null
          loyalty_points_used: number | null
          notes: string | null
          order_type: string | null
          payment_type: string | null
          restaurant_id: string
          status: string | null
          table_id: string | null
          updated_at: string | null
        }
        Insert: {
          comanda_id?: string | null
          coupon_code?: string | null
          coupon_discount?: number | null
          created_at?: string | null
          customer_cpf: string
          customer_name: string
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_fee?: number | null
          delivery_neighborhood?: string | null
          delivery_phone?: string | null
          delivery_type?: string | null
          id?: string
          loyalty_points_earned?: number | null
          loyalty_points_used?: number | null
          notes?: string | null
          order_type?: string | null
          payment_type?: string | null
          restaurant_id: string
          status?: string | null
          table_id?: string | null
          updated_at?: string | null
        }
        Update: {
          comanda_id?: string | null
          coupon_code?: string | null
          coupon_discount?: number | null
          created_at?: string | null
          customer_cpf?: string
          customer_name?: string
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_fee?: number | null
          delivery_neighborhood?: string | null
          delivery_phone?: string | null
          delivery_type?: string | null
          id?: string
          loyalty_points_earned?: number | null
          loyalty_points_used?: number | null
          notes?: string | null
          order_type?: string | null
          payment_type?: string | null
          restaurant_id?: string
          status?: string | null
          table_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "comandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          accepted_brands: string[] | null
          created_at: string | null
          id: string
          is_active: boolean | null
          method_type: string
          name: string
          restaurant_id: string
          updated_at: string | null
        }
        Insert: {
          accepted_brands?: string[] | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          method_type: string
          name: string
          restaurant_id: string
          updated_at?: string | null
        }
        Update: {
          accepted_brands?: string[] | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          method_type?: string
          name?: string
          restaurant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_complement_groups: {
        Row: {
          created_at: string | null
          display_order: number | null
          extra_category_id: string
          id: string
          is_required: boolean | null
          max_selection: number | null
          min_selection: number | null
          product_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          extra_category_id: string
          id?: string
          is_required?: boolean | null
          max_selection?: number | null
          min_selection?: number | null
          product_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          extra_category_id?: string
          id?: string
          is_required?: boolean | null
          max_selection?: number | null
          min_selection?: number | null
          product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_complement_groups_extra_category_id_fkey"
            columns: ["extra_category_id"]
            isOneToOne: false
            referencedRelation: "extra_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_complement_groups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_extra_ingredients: {
        Row: {
          created_at: string | null
          id: string
          product_extra_id: string
          quantity: number
          stock_item_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_extra_id: string
          quantity?: number
          stock_item_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_extra_id?: string
          quantity?: number
          stock_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_extra_ingredients_product_extra_id_fkey"
            columns: ["product_extra_id"]
            isOneToOne: false
            referencedRelation: "product_extras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_extra_ingredients_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      product_extras: {
        Row: {
          created_at: string | null
          extra_category_id: string | null
          id: string
          is_required: boolean | null
          max_selection: number | null
          min_selection: number | null
          name: string
          price: number
          product_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          extra_category_id?: string | null
          id?: string
          is_required?: boolean | null
          max_selection?: number | null
          min_selection?: number | null
          name: string
          price?: number
          product_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          extra_category_id?: string | null
          id?: string
          is_required?: boolean | null
          max_selection?: number | null
          min_selection?: number | null
          name?: string
          price?: number
          product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_extras_extra_category_id_fkey"
            columns: ["extra_category_id"]
            isOneToOne: false
            referencedRelation: "extra_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_extras_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_ingredients: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          quantity: number
          stock_item_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          quantity?: number
          stock_item_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          quantity?: number
          stock_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_ingredients_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ingredients_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          available: boolean | null
          category_id: string
          created_at: string | null
          description: string | null
          featured_display_order: number | null
          id: string
          image_url: string | null
          is_featured: boolean | null
          name: string
          prep_time_minutes: number | null
          price: number
          promotional_price: number | null
          updated_at: string | null
        }
        Insert: {
          available?: boolean | null
          category_id: string
          created_at?: string | null
          description?: string | null
          featured_display_order?: number | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          name: string
          prep_time_minutes?: number | null
          price: number
          promotional_price?: number | null
          updated_at?: string | null
        }
        Update: {
          available?: boolean | null
          category_id?: string
          created_at?: string | null
          description?: string | null
          featured_display_order?: number | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          name?: string
          prep_time_minutes?: number | null
          price?: number
          promotional_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          cpf: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          cpf?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      restaurant_credentials: {
        Row: {
          created_at: string | null
          id: string
          password_hash: string
          restaurant_id: string
          username: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          password_hash: string
          restaurant_id: string
          username: string
        }
        Update: {
          created_at?: string | null
          id?: string
          password_hash?: string
          restaurant_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_credentials_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_reviews: {
        Row: {
          bill_id: string | null
          comment: string | null
          counter_order_id: string | null
          created_at: string
          id: string
          order_id: string | null
          rating: number
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          bill_id?: string | null
          comment?: string | null
          counter_order_id?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          rating: number
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          bill_id?: string | null
          comment?: string | null
          counter_order_id?: string | null
          created_at?: string
          id?: string
          order_id?: string | null
          rating?: number
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_reviews_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_reviews_counter_order_id_fkey"
            columns: ["counter_order_id"]
            isOneToOne: false
            referencedRelation: "counter_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          auto_open_close: boolean | null
          banner_url: string | null
          created_at: string | null
          featured_section_enabled: boolean | null
          featured_section_title: string | null
          id: string
          is_open: boolean | null
          login_require_name: boolean | null
          login_require_phone: boolean | null
          logo_url: string | null
          loyalty_enabled: boolean | null
          loyalty_points_per_real: number | null
          loyalty_real_per_point: number | null
          name: string
          pickup_time_minutes: number | null
          prep_time_minutes: number | null
          primary_color: string | null
          rating: number | null
          review_count: number | null
          secondary_color: string | null
          service_fee_enabled: boolean | null
          service_fee_percentage: number | null
          slug: string
          target_cmv_percentage: number | null
          updated_at: string | null
        }
        Insert: {
          auto_open_close?: boolean | null
          banner_url?: string | null
          created_at?: string | null
          featured_section_enabled?: boolean | null
          featured_section_title?: string | null
          id?: string
          is_open?: boolean | null
          login_require_name?: boolean | null
          login_require_phone?: boolean | null
          logo_url?: string | null
          loyalty_enabled?: boolean | null
          loyalty_points_per_real?: number | null
          loyalty_real_per_point?: number | null
          name: string
          pickup_time_minutes?: number | null
          prep_time_minutes?: number | null
          primary_color?: string | null
          rating?: number | null
          review_count?: number | null
          secondary_color?: string | null
          service_fee_enabled?: boolean | null
          service_fee_percentage?: number | null
          slug: string
          target_cmv_percentage?: number | null
          updated_at?: string | null
        }
        Update: {
          auto_open_close?: boolean | null
          banner_url?: string | null
          created_at?: string | null
          featured_section_enabled?: boolean | null
          featured_section_title?: string | null
          id?: string
          is_open?: boolean | null
          login_require_name?: boolean | null
          login_require_phone?: boolean | null
          logo_url?: string | null
          loyalty_enabled?: boolean | null
          loyalty_points_per_real?: number | null
          loyalty_real_per_point?: number | null
          name?: string
          pickup_time_minutes?: number | null
          prep_time_minutes?: number | null
          primary_color?: string | null
          rating?: number | null
          review_count?: number | null
          secondary_color?: string | null
          service_fee_enabled?: boolean | null
          service_fee_percentage?: number | null
          slug?: string
          target_cmv_percentage?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      stock_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          restaurant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          restaurant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          restaurant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          category_id: string | null
          created_at: string | null
          current_quantity: number
          id: string
          minimum_quantity: number
          name: string
          price_per_unit: number
          restaurant_id: string
          unit: string
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          current_quantity?: number
          id?: string
          minimum_quantity?: number
          name: string
          price_per_unit?: number
          restaurant_id: string
          unit: string
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          current_quantity?: number
          id?: string
          minimum_quantity?: number
          name?: string
          price_per_unit?: number
          restaurant_id?: string
          unit?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "stock_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string | null
          id: string
          movement_type: string
          order_id: string | null
          quantity: number
          reason: string | null
          stock_item_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          movement_type: string
          order_id?: string | null
          quantity: number
          reason?: string | null
          stock_item_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          movement_type?: string
          order_id?: string | null
          quantity?: number
          reason?: string | null
          stock_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          created_at: string | null
          id: string
          is_occupied: boolean | null
          occupied_at: string | null
          occupied_by: string | null
          qr_code: string | null
          restaurant_id: string
          table_number: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_occupied?: boolean | null
          occupied_at?: string | null
          occupied_by?: string | null
          qr_code?: string | null
          restaurant_id: string
          table_number: number
        }
        Update: {
          created_at?: string | null
          id?: string
          is_occupied?: boolean | null
          occupied_at?: string | null
          occupied_by?: string | null
          qr_code?: string | null
          restaurant_id?: string
          table_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          restaurant_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          restaurant_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          restaurant_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      variable_costs: {
        Row: {
          amount: number | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          percentage: number | null
          restaurant_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          percentage?: number | null
          restaurant_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          percentage?: number | null
          restaurant_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "variable_costs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_config: {
        Row: {
          api_token: string | null
          connected_at: string | null
          connected_phone: string | null
          created_at: string | null
          enabled: boolean | null
          id: string
          instance_name: string | null
          instance_status: string | null
          message_accepted: string | null
          message_cancelled: string | null
          message_delivered: string | null
          message_out_for_delivery: string | null
          message_picked_up: string | null
          message_ready_for_pickup: string | null
          phone_number: string | null
          restaurant_id: string
          updated_at: string | null
        }
        Insert: {
          api_token?: string | null
          connected_at?: string | null
          connected_phone?: string | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          instance_name?: string | null
          instance_status?: string | null
          message_accepted?: string | null
          message_cancelled?: string | null
          message_delivered?: string | null
          message_out_for_delivery?: string | null
          message_picked_up?: string | null
          message_ready_for_pickup?: string | null
          phone_number?: string | null
          restaurant_id: string
          updated_at?: string | null
        }
        Update: {
          api_token?: string | null
          connected_at?: string | null
          connected_phone?: string | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          instance_name?: string | null
          instance_status?: string | null
          message_accepted?: string | null
          message_cancelled?: string | null
          message_delivered?: string | null
          message_out_for_delivery?: string | null
          message_picked_up?: string | null
          message_ready_for_pickup?: string | null
          phone_number?: string | null
          restaurant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_config_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_bill: {
        Args: { p_bill_id: string; p_restaurant_id: string }
        Returns: undefined
      }
      admin_delete_bill_and_orders: {
        Args: { p_bill_id: string; p_restaurant_id: string }
        Returns: undefined
      }
      admin_delete_category: {
        Args: { p_category_id: string; p_restaurant_id: string }
        Returns: undefined
      }
      admin_delete_order: {
        Args: { p_order_id: string; p_restaurant_id: string }
        Returns: undefined
      }
      admin_delete_order_and_bill: {
        Args: { p_order_id: string; p_restaurant_id: string }
        Returns: undefined
      }
      admin_delete_product: {
        Args: { p_product_id: string; p_restaurant_id: string }
        Returns: undefined
      }
      admin_delete_product_extra: {
        Args: { p_product_extra_id: string; p_restaurant_id: string }
        Returns: undefined
      }
      admin_delete_stock_item: {
        Args: { p_restaurant_id: string; p_stock_item_id: string }
        Returns: undefined
      }
      admin_mark_bill_on_the_way: {
        Args: { p_bill_id: string; p_restaurant_id: string }
        Returns: undefined
      }
      admin_mark_bill_paid: {
        Args: { p_bill_id: string; p_restaurant_id: string }
        Returns: undefined
      }
      admin_update_order_status: {
        Args: {
          p_new_status: string
          p_order_id: string
          p_restaurant_id: string
        }
        Returns: undefined
      }
      admin_update_restaurant_settings: {
        Args: {
          p_prep_time_minutes: number
          p_primary_color: string
          p_restaurant_id: string
          p_service_fee_enabled: boolean
          p_service_fee_percentage: number
          p_target_cmv_percentage: number
        }
        Returns: undefined
      }
      auto_release_idle_tables: { Args: never; Returns: undefined }
      auto_release_inactive_tables: { Args: never; Returns: undefined }
      check_product_availability: {
        Args: { p_product_id: string }
        Returns: boolean
      }
      cleanup_abandoned_tables: { Args: never; Returns: undefined }
      get_restaurant_rating_stats: {
        Args: { p_restaurant_id: string }
        Returns: {
          average_rating: number
          total_reviews: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_restaurant_admin: {
        Args: { _restaurant_id: string; _user_id: string }
        Returns: boolean
      }
      is_restaurant_closed_by_order_item: {
        Args: { _order_item_id: string }
        Returns: boolean
      }
      validate_restaurant_credentials: {
        Args: { p_password: string; p_username: string }
        Returns: {
          restaurant_id: string
          restaurant_name: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "ceo" | "restaurant_admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "ceo", "restaurant_admin", "user"],
    },
  },
} as const

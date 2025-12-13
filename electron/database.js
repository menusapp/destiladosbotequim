// Complete SQLite Database with all 34 Supabase tables
const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const crypto = require('crypto');

class LocalDatabase {
  constructor(dbPath = null) {
    const userDataPath = app ? app.getPath('userData') : '.';
    this.dbPath = dbPath || path.join(userDataPath, 'MenusData', 'database', 'menus-local.db');
    
    // Ensure directory exists
    const dbDir = path.dirname(this.dbPath);
    const fs = require('fs');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    
    this.initializeTables();
    this.seedDefaultData();
  }

  initializeTables() {
    this.db.exec(`
      -- =============================================
      -- CORE TABLES
      -- =============================================
      
      -- Restaurants (main entity)
      CREATE TABLE IF NOT EXISTS restaurants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        logo_url TEXT,
        banner_url TEXT,
        is_open INTEGER DEFAULT 1,
        auto_open_close INTEGER DEFAULT 0,
        service_fee_enabled INTEGER DEFAULT 0,
        service_fee_percentage REAL DEFAULT 10,
        prep_time_minutes INTEGER DEFAULT 30,
        pickup_time_minutes INTEGER DEFAULT 15,
        primary_color TEXT DEFAULT '#FF6B35',
        secondary_color TEXT DEFAULT '#1A1A1A',
        rating REAL DEFAULT 4.8,
        review_count INTEGER DEFAULT 12,
        target_cmv_percentage REAL DEFAULT 30,
        featured_section_enabled INTEGER DEFAULT 1,
        featured_section_title TEXT DEFAULT 'Destaques',
        loyalty_enabled INTEGER DEFAULT 0,
        loyalty_points_per_real REAL DEFAULT 1,
        loyalty_real_per_point REAL DEFAULT 0.01,
        login_require_name INTEGER DEFAULT 1,
        login_require_phone INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Categories
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        restaurant_id TEXT NOT NULL,
        display_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      );

      -- Products
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        promotional_price REAL,
        image_url TEXT,
        category_id TEXT NOT NULL,
        available INTEGER DEFAULT 1,
        is_featured INTEGER DEFAULT 0,
        featured_display_order INTEGER DEFAULT 0,
        prep_time_minutes INTEGER DEFAULT 30,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      );

      -- Tables
      CREATE TABLE IF NOT EXISTS tables (
        id TEXT PRIMARY KEY,
        table_number INTEGER NOT NULL,
        restaurant_id TEXT NOT NULL,
        qr_code TEXT,
        is_occupied INTEGER DEFAULT 0,
        occupied_by TEXT,
        occupied_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      );

      -- =============================================
      -- ORDER MANAGEMENT
      -- =============================================

      -- Comandas (customer sessions)
      CREATE TABLE IF NOT EXISTS comandas (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        table_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_cpf TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
        FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE
      );

      -- Orders
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        table_id TEXT,
        comanda_id TEXT,
        customer_name TEXT NOT NULL,
        customer_cpf TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        order_type TEXT DEFAULT 'local',
        delivery_type TEXT DEFAULT 'delivery',
        delivery_address TEXT,
        delivery_phone TEXT,
        delivery_neighborhood TEXT,
        delivery_city TEXT,
        delivery_fee REAL DEFAULT 0,
        payment_type TEXT,
        notes TEXT,
        coupon_code TEXT,
        coupon_discount REAL DEFAULT 0,
        loyalty_points_used INTEGER DEFAULT 0,
        loyalty_points_earned INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
        FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE SET NULL,
        FOREIGN KEY (comanda_id) REFERENCES comandas(id) ON DELETE SET NULL
      );

      -- Order Items
      CREATE TABLE IF NOT EXISTS order_items (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        product_id TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        price_at_order REAL NOT NULL,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
      );

      -- Order Item Extras
      CREATE TABLE IF NOT EXISTS order_item_extras (
        id TEXT PRIMARY KEY,
        order_item_id TEXT NOT NULL,
        product_extra_id TEXT,
        price_at_order REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
        FOREIGN KEY (product_extra_id) REFERENCES product_extras(id) ON DELETE SET NULL
      );

      -- =============================================
      -- COUNTER ORDERS (PDV BALCÃO)
      -- =============================================

      -- Counter Orders
      CREATE TABLE IF NOT EXISTS counter_orders (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        table_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_cpf TEXT,
        status TEXT DEFAULT 'pending',
        subtotal REAL DEFAULT 0,
        fee_type TEXT,
        fee_value REAL DEFAULT 0,
        fee_amount REAL DEFAULT 0,
        total_amount REAL DEFAULT 0,
        payment_method TEXT,
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        finalized_at DATETIME,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
        FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE
      );

      -- Counter Order Items
      CREATE TABLE IF NOT EXISTS counter_order_items (
        id TEXT PRIMARY KEY,
        counter_order_id TEXT NOT NULL,
        product_id TEXT,
        quantity INTEGER DEFAULT 1,
        price_at_order REAL NOT NULL,
        cost_snapshot REAL DEFAULT 0,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (counter_order_id) REFERENCES counter_orders(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
      );

      -- Counter Order Item Extras
      CREATE TABLE IF NOT EXISTS counter_order_item_extras (
        id TEXT PRIMARY KEY,
        counter_order_item_id TEXT NOT NULL,
        product_extra_id TEXT,
        price_at_order REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (counter_order_item_id) REFERENCES counter_order_items(id) ON DELETE CASCADE,
        FOREIGN KEY (product_extra_id) REFERENCES product_extras(id) ON DELETE SET NULL
      );

      -- =============================================
      -- BILLING
      -- =============================================

      -- Bills
      CREATE TABLE IF NOT EXISTS bills (
        id TEXT PRIMARY KEY,
        table_id TEXT NOT NULL,
        subtotal REAL NOT NULL,
        service_fee REAL NOT NULL,
        total_amount REAL NOT NULL,
        payment_method TEXT,
        change_amount REAL,
        status TEXT DEFAULT 'active',
        paid_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE
      );

      -- =============================================
      -- CASH REGISTER
      -- =============================================

      -- Cash Register Sessions
      CREATE TABLE IF NOT EXISTS cash_register_sessions (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        opening_balance REAL DEFAULT 0,
        closing_balance REAL,
        expected_balance REAL,
        difference REAL,
        status TEXT DEFAULT 'open',
        opened_by TEXT NOT NULL,
        closed_by TEXT,
        notes TEXT,
        opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        closed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      );

      -- Cash Movements
      CREATE TABLE IF NOT EXISTS cash_movements (
        id TEXT PRIMARY KEY,
        cash_session_id TEXT NOT NULL,
        restaurant_id TEXT NOT NULL,
        movement_type TEXT NOT NULL,
        amount REAL NOT NULL,
        payment_method TEXT,
        category TEXT,
        description TEXT NOT NULL,
        created_by TEXT NOT NULL,
        bill_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cash_session_id) REFERENCES cash_register_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE SET NULL
      );

      -- =============================================
      -- STOCK / INVENTORY
      -- =============================================

      -- Stock Categories
      CREATE TABLE IF NOT EXISTS stock_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        restaurant_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      );

      -- Stock Items
      CREATE TABLE IF NOT EXISTS stock_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        unit TEXT NOT NULL,
        current_quantity REAL DEFAULT 0,
        minimum_quantity REAL DEFAULT 0,
        price_per_unit REAL DEFAULT 0,
        category_id TEXT,
        restaurant_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES stock_categories(id) ON DELETE SET NULL,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      );

      -- Stock Movements
      CREATE TABLE IF NOT EXISTS stock_movements (
        id TEXT PRIMARY KEY,
        stock_item_id TEXT NOT NULL,
        movement_type TEXT NOT NULL,
        quantity REAL NOT NULL,
        reason TEXT,
        order_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
      );

      -- Product Ingredients
      CREATE TABLE IF NOT EXISTS product_ingredients (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        stock_item_id TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE CASCADE
      );

      -- =============================================
      -- PRODUCT EXTRAS / COMPLEMENTS
      -- =============================================

      -- Extra Categories (reusable complement groups)
      CREATE TABLE IF NOT EXISTS extra_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        restaurant_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      );

      -- Extra Category Items
      CREATE TABLE IF NOT EXISTS extra_category_items (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL,
        name TEXT NOT NULL,
        price REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES extra_categories(id) ON DELETE CASCADE
      );

      -- Extra Category Item Ingredients
      CREATE TABLE IF NOT EXISTS extra_category_item_ingredients (
        id TEXT PRIMARY KEY,
        category_item_id TEXT NOT NULL,
        stock_item_id TEXT NOT NULL,
        quantity REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_item_id) REFERENCES extra_category_items(id) ON DELETE CASCADE,
        FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE CASCADE
      );

      -- Product Extras (per-product)
      CREATE TABLE IF NOT EXISTS product_extras (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        name TEXT NOT NULL,
        price REAL DEFAULT 0,
        is_required INTEGER DEFAULT 0,
        min_selection INTEGER DEFAULT 0,
        max_selection INTEGER,
        extra_category_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (extra_category_id) REFERENCES extra_categories(id) ON DELETE SET NULL
      );

      -- Product Extra Ingredients
      CREATE TABLE IF NOT EXISTS product_extra_ingredients (
        id TEXT PRIMARY KEY,
        product_extra_id TEXT NOT NULL,
        stock_item_id TEXT NOT NULL,
        quantity REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_extra_id) REFERENCES product_extras(id) ON DELETE CASCADE,
        FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE CASCADE
      );

      -- Product Complement Groups (links products to reusable categories)
      CREATE TABLE IF NOT EXISTS product_complement_groups (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        extra_category_id TEXT NOT NULL,
        is_required INTEGER DEFAULT 0,
        min_selection INTEGER DEFAULT 0,
        max_selection INTEGER,
        display_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (extra_category_id) REFERENCES extra_categories(id) ON DELETE CASCADE
      );

      -- =============================================
      -- CUSTOMERS / CRM
      -- =============================================

      -- Customers
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        cpf TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
        UNIQUE(restaurant_id, cpf)
      );

      -- Customer Addresses
      CREATE TABLE IF NOT EXISTS customer_addresses (
        id TEXT PRIMARY KEY,
        customer_cpf TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        street TEXT NOT NULL,
        number TEXT NOT NULL,
        complement TEXT,
        neighborhood TEXT NOT NULL,
        city TEXT NOT NULL,
        state TEXT NOT NULL,
        zip_code TEXT NOT NULL,
        is_default INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- =============================================
      -- LOYALTY PROGRAM
      -- =============================================

      -- Loyalty Points
      CREATE TABLE IF NOT EXISTS loyalty_points (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        customer_cpf TEXT NOT NULL,
        points_balance INTEGER DEFAULT 0,
        total_earned INTEGER DEFAULT 0,
        total_redeemed INTEGER DEFAULT 0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
        UNIQUE(restaurant_id, customer_cpf)
      );

      -- Loyalty Transactions
      CREATE TABLE IF NOT EXISTS loyalty_transactions (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        customer_cpf TEXT NOT NULL,
        points INTEGER NOT NULL,
        type TEXT NOT NULL,
        order_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
      );

      -- =============================================
      -- COUPONS
      -- =============================================

      -- Coupons
      CREATE TABLE IF NOT EXISTS coupons (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        code TEXT NOT NULL,
        discount_type TEXT NOT NULL,
        discount_value REAL NOT NULL,
        min_order_value REAL DEFAULT 0,
        max_discount REAL,
        usage_limit INTEGER,
        used_count INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        valid_from DATETIME DEFAULT CURRENT_TIMESTAMP,
        valid_until DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
        UNIQUE(restaurant_id, code)
      );

      -- =============================================
      -- DELIVERY
      -- =============================================

      -- Delivery Config
      CREATE TABLE IF NOT EXISTS delivery_config (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL UNIQUE,
        min_order_value REAL DEFAULT 0,
        delivery_fee REAL DEFAULT 0,
        estimated_time_minutes INTEGER DEFAULT 30,
        store_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      );

      -- Delivery Zones
      CREATE TABLE IF NOT EXISTS delivery_zones (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        zone_name TEXT NOT NULL,
        neighborhoods TEXT,
        zip_codes TEXT,
        delivery_fee REAL DEFAULT 0,
        min_order_value REAL DEFAULT 0,
        estimated_time_minutes INTEGER DEFAULT 30,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      );

      -- =============================================
      -- BUSINESS HOURS
      -- =============================================

      -- Business Hours
      CREATE TABLE IF NOT EXISTS business_hours (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        day_of_week INTEGER NOT NULL,
        open_time TEXT,
        close_time TEXT,
        is_open INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      );

      -- =============================================
      -- PAYMENT METHODS
      -- =============================================

      -- Payment Methods
      CREATE TABLE IF NOT EXISTS payment_methods (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        method_type TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      );

      -- Card Fees Config
      CREATE TABLE IF NOT EXISTS card_fees_config (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL UNIQUE,
        debit_fee REAL DEFAULT 0,
        credit_fee REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      );

      -- Card Fees (per brand)
      CREATE TABLE IF NOT EXISTS card_fees (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        card_brand TEXT NOT NULL,
        fee_percentage REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      );

      -- =============================================
      -- COSTS
      -- =============================================

      -- Fixed Costs
      CREATE TABLE IF NOT EXISTS fixed_costs (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        amount REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      );

      -- Variable Costs
      CREATE TABLE IF NOT EXISTS variable_costs (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        amount REAL,
        percentage REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      );

      -- Labor Costs
      CREATE TABLE IF NOT EXISTS labor_costs (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        employee_name TEXT NOT NULL,
        role TEXT,
        salary REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      );

      -- Operational Costs (monthly summary)
      CREATE TABLE IF NOT EXISTS operational_costs (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        month_year TEXT NOT NULL,
        fixed_cost REAL DEFAULT 0,
        variable_cost REAL DEFAULT 0,
        variable_cost_type TEXT DEFAULT 'fixed',
        labor_cost REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      );

      -- =============================================
      -- REVIEWS
      -- =============================================

      -- Restaurant Reviews
      CREATE TABLE IF NOT EXISTS restaurant_reviews (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        order_id TEXT,
        bill_id TEXT,
        counter_order_id TEXT,
        rating INTEGER NOT NULL,
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE SET NULL,
        FOREIGN KEY (counter_order_id) REFERENCES counter_orders(id) ON DELETE SET NULL
      );

      -- =============================================
      -- WHATSAPP CONFIG
      -- =============================================

      -- WhatsApp Config
      CREATE TABLE IF NOT EXISTS whatsapp_config (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL UNIQUE,
        enabled INTEGER DEFAULT 0,
        phone_number TEXT,
        api_token TEXT,
        message_accepted TEXT DEFAULT 'Seu pedido foi aceito e está em preparo! 🍔',
        message_out_for_delivery TEXT DEFAULT 'Seu pedido saiu para entrega! 🚚',
        message_delivered TEXT DEFAULT 'Seu pedido foi entregue! Obrigado pela preferência! 🙏',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      );

      -- =============================================
      -- AUTH / USERS
      -- =============================================

      -- Users (local auth)
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        role TEXT DEFAULT 'user',
        restaurant_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE SET NULL
      );

      -- User Roles
      CREATE TABLE IF NOT EXISTS user_roles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        restaurant_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE SET NULL
      );

      -- Profiles
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        full_name TEXT,
        phone TEXT,
        cpf TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Restaurant Credentials
      CREATE TABLE IF NOT EXISTS restaurant_credentials (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
        UNIQUE(username)
      );

      -- =============================================
      -- APP VERSIONS (for updates)
      -- =============================================

      CREATE TABLE IF NOT EXISTS app_versions (
        id TEXT PRIMARY KEY,
        version TEXT NOT NULL,
        download_url_windows TEXT,
        download_url_mac TEXT,
        download_url_linux TEXT,
        release_notes TEXT,
        is_current INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- =============================================
      -- LOCAL BACKUPS (metadata tracking)
      -- =============================================

      CREATE TABLE IF NOT EXISTS local_backups (
        id TEXT PRIMARY KEY,
        backup_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        tables_count INTEGER,
        records_count INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- =============================================
      -- INDEXES
      -- =============================================

      CREATE INDEX IF NOT EXISTS idx_categories_restaurant ON categories(restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
      CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured);
      CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON tables(restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_tables_occupied ON tables(is_occupied);
      CREATE INDEX IF NOT EXISTS idx_comandas_restaurant ON comandas(restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_comandas_table ON comandas(table_id);
      CREATE INDEX IF NOT EXISTS idx_comandas_status ON comandas(status);
      CREATE INDEX IF NOT EXISTS idx_orders_restaurant ON orders(restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_type ON orders(order_type);
      CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_counter_orders_restaurant ON counter_orders(restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_bills_table ON bills(table_id);
      CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
      CREATE INDEX IF NOT EXISTS idx_cash_movements_session ON cash_movements(cash_session_id);
      CREATE INDEX IF NOT EXISTS idx_stock_items_restaurant ON stock_items(restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_stock_movements_item ON stock_movements(stock_item_id);
      CREATE INDEX IF NOT EXISTS idx_customers_restaurant ON customers(restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_customers_cpf ON customers(cpf);
      CREATE INDEX IF NOT EXISTS idx_loyalty_points_cpf ON loyalty_points(customer_cpf);
      CREATE INDEX IF NOT EXISTS idx_business_hours_restaurant ON business_hours(restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_delivery_zones_restaurant ON delivery_zones(restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_reviews_restaurant ON restaurant_reviews(restaurant_id);
    `);
  }

  seedDefaultData() {
    const restaurantExists = this.db.prepare('SELECT COUNT(*) as count FROM restaurants').get();
    
    if (restaurantExists.count === 0) {
      const restaurantId = this.generateId();
      this.db.prepare(`
        INSERT INTO restaurants (id, name, slug, is_open)
        VALUES (?, ?, ?, 1)
      `).run(restaurantId, 'Meu Restaurante', 'meu-restaurante');

      // Create default admin user
      const userId = this.generateId();
      const passwordHash = this.hashPassword('admin123');
      this.db.prepare(`
        INSERT INTO users (id, email, password_hash, full_name, role, restaurant_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(userId, 'admin@local.com', passwordHash, 'Administrador', 'restaurant_admin', restaurantId);

      // Create restaurant credentials
      const credId = this.generateId();
      this.db.prepare(`
        INSERT INTO restaurant_credentials (id, restaurant_id, username, password_hash)
        VALUES (?, ?, ?, ?)
      `).run(credId, restaurantId, 'admin', passwordHash);

      // Create default payment methods
      const paymentMethods = [
        { name: 'Dinheiro', method_type: 'cash' },
        { name: 'Cartão de Débito', method_type: 'debit' },
        { name: 'Cartão de Crédito', method_type: 'credit' },
        { name: 'PIX', method_type: 'pix' },
      ];

      paymentMethods.forEach(pm => {
        const pmId = this.generateId();
        this.db.prepare(`
          INSERT INTO payment_methods (id, restaurant_id, name, method_type, is_active)
          VALUES (?, ?, ?, ?, 1)
        `).run(pmId, restaurantId, pm.name, pm.method_type);
      });

      // Create default business hours (Mon-Sun)
      for (let day = 0; day < 7; day++) {
        const bhId = this.generateId();
        this.db.prepare(`
          INSERT INTO business_hours (id, restaurant_id, day_of_week, open_time, close_time, is_open)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(bhId, restaurantId, day, '10:00', '22:00', day < 6 ? 1 : 0);
      }

      // Create delivery config
      const dcId = this.generateId();
      this.db.prepare(`
        INSERT INTO delivery_config (id, restaurant_id, min_order_value, delivery_fee, estimated_time_minutes)
        VALUES (?, ?, ?, ?, ?)
      `).run(dcId, restaurantId, 20, 5, 45);

      // Create card fees config
      const cfId = this.generateId();
      this.db.prepare(`
        INSERT INTO card_fees_config (id, restaurant_id, debit_fee, credit_fee)
        VALUES (?, ?, ?, ?)
      `).run(cfId, restaurantId, 1.5, 3.5);
    }
  }

  generateId() {
    return crypto.randomUUID();
  }

  hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  // =============================================
  // GENERIC CRUD HELPERS
  // =============================================

  _getAll(table, where = null, orderBy = 'created_at DESC') {
    let sql = `SELECT * FROM ${table}`;
    const params = [];
    
    if (where) {
      const conditions = Object.keys(where).map(k => `${k} = ?`);
      sql += ` WHERE ${conditions.join(' AND ')}`;
      params.push(...Object.values(where));
    }
    
    sql += ` ORDER BY ${orderBy}`;
    return this.db.prepare(sql).all(...params);
  }

  _getOne(table, where) {
    const conditions = Object.keys(where).map(k => `${k} = ?`);
    const sql = `SELECT * FROM ${table} WHERE ${conditions.join(' AND ')}`;
    return this.db.prepare(sql).get(...Object.values(where));
  }

  _insert(table, data) {
    const id = data.id || this.generateId();
    const dataWithId = { id, ...data };
    
    const keys = Object.keys(dataWithId);
    const placeholders = keys.map(() => '?');
    const values = keys.map(k => {
      const v = dataWithId[k];
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (Array.isArray(v)) return JSON.stringify(v);
      return v;
    });
    
    const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')})`;
    this.db.prepare(sql).run(...values);
    
    return { ...dataWithId };
  }

  _update(table, id, data) {
    const fields = [];
    const values = [];
    
    Object.keys(data).forEach(key => {
      if (key !== 'id') {
        fields.push(`${key} = ?`);
        let v = data[key];
        if (typeof v === 'boolean') v = v ? 1 : 0;
        if (Array.isArray(v)) v = JSON.stringify(v);
        values.push(v);
      }
    });
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    const sql = `UPDATE ${table} SET ${fields.join(', ')} WHERE id = ?`;
    this.db.prepare(sql).run(...values);
    
    return { id, ...data };
  }

  _delete(table, id) {
    this.db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    return { success: true };
  }

  // =============================================
  // RESTAURANTS
  // =============================================

  getRestaurants() {
    return this._getAll('restaurants', null, 'name ASC');
  }

  getRestaurantById(id) {
    return this._getOne('restaurants', { id });
  }

  getRestaurantBySlug(slug) {
    return this._getOne('restaurants', { slug });
  }

  createRestaurant(data) {
    return this._insert('restaurants', data);
  }

  updateRestaurant(id, data) {
    return this._update('restaurants', id, data);
  }

  deleteRestaurant(id) {
    return this._delete('restaurants', id);
  }

  // =============================================
  // CATEGORIES
  // =============================================

  getCategories(restaurantId) {
    return this._getAll('categories', { restaurant_id: restaurantId }, 'display_order ASC, name ASC');
  }

  createCategory(data) {
    return this._insert('categories', data);
  }

  updateCategory(id, data) {
    return this._update('categories', id, data);
  }

  deleteCategory(id) {
    return this._delete('categories', id);
  }

  // =============================================
  // PRODUCTS
  // =============================================

  getProducts(categoryId) {
    return this._getAll('products', { category_id: categoryId }, 'name ASC');
  }

  getProductsByRestaurant(restaurantId) {
    return this.db.prepare(`
      SELECT p.* FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE c.restaurant_id = ?
      ORDER BY c.display_order ASC, p.name ASC
    `).all(restaurantId);
  }

  getFeaturedProducts(restaurantId) {
    return this.db.prepare(`
      SELECT p.* FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE c.restaurant_id = ? AND p.is_featured = 1 AND p.available = 1
      ORDER BY p.featured_display_order ASC
    `).all(restaurantId);
  }

  createProduct(data) {
    return this._insert('products', data);
  }

  updateProduct(id, data) {
    return this._update('products', id, data);
  }

  deleteProduct(id) {
    return this._delete('products', id);
  }

  // =============================================
  // TABLES
  // =============================================

  getTables(restaurantId) {
    return this._getAll('tables', { restaurant_id: restaurantId }, 'table_number ASC');
  }

  getTableById(id) {
    return this._getOne('tables', { id });
  }

  createTable(data) {
    return this._insert('tables', data);
  }

  updateTable(id, data) {
    return this._update('tables', id, data);
  }

  deleteTable(id) {
    return this._delete('tables', id);
  }

  // =============================================
  // COMANDAS
  // =============================================

  getComandas(restaurantId) {
    return this._getAll('comandas', { restaurant_id: restaurantId }, 'created_at DESC');
  }

  getComandasByTable(tableId) {
    return this._getAll('comandas', { table_id: tableId }, 'created_at DESC');
  }

  getActiveComandaByTable(tableId) {
    return this._getOne('comandas', { table_id: tableId, status: 'active' });
  }

  createComanda(data) {
    // Close any previous active comandas on this table
    this.db.prepare(`
      UPDATE comandas SET status = 'closed', closed_at = CURRENT_TIMESTAMP
      WHERE table_id = ? AND status = 'active'
    `).run(data.table_id);
    
    return this._insert('comandas', { ...data, status: 'active' });
  }

  updateComanda(id, data) {
    return this._update('comandas', id, data);
  }

  closeComanda(id) {
    return this._update('comandas', id, { status: 'closed', closed_at: new Date().toISOString() });
  }

  // =============================================
  // ORDERS
  // =============================================

  getOrders(restaurantId) {
    return this._getAll('orders', { restaurant_id: restaurantId }, 'created_at DESC');
  }

  getOrdersByTable(tableId) {
    return this._getAll('orders', { table_id: tableId }, 'created_at DESC');
  }

  getOrdersByComanda(comandaId) {
    return this._getAll('orders', { comanda_id: comandaId }, 'created_at DESC');
  }

  getOrdersByStatus(restaurantId, status) {
    return this.db.prepare(`
      SELECT * FROM orders WHERE restaurant_id = ? AND status = ?
      ORDER BY created_at DESC
    `).all(restaurantId, status);
  }

  getOrdersByType(restaurantId, orderType) {
    return this.db.prepare(`
      SELECT * FROM orders WHERE restaurant_id = ? AND order_type = ?
      ORDER BY created_at DESC
    `).all(restaurantId, orderType);
  }

  createOrder(data) {
    const order = this._insert('orders', data);
    
    // Emit event for realtime
    if (this.eventBus) {
      this.eventBus.emit('orders', { type: 'INSERT', new: order });
    }
    
    return order;
  }

  updateOrder(id, data) {
    const order = this._update('orders', id, data);
    
    // Emit event for realtime
    if (this.eventBus) {
      this.eventBus.emit('orders', { type: 'UPDATE', new: order });
    }
    
    return order;
  }

  deleteOrder(id) {
    return this._delete('orders', id);
  }

  // =============================================
  // ORDER ITEMS
  // =============================================

  getOrderItems(orderId) {
    return this.db.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url as product_image
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
      ORDER BY oi.created_at ASC
    `).all(orderId);
  }

  createOrderItem(data) {
    return this._insert('order_items', data);
  }

  deleteOrderItem(id) {
    return this._delete('order_items', id);
  }

  // =============================================
  // ORDER ITEM EXTRAS
  // =============================================

  getOrderItemExtras(orderItemId) {
    return this.db.prepare(`
      SELECT oie.*, pe.name as extra_name
      FROM order_item_extras oie
      LEFT JOIN product_extras pe ON oie.product_extra_id = pe.id
      WHERE oie.order_item_id = ?
    `).all(orderItemId);
  }

  createOrderItemExtra(data) {
    return this._insert('order_item_extras', data);
  }

  // =============================================
  // COUNTER ORDERS (PDV)
  // =============================================

  getCounterOrders(restaurantId) {
    return this._getAll('counter_orders', { restaurant_id: restaurantId }, 'created_at DESC');
  }

  createCounterOrder(data) {
    return this._insert('counter_orders', data);
  }

  updateCounterOrder(id, data) {
    return this._update('counter_orders', id, data);
  }

  getCounterOrderItems(counterOrderId) {
    return this.db.prepare(`
      SELECT coi.*, p.name as product_name, p.image_url as product_image
      FROM counter_order_items coi
      LEFT JOIN products p ON coi.product_id = p.id
      WHERE coi.counter_order_id = ?
    `).all(counterOrderId);
  }

  createCounterOrderItem(data) {
    return this._insert('counter_order_items', data);
  }

  createCounterOrderItemExtra(data) {
    return this._insert('counter_order_item_extras', data);
  }

  // =============================================
  // BILLS
  // =============================================

  getBills(restaurantId) {
    return this.db.prepare(`
      SELECT b.* FROM bills b
      JOIN tables t ON b.table_id = t.id
      WHERE t.restaurant_id = ?
      ORDER BY b.created_at DESC
    `).all(restaurantId);
  }

  getBillsByTable(tableId) {
    return this._getAll('bills', { table_id: tableId }, 'created_at DESC');
  }

  getActiveBillByTable(tableId) {
    return this.db.prepare(`
      SELECT * FROM bills 
      WHERE table_id = ? AND status IN ('active', 'requested', 'on_the_way', 'pending')
      ORDER BY created_at DESC LIMIT 1
    `).get(tableId);
  }

  createBill(data) {
    const bill = this._insert('bills', data);
    
    if (this.eventBus) {
      this.eventBus.emit('bills', { type: 'INSERT', new: bill });
    }
    
    return bill;
  }

  updateBill(id, data) {
    const bill = this._update('bills', id, data);
    
    if (this.eventBus) {
      this.eventBus.emit('bills', { type: 'UPDATE', new: bill });
    }
    
    return bill;
  }

  deleteBill(id) {
    return this._delete('bills', id);
  }

  // =============================================
  // CASH REGISTER
  // =============================================

  getCashSessions(restaurantId) {
    return this._getAll('cash_register_sessions', { restaurant_id: restaurantId }, 'opened_at DESC');
  }

  getOpenCashSession(restaurantId) {
    return this._getOne('cash_register_sessions', { restaurant_id: restaurantId, status: 'open' });
  }

  createCashSession(data) {
    return this._insert('cash_register_sessions', { ...data, status: 'open' });
  }

  updateCashSession(id, data) {
    return this._update('cash_register_sessions', id, data);
  }

  closeCashSession(id, data) {
    return this._update('cash_register_sessions', id, {
      ...data,
      status: 'closed',
      closed_at: new Date().toISOString()
    });
  }

  getCashMovements(sessionId) {
    return this._getAll('cash_movements', { cash_session_id: sessionId }, 'created_at DESC');
  }

  getCashMovementsByRestaurant(restaurantId) {
    return this._getAll('cash_movements', { restaurant_id: restaurantId }, 'created_at DESC');
  }

  createCashMovement(data) {
    return this._insert('cash_movements', data);
  }

  // =============================================
  // STOCK
  // =============================================

  getStockItems(restaurantId) {
    return this.db.prepare(`
      SELECT si.*, sc.name as category_name
      FROM stock_items si
      LEFT JOIN stock_categories sc ON si.category_id = sc.id
      WHERE si.restaurant_id = ?
      ORDER BY si.name ASC
    `).all(restaurantId);
  }

  createStockItem(data) {
    return this._insert('stock_items', data);
  }

  updateStockItem(id, data) {
    return this._update('stock_items', id, data);
  }

  deleteStockItem(id) {
    return this._delete('stock_items', id);
  }

  getStockCategories(restaurantId) {
    return this._getAll('stock_categories', { restaurant_id: restaurantId }, 'name ASC');
  }

  createStockCategory(data) {
    return this._insert('stock_categories', data);
  }

  updateStockCategory(id, data) {
    return this._update('stock_categories', id, data);
  }

  deleteStockCategory(id) {
    return this._delete('stock_categories', id);
  }

  getStockMovements(stockItemId) {
    return this._getAll('stock_movements', { stock_item_id: stockItemId }, 'created_at DESC');
  }

  getAllStockMovements(restaurantId) {
    return this.db.prepare(`
      SELECT sm.*, si.name as item_name, si.unit
      FROM stock_movements sm
      JOIN stock_items si ON sm.stock_item_id = si.id
      WHERE si.restaurant_id = ?
      ORDER BY sm.created_at DESC
    `).all(restaurantId);
  }

  createStockMovement(data) {
    const movement = this._insert('stock_movements', data);
    
    // Update stock quantity
    const item = this._getOne('stock_items', { id: data.stock_item_id });
    if (item) {
      const newQty = data.movement_type === 'entrada' 
        ? item.current_quantity + data.quantity
        : item.current_quantity - data.quantity;
      
      this._update('stock_items', data.stock_item_id, { current_quantity: newQty });
    }
    
    return movement;
  }

  // =============================================
  // PRODUCT INGREDIENTS
  // =============================================

  getProductIngredients(productId) {
    return this.db.prepare(`
      SELECT pi.*, si.name as ingredient_name, si.unit, si.price_per_unit
      FROM product_ingredients pi
      JOIN stock_items si ON pi.stock_item_id = si.id
      WHERE pi.product_id = ?
    `).all(productId);
  }

  createProductIngredient(data) {
    return this._insert('product_ingredients', data);
  }

  deleteProductIngredient(id) {
    return this._delete('product_ingredients', id);
  }

  deleteProductIngredientsByProduct(productId) {
    this.db.prepare('DELETE FROM product_ingredients WHERE product_id = ?').run(productId);
    return { success: true };
  }

  // =============================================
  // PRODUCT EXTRAS
  // =============================================

  getProductExtras(productId) {
    return this._getAll('product_extras', { product_id: productId }, 'name ASC');
  }

  createProductExtra(data) {
    return this._insert('product_extras', data);
  }

  updateProductExtra(id, data) {
    return this._update('product_extras', id, data);
  }

  deleteProductExtra(id) {
    return this._delete('product_extras', id);
  }

  deleteProductExtrasByProduct(productId) {
    this.db.prepare('DELETE FROM product_extras WHERE product_id = ?').run(productId);
    return { success: true };
  }

  getProductExtraIngredients(productExtraId) {
    return this.db.prepare(`
      SELECT pei.*, si.name as ingredient_name, si.unit, si.price_per_unit
      FROM product_extra_ingredients pei
      JOIN stock_items si ON pei.stock_item_id = si.id
      WHERE pei.product_extra_id = ?
    `).all(productExtraId);
  }

  createProductExtraIngredient(data) {
    return this._insert('product_extra_ingredients', data);
  }

  // =============================================
  // EXTRA CATEGORIES (REUSABLE COMPLEMENTS)
  // =============================================

  getExtraCategories(restaurantId) {
    return this._getAll('extra_categories', { restaurant_id: restaurantId }, 'name ASC');
  }

  createExtraCategory(data) {
    return this._insert('extra_categories', data);
  }

  updateExtraCategory(id, data) {
    return this._update('extra_categories', id, data);
  }

  deleteExtraCategory(id) {
    return this._delete('extra_categories', id);
  }

  getExtraCategoryItems(categoryId) {
    return this._getAll('extra_category_items', { category_id: categoryId }, 'name ASC');
  }

  createExtraCategoryItem(data) {
    return this._insert('extra_category_items', data);
  }

  updateExtraCategoryItem(id, data) {
    return this._update('extra_category_items', id, data);
  }

  deleteExtraCategoryItem(id) {
    return this._delete('extra_category_items', id);
  }

  // =============================================
  // PRODUCT COMPLEMENT GROUPS
  // =============================================

  getProductComplementGroups(productId) {
    return this.db.prepare(`
      SELECT pcg.*, ec.name as category_name
      FROM product_complement_groups pcg
      JOIN extra_categories ec ON pcg.extra_category_id = ec.id
      WHERE pcg.product_id = ?
      ORDER BY pcg.display_order ASC
    `).all(productId);
  }

  createProductComplementGroup(data) {
    return this._insert('product_complement_groups', data);
  }

  updateProductComplementGroup(id, data) {
    return this._update('product_complement_groups', id, data);
  }

  deleteProductComplementGroup(id) {
    return this._delete('product_complement_groups', id);
  }

  deleteProductComplementGroupsByProduct(productId) {
    this.db.prepare('DELETE FROM product_complement_groups WHERE product_id = ?').run(productId);
    return { success: true };
  }

  // =============================================
  // CUSTOMERS
  // =============================================

  getCustomers(restaurantId) {
    return this._getAll('customers', { restaurant_id: restaurantId }, 'name ASC');
  }

  getCustomerByCpf(restaurantId, cpf) {
    return this._getOne('customers', { restaurant_id: restaurantId, cpf });
  }

  getCustomerByPhone(restaurantId, phone) {
    return this._getOne('customers', { restaurant_id: restaurantId, phone });
  }

  createCustomer(data) {
    return this._insert('customers', data);
  }

  updateCustomer(id, data) {
    return this._update('customers', id, data);
  }

  deleteCustomer(id) {
    return this._delete('customers', id);
  }

  getCustomerAddresses(customerCpf) {
    return this._getAll('customer_addresses', { customer_cpf: customerCpf }, 'is_default DESC, created_at DESC');
  }

  createCustomerAddress(data) {
    return this._insert('customer_addresses', data);
  }

  updateCustomerAddress(id, data) {
    return this._update('customer_addresses', id, data);
  }

  deleteCustomerAddress(id) {
    return this._delete('customer_addresses', id);
  }

  // =============================================
  // LOYALTY
  // =============================================

  getLoyaltyPoints(restaurantId, customerCpf) {
    return this._getOne('loyalty_points', { restaurant_id: restaurantId, customer_cpf: customerCpf });
  }

  createOrUpdateLoyaltyPoints(data) {
    const existing = this.getLoyaltyPoints(data.restaurant_id, data.customer_cpf);
    if (existing) {
      return this._update('loyalty_points', existing.id, data);
    }
    return this._insert('loyalty_points', data);
  }

  getLoyaltyTransactions(restaurantId, customerCpf) {
    return this.db.prepare(`
      SELECT * FROM loyalty_transactions
      WHERE restaurant_id = ? AND customer_cpf = ?
      ORDER BY created_at DESC
    `).all(restaurantId, customerCpf);
  }

  createLoyaltyTransaction(data) {
    return this._insert('loyalty_transactions', data);
  }

  // =============================================
  // COUPONS
  // =============================================

  getCoupons(restaurantId) {
    return this._getAll('coupons', { restaurant_id: restaurantId }, 'created_at DESC');
  }

  getCouponByCode(restaurantId, code) {
    return this._getOne('coupons', { restaurant_id: restaurantId, code: code.toUpperCase() });
  }

  createCoupon(data) {
    return this._insert('coupons', { ...data, code: data.code.toUpperCase() });
  }

  updateCoupon(id, data) {
    return this._update('coupons', id, data);
  }

  deleteCoupon(id) {
    return this._delete('coupons', id);
  }

  incrementCouponUsage(id) {
    this.db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').run(id);
    return { success: true };
  }

  // =============================================
  // DELIVERY
  // =============================================

  getDeliveryConfig(restaurantId) {
    return this._getOne('delivery_config', { restaurant_id: restaurantId });
  }

  createOrUpdateDeliveryConfig(data) {
    const existing = this.getDeliveryConfig(data.restaurant_id);
    if (existing) {
      return this._update('delivery_config', existing.id, data);
    }
    return this._insert('delivery_config', data);
  }

  getDeliveryZones(restaurantId) {
    return this._getAll('delivery_zones', { restaurant_id: restaurantId }, 'zone_name ASC');
  }

  getDeliveryZoneByZip(restaurantId, zipCode) {
    const zones = this.getDeliveryZones(restaurantId);
    for (const zone of zones) {
      if (!zone.is_active) continue;
      const zips = zone.zip_codes ? JSON.parse(zone.zip_codes) : [];
      if (zips.includes(zipCode)) {
        return zone;
      }
    }
    return null;
  }

  createDeliveryZone(data) {
    return this._insert('delivery_zones', data);
  }

  updateDeliveryZone(id, data) {
    return this._update('delivery_zones', id, data);
  }

  deleteDeliveryZone(id) {
    return this._delete('delivery_zones', id);
  }

  // =============================================
  // BUSINESS HOURS
  // =============================================

  getBusinessHours(restaurantId) {
    return this._getAll('business_hours', { restaurant_id: restaurantId }, 'day_of_week ASC');
  }

  createOrUpdateBusinessHours(data) {
    const existing = this.db.prepare(`
      SELECT * FROM business_hours WHERE restaurant_id = ? AND day_of_week = ?
    `).get(data.restaurant_id, data.day_of_week);
    
    if (existing) {
      return this._update('business_hours', existing.id, data);
    }
    return this._insert('business_hours', data);
  }

  // =============================================
  // PAYMENT METHODS
  // =============================================

  getPaymentMethods(restaurantId) {
    return this._getAll('payment_methods', { restaurant_id: restaurantId }, 'name ASC');
  }

  getActivePaymentMethods(restaurantId) {
    return this.db.prepare(`
      SELECT * FROM payment_methods WHERE restaurant_id = ? AND is_active = 1 ORDER BY name ASC
    `).all(restaurantId);
  }

  createPaymentMethod(data) {
    return this._insert('payment_methods', data);
  }

  updatePaymentMethod(id, data) {
    return this._update('payment_methods', id, data);
  }

  deletePaymentMethod(id) {
    return this._delete('payment_methods', id);
  }

  getCardFeesConfig(restaurantId) {
    return this._getOne('card_fees_config', { restaurant_id: restaurantId });
  }

  createOrUpdateCardFeesConfig(data) {
    const existing = this.getCardFeesConfig(data.restaurant_id);
    if (existing) {
      return this._update('card_fees_config', existing.id, data);
    }
    return this._insert('card_fees_config', data);
  }

  // =============================================
  // COSTS
  // =============================================

  getFixedCosts(restaurantId) {
    return this._getAll('fixed_costs', { restaurant_id: restaurantId }, 'name ASC');
  }

  createFixedCost(data) {
    return this._insert('fixed_costs', data);
  }

  updateFixedCost(id, data) {
    return this._update('fixed_costs', id, data);
  }

  deleteFixedCost(id) {
    return this._delete('fixed_costs', id);
  }

  getVariableCosts(restaurantId) {
    return this._getAll('variable_costs', { restaurant_id: restaurantId }, 'name ASC');
  }

  createVariableCost(data) {
    return this._insert('variable_costs', data);
  }

  updateVariableCost(id, data) {
    return this._update('variable_costs', id, data);
  }

  deleteVariableCost(id) {
    return this._delete('variable_costs', id);
  }

  getLaborCosts(restaurantId) {
    return this._getAll('labor_costs', { restaurant_id: restaurantId }, 'employee_name ASC');
  }

  createLaborCost(data) {
    return this._insert('labor_costs', data);
  }

  updateLaborCost(id, data) {
    return this._update('labor_costs', id, data);
  }

  deleteLaborCost(id) {
    return this._delete('labor_costs', id);
  }

  getOperationalCosts(restaurantId, monthYear) {
    return this._getOne('operational_costs', { restaurant_id: restaurantId, month_year: monthYear });
  }

  createOrUpdateOperationalCosts(data) {
    const existing = this.getOperationalCosts(data.restaurant_id, data.month_year);
    if (existing) {
      return this._update('operational_costs', existing.id, data);
    }
    return this._insert('operational_costs', data);
  }

  // =============================================
  // REVIEWS
  // =============================================

  getReviews(restaurantId) {
    return this._getAll('restaurant_reviews', { restaurant_id: restaurantId }, 'created_at DESC');
  }

  createReview(data) {
    const review = this._insert('restaurant_reviews', data);
    
    // Update restaurant rating
    this.updateRestaurantRating(data.restaurant_id);
    
    return review;
  }

  updateRestaurantRating(restaurantId) {
    const stats = this.db.prepare(`
      SELECT AVG(rating) as avg_rating, COUNT(*) as count
      FROM restaurant_reviews WHERE restaurant_id = ?
    `).get(restaurantId);
    
    if (stats) {
      this._update('restaurants', restaurantId, {
        rating: Math.round(stats.avg_rating * 10) / 10,
        review_count: stats.count
      });
    }
  }

  // =============================================
  // WHATSAPP CONFIG
  // =============================================

  getWhatsAppConfig(restaurantId) {
    return this._getOne('whatsapp_config', { restaurant_id: restaurantId });
  }

  createOrUpdateWhatsAppConfig(data) {
    const existing = this.getWhatsAppConfig(data.restaurant_id);
    if (existing) {
      return this._update('whatsapp_config', existing.id, data);
    }
    return this._insert('whatsapp_config', data);
  }

  // =============================================
  // AUTH
  // =============================================

  login(username, password) {
    const passwordHash = this.hashPassword(password);
    
    // Try restaurant credentials first
    const cred = this.db.prepare(`
      SELECT rc.*, r.id as restaurant_id, r.name as restaurant_name, r.slug
      FROM restaurant_credentials rc
      JOIN restaurants r ON rc.restaurant_id = r.id
      WHERE rc.username = ? AND rc.password_hash = ?
    `).get(username, passwordHash);
    
    if (cred) {
      return {
        success: true,
        user: {
          id: cred.id,
          email: username,
          full_name: cred.username,
          role: 'restaurant_admin',
          restaurant_id: cred.restaurant_id
        },
        restaurant: {
          id: cred.restaurant_id,
          name: cred.restaurant_name,
          slug: cred.slug
        }
      };
    }
    
    // Try user table
    const user = this.db.prepare('SELECT * FROM users WHERE email = ? AND password_hash = ?').get(username, passwordHash);
    
    if (user) {
      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          restaurant_id: user.restaurant_id
        }
      };
    }
    
    return { success: false, error: 'Credenciais inválidas' };
  }

  createUser(data) {
    const id = this.generateId();
    const passwordHash = this.hashPassword(data.password);
    this.db.prepare(`
      INSERT INTO users (id, email, password_hash, full_name, role, restaurant_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.email, passwordHash, data.full_name, data.role || 'user', data.restaurant_id);
    return { id, email: data.email, full_name: data.full_name, role: data.role };
  }

  createRestaurantCredentials(data) {
    const passwordHash = this.hashPassword(data.password);
    return this._insert('restaurant_credentials', {
      restaurant_id: data.restaurant_id,
      username: data.username,
      password_hash: passwordHash
    });
  }

  // =============================================
  // BACKUPS
  // =============================================

  getLocalBackups() {
    return this._getAll('local_backups', null, 'created_at DESC');
  }

  createLocalBackup(data) {
    return this._insert('local_backups', data);
  }

  // =============================================
  // REPORTS / ANALYTICS
  // =============================================

  getOrdersForPeriod(restaurantId, startDate, endDate) {
    return this.db.prepare(`
      SELECT * FROM orders 
      WHERE restaurant_id = ? 
        AND created_at >= ? 
        AND created_at <= ?
      ORDER BY created_at DESC
    `).all(restaurantId, startDate, endDate);
  }

  getSalesReport(restaurantId, startDate, endDate) {
    return this.db.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN status = 'delivered' OR status = 'picked_up' THEN 1 ELSE 0 END) as completed_orders,
        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders
      FROM orders 
      WHERE restaurant_id = ? 
        AND created_at >= ? 
        AND created_at <= ?
    `).get(restaurantId, startDate, endDate);
  }

  getCounterOrdersForPeriod(restaurantId, startDate, endDate) {
    return this.db.prepare(`
      SELECT * FROM counter_orders 
      WHERE restaurant_id = ? 
        AND created_at >= ? 
        AND created_at <= ?
      ORDER BY created_at DESC
    `).all(restaurantId, startDate, endDate);
  }

  // =============================================
  // EVENT BUS (for realtime)
  // =============================================

  setEventBus(eventBus) {
    this.eventBus = eventBus;
  }

  // =============================================
  // CLOSE
  // =============================================

  close() {
    this.db.close();
  }
}

module.exports = LocalDatabase;

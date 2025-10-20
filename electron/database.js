const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const crypto = require('crypto');

class LocalDatabase {
  constructor() {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'menus-local.db');
    
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    
    this.initializeTables();
    this.seedDefaultData();
  }

  initializeTables() {
    // Restaurants
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS restaurants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        logo_url TEXT,
        is_open INTEGER DEFAULT 1,
        service_fee_enabled INTEGER DEFAULT 0,
        service_fee_percentage REAL DEFAULT 10,
        prep_time_minutes INTEGER DEFAULT 30,
        primary_color TEXT DEFAULT '#FF6B35',
        secondary_color TEXT DEFAULT '#1A1A1A',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        restaurant_id TEXT NOT NULL,
        display_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        image_url TEXT,
        category_id TEXT NOT NULL,
        available INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tables (
        id TEXT PRIMARY KEY,
        table_number INTEGER NOT NULL,
        restaurant_id TEXT NOT NULL,
        qr_code TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        table_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_cpf TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE
      );

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

      CREATE TABLE IF NOT EXISTS product_extras (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        name TEXT NOT NULL,
        price REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS order_item_extras (
        id TEXT PRIMARY KEY,
        order_item_id TEXT NOT NULL,
        product_extra_id TEXT,
        price_at_order REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
        FOREIGN KEY (product_extra_id) REFERENCES product_extras(id) ON DELETE SET NULL
      );

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

      CREATE TABLE IF NOT EXISTS stock_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        restaurant_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE
      );

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

      CREATE TABLE IF NOT EXISTS product_ingredients (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        stock_item_id TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
        FOREIGN KEY (stock_item_id) REFERENCES stock_items(id) ON DELETE CASCADE
      );

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

      CREATE INDEX IF NOT EXISTS idx_categories_restaurant ON categories(restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
      CREATE INDEX IF NOT EXISTS idx_tables_restaurant ON tables(restaurant_id);
      CREATE INDEX IF NOT EXISTS idx_orders_table ON orders(table_id);
      CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
      CREATE INDEX IF NOT EXISTS idx_bills_table ON bills(table_id);
      CREATE INDEX IF NOT EXISTS idx_cash_movements_session ON cash_movements(cash_session_id);
      CREATE INDEX IF NOT EXISTS idx_stock_items_restaurant ON stock_items(restaurant_id);
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
    }
  }

  generateId() {
    return crypto.randomUUID();
  }

  hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  // Restaurants
  getRestaurants() {
    return this.db.prepare('SELECT * FROM restaurants ORDER BY created_at DESC').all();
  }

  getRestaurantBySlug(slug) {
    return this.db.prepare('SELECT * FROM restaurants WHERE slug = ?').get(slug);
  }

  createRestaurant(data) {
    const id = this.generateId();
    this.db.prepare(`
      INSERT INTO restaurants (id, name, slug, logo_url, is_open, service_fee_enabled, 
        service_fee_percentage, prep_time_minutes, primary_color, secondary_color)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.name, data.slug, data.logo_url, data.is_open ? 1 : 0,
      data.service_fee_enabled ? 1 : 0, data.service_fee_percentage,
      data.prep_time_minutes, data.primary_color, data.secondary_color
    );
    return { id, ...data };
  }

  updateRestaurant(id, data) {
    const fields = [];
    const values = [];
    
    Object.keys(data).forEach(key => {
      if (key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(typeof data[key] === 'boolean' ? (data[key] ? 1 : 0) : data[key]);
      }
    });
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    this.db.prepare(`UPDATE restaurants SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return { id, ...data };
  }

  deleteRestaurant(id) {
    this.db.prepare('DELETE FROM restaurants WHERE id = ?').run(id);
    return { success: true };
  }

  // Categories
  getCategories(restaurantId) {
    return this.db.prepare('SELECT * FROM categories WHERE restaurant_id = ? ORDER BY display_order').all(restaurantId);
  }

  createCategory(data) {
    const id = this.generateId();
    this.db.prepare(`
      INSERT INTO categories (id, name, restaurant_id, display_order)
      VALUES (?, ?, ?, ?)
    `).run(id, data.name, data.restaurant_id, data.display_order || 0);
    return { id, ...data };
  }

  updateCategory(id, data) {
    const fields = Object.keys(data).filter(k => k !== 'id').map(k => `${k} = ?`);
    fields.push('updated_at = CURRENT_TIMESTAMP');
    const values = Object.keys(data).filter(k => k !== 'id').map(k => data[k]);
    values.push(id);
    
    this.db.prepare(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return { id, ...data };
  }

  deleteCategory(id) {
    this.db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    return { success: true };
  }

  // Products
  getProducts(categoryId) {
    return this.db.prepare('SELECT * FROM products WHERE category_id = ? ORDER BY name').all(categoryId);
  }

  getProductsByRestaurant(restaurantId) {
    return this.db.prepare(`
      SELECT p.* FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE c.restaurant_id = ?
      ORDER BY p.name
    `).all(restaurantId);
  }

  createProduct(data) {
    const id = this.generateId();
    this.db.prepare(`
      INSERT INTO products (id, name, description, price, image_url, category_id, available)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.name, data.description, data.price, data.image_url, data.category_id, data.available ? 1 : 0);
    return { id, ...data };
  }

  updateProduct(id, data) {
    const fields = [];
    const values = [];
    
    Object.keys(data).forEach(key => {
      if (key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(typeof data[key] === 'boolean' ? (data[key] ? 1 : 0) : data[key]);
      }
    });
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    this.db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return { id, ...data };
  }

  deleteProduct(id) {
    this.db.prepare('DELETE FROM products WHERE id = ?').run(id);
    return { success: true };
  }

  // Tables
  getTables(restaurantId) {
    return this.db.prepare('SELECT * FROM tables WHERE restaurant_id = ? ORDER BY table_number').all(restaurantId);
  }

  createTable(data) {
    const id = this.generateId();
    this.db.prepare(`
      INSERT INTO tables (id, table_number, restaurant_id, qr_code)
      VALUES (?, ?, ?, ?)
    `).run(id, data.table_number, data.restaurant_id, data.qr_code);
    return { id, ...data };
  }

  updateTable(id, data) {
    const fields = Object.keys(data).filter(k => k !== 'id').map(k => `${k} = ?`);
    const values = Object.keys(data).filter(k => k !== 'id').map(k => data[k]);
    values.push(id);
    
    this.db.prepare(`UPDATE tables SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return { id, ...data };
  }

  deleteTable(id) {
    this.db.prepare('DELETE FROM tables WHERE id = ?').run(id);
    return { success: true };
  }

  // Orders
  getOrders(restaurantId) {
    return this.db.prepare(`
      SELECT o.* FROM orders o
      JOIN tables t ON o.table_id = t.id
      WHERE t.restaurant_id = ?
      ORDER BY o.created_at DESC
    `).all(restaurantId);
  }

  getOrdersByTable(tableId) {
    return this.db.prepare('SELECT * FROM orders WHERE table_id = ? ORDER BY created_at DESC').all(tableId);
  }

  createOrder(data) {
    const id = this.generateId();
    this.db.prepare(`
      INSERT INTO orders (id, table_id, customer_name, customer_cpf, status, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.table_id, data.customer_name, data.customer_cpf, data.status || 'pending', data.notes);
    return { id, ...data };
  }

  updateOrder(id, data) {
    const fields = [];
    const values = [];
    
    Object.keys(data).forEach(key => {
      if (key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }
    });
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    this.db.prepare(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return { id, ...data };
  }

  deleteOrder(id) {
    this.db.prepare('DELETE FROM orders WHERE id = ?').run(id);
    return { success: true };
  }

  // Order Items
  getOrderItems(orderId) {
    return this.db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
  }

  createOrderItem(data) {
    const id = this.generateId();
    this.db.prepare(`
      INSERT INTO order_items (id, order_id, product_id, quantity, price_at_order, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, data.order_id, data.product_id, data.quantity, data.price_at_order, data.notes);
    return { id, ...data };
  }

  deleteOrderItem(id) {
    this.db.prepare('DELETE FROM order_items WHERE id = ?').run(id);
    return { success: true };
  }

  // Bills
  getBills(restaurantId) {
    return this.db.prepare(`
      SELECT b.* FROM bills b
      JOIN tables t ON b.table_id = t.id
      WHERE t.restaurant_id = ?
      ORDER BY b.created_at DESC
    `).all(restaurantId);
  }

  createBill(data) {
    const id = this.generateId();
    this.db.prepare(`
      INSERT INTO bills (id, table_id, subtotal, service_fee, total_amount, payment_method, 
        change_amount, status, paid_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.table_id, data.subtotal, data.service_fee, data.total_amount,
      data.payment_method, data.change_amount, data.status || 'active', data.paid_at
    );
    return { id, ...data };
  }

  updateBill(id, data) {
    const fields = Object.keys(data).filter(k => k !== 'id').map(k => `${k} = ?`);
    const values = Object.keys(data).filter(k => k !== 'id').map(k => data[k]);
    values.push(id);
    
    this.db.prepare(`UPDATE bills SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return { id, ...data };
  }

  // Cash Register Sessions
  getCashSessions(restaurantId) {
    return this.db.prepare('SELECT * FROM cash_register_sessions WHERE restaurant_id = ? ORDER BY opened_at DESC').all(restaurantId);
  }

  createCashSession(data) {
    const id = this.generateId();
    this.db.prepare(`
      INSERT INTO cash_register_sessions (id, restaurant_id, opening_balance, opened_by, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, data.restaurant_id, data.opening_balance || 0, data.opened_by, 'open');
    return { id, ...data };
  }

  updateCashSession(id, data) {
    const fields = [];
    const values = [];
    
    Object.keys(data).forEach(key => {
      if (key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }
    });
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    this.db.prepare(`UPDATE cash_register_sessions SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return { id, ...data };
  }

  // Cash Movements
  getCashMovements(sessionId) {
    return this.db.prepare('SELECT * FROM cash_movements WHERE cash_session_id = ? ORDER BY created_at DESC').all(sessionId);
  }

  createCashMovement(data) {
    const id = this.generateId();
    this.db.prepare(`
      INSERT INTO cash_movements (id, cash_session_id, restaurant_id, movement_type, amount,
        payment_method, category, description, created_by, bill_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.cash_session_id, data.restaurant_id, data.movement_type, data.amount,
      data.payment_method, data.category, data.description, data.created_by, data.bill_id
    );
    return { id, ...data };
  }

  // Stock Items
  getStockItems(restaurantId) {
    return this.db.prepare('SELECT * FROM stock_items WHERE restaurant_id = ? ORDER BY name').all(restaurantId);
  }

  createStockItem(data) {
    const id = this.generateId();
    this.db.prepare(`
      INSERT INTO stock_items (id, name, unit, current_quantity, minimum_quantity, 
        price_per_unit, category_id, restaurant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.name, data.unit, data.current_quantity || 0, data.minimum_quantity || 0,
      data.price_per_unit || 0, data.category_id, data.restaurant_id
    );
    return { id, ...data };
  }

  updateStockItem(id, data) {
    const fields = [];
    const values = [];
    
    Object.keys(data).forEach(key => {
      if (key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }
    });
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    this.db.prepare(`UPDATE stock_items SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return { id, ...data };
  }

  deleteStockItem(id) {
    this.db.prepare('DELETE FROM stock_items WHERE id = ?').run(id);
    return { success: true };
  }

  // Stock Categories
  getStockCategories(restaurantId) {
    return this.db.prepare('SELECT * FROM stock_categories WHERE restaurant_id = ? ORDER BY name').all(restaurantId);
  }

  createStockCategory(data) {
    const id = this.generateId();
    this.db.prepare(`
      INSERT INTO stock_categories (id, name, restaurant_id)
      VALUES (?, ?, ?)
    `).run(id, data.name, data.restaurant_id);
    return { id, ...data };
  }

  // Product Extras
  getProductExtras(productId) {
    return this.db.prepare('SELECT * FROM product_extras WHERE product_id = ? ORDER BY name').all(productId);
  }

  createProductExtra(data) {
    const id = this.generateId();
    this.db.prepare(`
      INSERT INTO product_extras (id, product_id, name, price)
      VALUES (?, ?, ?, ?)
    `).run(id, data.product_id, data.name, data.price || 0);
    return { id, ...data };
  }

  updateProductExtra(id, data) {
    const fields = Object.keys(data).filter(k => k !== 'id').map(k => `${k} = ?`);
    fields.push('updated_at = CURRENT_TIMESTAMP');
    const values = Object.keys(data).filter(k => k !== 'id').map(k => data[k]);
    values.push(id);
    
    this.db.prepare(`UPDATE product_extras SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return { id, ...data };
  }

  deleteProductExtra(id) {
    this.db.prepare('DELETE FROM product_extras WHERE id = ?').run(id);
    return { success: true };
  }

  // Auth
  login(username, password) {
    const passwordHash = this.hashPassword(password);
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

  close() {
    this.db.close();
  }
}

module.exports = LocalDatabase;

// Adapter layer to use either Supabase (online) or Electron SQLite (offline)

declare global {
  interface Window {
    electronDB?: any;
    isElectron?: boolean;
  }
}

export const isElectronApp = () => {
  return typeof window !== 'undefined' && window.isElectron === true;
};

// This will be used throughout the app to determine which database to use
export const db = {
  isElectron: isElectronApp(),
  
  // Wrapper methods that route to appropriate database
  async getRestaurants() {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.getRestaurants();
    }
    // Fallback to Supabase will be handled in components
    return null;
  },

  async getRestaurantBySlug(slug: string) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.getRestaurantBySlug(slug);
    }
    return null;
  },

  async createRestaurant(data: any) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.createRestaurant(data);
    }
    return null;
  },

  async updateRestaurant(id: string, data: any) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.updateRestaurant(id, data);
    }
    return null;
  },

  async deleteRestaurant(id: string) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.deleteRestaurant(id);
    }
    return null;
  },

  // Categories
  async getCategories(restaurantId: string) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.getCategories(restaurantId);
    }
    return null;
  },

  async createCategory(data: any) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.createCategory(data);
    }
    return null;
  },

  async updateCategory(id: string, data: any) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.updateCategory(id, data);
    }
    return null;
  },

  async deleteCategory(id: string) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.deleteCategory(id);
    }
    return null;
  },

  // Products
  async getProducts(categoryId: string) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.getProducts(categoryId);
    }
    return null;
  },

  async getProductsByRestaurant(restaurantId: string) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.getProductsByRestaurant(restaurantId);
    }
    return null;
  },

  async createProduct(data: any) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.createProduct(data);
    }
    return null;
  },

  async updateProduct(id: string, data: any) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.updateProduct(id, data);
    }
    return null;
  },

  async deleteProduct(id: string) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.deleteProduct(id);
    }
    return null;
  },

  // Tables
  async getTables(restaurantId: string) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.getTables(restaurantId);
    }
    return null;
  },

  async createTable(data: any) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.createTable(data);
    }
    return null;
  },

  async updateTable(id: string, data: any) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.updateTable(id, data);
    }
    return null;
  },

  async deleteTable(id: string) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.deleteTable(id);
    }
    return null;
  },

  // Orders
  async getOrders(restaurantId: string) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.getOrders(restaurantId);
    }
    return null;
  },

  async getOrdersByTable(tableId: string) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.getOrdersByTable(tableId);
    }
    return null;
  },

  async createOrder(data: any) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.createOrder(data);
    }
    return null;
  },

  async updateOrder(id: string, data: any) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.updateOrder(id, data);
    }
    return null;
  },

  async deleteOrder(id: string) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.deleteOrder(id);
    }
    return null;
  },

  // Order Items
  async getOrderItems(orderId: string) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.getOrderItems(orderId);
    }
    return null;
  },

  async createOrderItem(data: any) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.createOrderItem(data);
    }
    return null;
  },

  async deleteOrderItem(id: string) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.deleteOrderItem(id);
    }
    return null;
  },

  // Bills
  async getBills(restaurantId: string) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.getBills(restaurantId);
    }
    return null;
  },

  async createBill(data: any) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.createBill(data);
    }
    return null;
  },

  async updateBill(id: string, data: any) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.updateBill(id, data);
    }
    return null;
  },

  // Cash Register
  async getCashSessions(restaurantId: string) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.getCashSessions(restaurantId);
    }
    return null;
  },

  async createCashSession(data: any) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.createCashSession(data);
    }
    return null;
  },

  async updateCashSession(id: string, data: any) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.updateCashSession(id, data);
    }
    return null;
  },

  async getCashMovements(sessionId: string) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.getCashMovements(sessionId);
    }
    return null;
  },

  async createCashMovement(data: any) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.createCashMovement(data);
    }
    return null;
  },

  // Stock
  async getStockItems(restaurantId: string) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.getStockItems(restaurantId);
    }
    return null;
  },

  async createStockItem(data: any) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.createStockItem(data);
    }
    return null;
  },

  async updateStockItem(id: string, data: any) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.updateStockItem(id, data);
    }
    return null;
  },

  async deleteStockItem(id: string) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.deleteStockItem(id);
    }
    return null;
  },

  async getStockCategories(restaurantId: string) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.getStockCategories(restaurantId);
    }
    return null;
  },

  async createStockCategory(data: any) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.createStockCategory(data);
    }
    return null;
  },

  // Product Extras
  async getProductExtras(productId: string) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.getProductExtras(productId);
    }
    return null;
  },

  async createProductExtra(data: any) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.createProductExtra(data);
    }
    return null;
  },

  async updateProductExtra(id: string, data: any) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.updateProductExtra(id, data);
    }
    return null;
  },

  async deleteProductExtra(id: string) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.deleteProductExtra(id);
    }
    return null;
  },

  // Auth
  async login(username: string, password: string) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.login(username, password);
    }
    return null;
  },

  async createUser(data: any) {
    if (this.isElectron && window.electronDB) {
      return await window.electronDB.createUser(data);
    }
    return null;
  },
};

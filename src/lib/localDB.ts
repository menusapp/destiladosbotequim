// Adapter layer for Electron SQLite (offline) or Supabase (online)
// This provides a unified interface regardless of environment

declare global {
  interface Window {
    electronDB?: any;
    electronBackup?: any;
    electronImages?: any;
    electronFiles?: any;
    electronEvents?: any;
    electronPlatform?: {
      platform: string;
      arch: string;
      version: string;
      isWindows: boolean;
      isMac: boolean;
      isLinux: boolean;
    };
    isElectron?: boolean;
  }
}

export const isElectronApp = (): boolean => {
  return typeof window !== 'undefined' && window.isElectron === true;
};

export const getPlatformInfo = () => {
  if (isElectronApp() && window.electronPlatform) {
    return window.electronPlatform;
  }
  return null;
};

// =============================================
// DATABASE ADAPTER
// =============================================

export const db = {
  isElectron: isElectronApp(),

  // =============================================
  // RESTAURANTS
  // =============================================
  async getRestaurants() {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getRestaurants();
    }
    return null;
  },

  async getRestaurantById(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getRestaurantById(id);
    }
    return null;
  },

  async getRestaurantBySlug(slug: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getRestaurantBySlug(slug);
    }
    return null;
  },

  async createRestaurant(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createRestaurant(data);
    }
    return null;
  },

  async updateRestaurant(id: string, data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.updateRestaurant(id, data);
    }
    return null;
  },

  async deleteRestaurant(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.deleteRestaurant(id);
    }
    return null;
  },

  // =============================================
  // CATEGORIES
  // =============================================
  async getCategories(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getCategories(restaurantId);
    }
    return null;
  },

  async createCategory(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createCategory(data);
    }
    return null;
  },

  async updateCategory(id: string, data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.updateCategory(id, data);
    }
    return null;
  },

  async deleteCategory(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.deleteCategory(id);
    }
    return null;
  },

  // =============================================
  // PRODUCTS
  // =============================================
  async getProducts(categoryId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getProducts(categoryId);
    }
    return null;
  },

  async getProductsByRestaurant(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getProductsByRestaurant(restaurantId);
    }
    return null;
  },

  async getFeaturedProducts(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getFeaturedProducts(restaurantId);
    }
    return null;
  },

  async createProduct(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createProduct(data);
    }
    return null;
  },

  async updateProduct(id: string, data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.updateProduct(id, data);
    }
    return null;
  },

  async deleteProduct(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.deleteProduct(id);
    }
    return null;
  },

  // =============================================
  // TABLES
  // =============================================
  async getTables(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getTables(restaurantId);
    }
    return null;
  },

  async getTableById(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getTableById(id);
    }
    return null;
  },

  async createTable(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createTable(data);
    }
    return null;
  },

  async updateTable(id: string, data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.updateTable(id, data);
    }
    return null;
  },

  async deleteTable(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.deleteTable(id);
    }
    return null;
  },

  // =============================================
  // COMANDAS
  // =============================================
  async getComandas(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getComandas(restaurantId);
    }
    return null;
  },

  async getComandasByTable(tableId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getComandasByTable(tableId);
    }
    return null;
  },

  async getActiveComandaByTable(tableId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getActiveComandaByTable(tableId);
    }
    return null;
  },

  async createComanda(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createComanda(data);
    }
    return null;
  },

  async updateComanda(id: string, data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.updateComanda(id, data);
    }
    return null;
  },

  async closeComanda(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.closeComanda(id);
    }
    return null;
  },

  // =============================================
  // ORDERS
  // =============================================
  async getOrders(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getOrders(restaurantId);
    }
    return null;
  },

  async getOrdersByTable(tableId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getOrdersByTable(tableId);
    }
    return null;
  },

  async getOrdersByComanda(comandaId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getOrdersByComanda(comandaId);
    }
    return null;
  },

  async getOrdersByStatus(restaurantId: string, status: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getOrdersByStatus(restaurantId, status);
    }
    return null;
  },

  async getOrdersByType(restaurantId: string, orderType: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getOrdersByType(restaurantId, orderType);
    }
    return null;
  },

  async createOrder(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createOrder(data);
    }
    return null;
  },

  async updateOrder(id: string, data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.updateOrder(id, data);
    }
    return null;
  },

  async deleteOrder(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.deleteOrder(id);
    }
    return null;
  },

  // =============================================
  // ORDER ITEMS
  // =============================================
  async getOrderItems(orderId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getOrderItems(orderId);
    }
    return null;
  },

  async createOrderItem(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createOrderItem(data);
    }
    return null;
  },

  async deleteOrderItem(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.deleteOrderItem(id);
    }
    return null;
  },

  async getOrderItemExtras(orderItemId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getOrderItemExtras(orderItemId);
    }
    return null;
  },

  async createOrderItemExtra(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createOrderItemExtra(data);
    }
    return null;
  },

  // =============================================
  // COUNTER ORDERS (PDV)
  // =============================================
  async getCounterOrders(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getCounterOrders(restaurantId);
    }
    return null;
  },

  async createCounterOrder(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createCounterOrder(data);
    }
    return null;
  },

  async updateCounterOrder(id: string, data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.updateCounterOrder(id, data);
    }
    return null;
  },

  async getCounterOrderItems(counterOrderId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getCounterOrderItems(counterOrderId);
    }
    return null;
  },

  async createCounterOrderItem(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createCounterOrderItem(data);
    }
    return null;
  },

  async createCounterOrderItemExtra(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createCounterOrderItemExtra(data);
    }
    return null;
  },

  // =============================================
  // BILLS
  // =============================================
  async getBills(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getBills(restaurantId);
    }
    return null;
  },

  async getBillsByTable(tableId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getBillsByTable(tableId);
    }
    return null;
  },

  async getActiveBillByTable(tableId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getActiveBillByTable(tableId);
    }
    return null;
  },

  async createBill(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createBill(data);
    }
    return null;
  },

  async updateBill(id: string, data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.updateBill(id, data);
    }
    return null;
  },

  async deleteBill(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.deleteBill(id);
    }
    return null;
  },

  // =============================================
  // CASH REGISTER
  // =============================================
  async getCashSessions(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getCashSessions(restaurantId);
    }
    return null;
  },

  async getOpenCashSession(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getOpenCashSession(restaurantId);
    }
    return null;
  },

  async createCashSession(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createCashSession(data);
    }
    return null;
  },

  async updateCashSession(id: string, data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.updateCashSession(id, data);
    }
    return null;
  },

  async closeCashSession(id: string, data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.closeCashSession(id, data);
    }
    return null;
  },

  async getCashMovements(sessionId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getCashMovements(sessionId);
    }
    return null;
  },

  async getCashMovementsByRestaurant(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getCashMovementsByRestaurant(restaurantId);
    }
    return null;
  },

  async createCashMovement(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createCashMovement(data);
    }
    return null;
  },

  // =============================================
  // STOCK
  // =============================================
  async getStockItems(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getStockItems(restaurantId);
    }
    return null;
  },

  async createStockItem(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createStockItem(data);
    }
    return null;
  },

  async updateStockItem(id: string, data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.updateStockItem(id, data);
    }
    return null;
  },

  async deleteStockItem(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.deleteStockItem(id);
    }
    return null;
  },

  async getStockCategories(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getStockCategories(restaurantId);
    }
    return null;
  },

  async createStockCategory(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createStockCategory(data);
    }
    return null;
  },

  async updateStockCategory(id: string, data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.updateStockCategory(id, data);
    }
    return null;
  },

  async deleteStockCategory(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.deleteStockCategory(id);
    }
    return null;
  },

  async getStockMovements(stockItemId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getStockMovements(stockItemId);
    }
    return null;
  },

  async getAllStockMovements(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getAllStockMovements(restaurantId);
    }
    return null;
  },

  async createStockMovement(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createStockMovement(data);
    }
    return null;
  },

  // =============================================
  // PRODUCT INGREDIENTS
  // =============================================
  async getProductIngredients(productId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getProductIngredients(productId);
    }
    return null;
  },

  async createProductIngredient(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createProductIngredient(data);
    }
    return null;
  },

  async deleteProductIngredient(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.deleteProductIngredient(id);
    }
    return null;
  },

  async deleteProductIngredientsByProduct(productId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.deleteProductIngredientsByProduct(productId);
    }
    return null;
  },

  // =============================================
  // PRODUCT EXTRAS
  // =============================================
  async getProductExtras(productId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getProductExtras(productId);
    }
    return null;
  },

  async createProductExtra(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createProductExtra(data);
    }
    return null;
  },

  async updateProductExtra(id: string, data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.updateProductExtra(id, data);
    }
    return null;
  },

  async deleteProductExtra(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.deleteProductExtra(id);
    }
    return null;
  },

  async deleteProductExtrasByProduct(productId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.deleteProductExtrasByProduct(productId);
    }
    return null;
  },

  async getProductExtraIngredients(productExtraId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getProductExtraIngredients(productExtraId);
    }
    return null;
  },

  async createProductExtraIngredient(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createProductExtraIngredient(data);
    }
    return null;
  },

  // =============================================
  // EXTRA CATEGORIES (COMPLEMENTS)
  // =============================================
  async getExtraCategories(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getExtraCategories(restaurantId);
    }
    return null;
  },

  async createExtraCategory(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createExtraCategory(data);
    }
    return null;
  },

  async updateExtraCategory(id: string, data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.updateExtraCategory(id, data);
    }
    return null;
  },

  async deleteExtraCategory(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.deleteExtraCategory(id);
    }
    return null;
  },

  async getExtraCategoryItems(categoryId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getExtraCategoryItems(categoryId);
    }
    return null;
  },

  async createExtraCategoryItem(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createExtraCategoryItem(data);
    }
    return null;
  },

  async updateExtraCategoryItem(id: string, data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.updateExtraCategoryItem(id, data);
    }
    return null;
  },

  async deleteExtraCategoryItem(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.deleteExtraCategoryItem(id);
    }
    return null;
  },

  // =============================================
  // PRODUCT COMPLEMENT GROUPS
  // =============================================
  async getProductComplementGroups(productId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getProductComplementGroups(productId);
    }
    return null;
  },

  async createProductComplementGroup(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createProductComplementGroup(data);
    }
    return null;
  },

  async updateProductComplementGroup(id: string, data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.updateProductComplementGroup(id, data);
    }
    return null;
  },

  async deleteProductComplementGroup(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.deleteProductComplementGroup(id);
    }
    return null;
  },

  async deleteProductComplementGroupsByProduct(productId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.deleteProductComplementGroupsByProduct(productId);
    }
    return null;
  },

  // =============================================
  // CUSTOMERS
  // =============================================
  async getCustomers(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getCustomers(restaurantId);
    }
    return null;
  },

  async getCustomerByCpf(restaurantId: string, cpf: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getCustomerByCpf(restaurantId, cpf);
    }
    return null;
  },

  async getCustomerByPhone(restaurantId: string, phone: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getCustomerByPhone(restaurantId, phone);
    }
    return null;
  },

  async createCustomer(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createCustomer(data);
    }
    return null;
  },

  async updateCustomer(id: string, data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.updateCustomer(id, data);
    }
    return null;
  },

  async deleteCustomer(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.deleteCustomer(id);
    }
    return null;
  },

  async getCustomerAddresses(customerCpf: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getCustomerAddresses(customerCpf);
    }
    return null;
  },

  async createCustomerAddress(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createCustomerAddress(data);
    }
    return null;
  },

  async updateCustomerAddress(id: string, data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.updateCustomerAddress(id, data);
    }
    return null;
  },

  async deleteCustomerAddress(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.deleteCustomerAddress(id);
    }
    return null;
  },

  // =============================================
  // LOYALTY
  // =============================================
  async getLoyaltyPoints(restaurantId: string, customerCpf: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getLoyaltyPoints(restaurantId, customerCpf);
    }
    return null;
  },

  async createOrUpdateLoyaltyPoints(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createOrUpdateLoyaltyPoints(data);
    }
    return null;
  },

  async getLoyaltyTransactions(restaurantId: string, customerCpf: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getLoyaltyTransactions(restaurantId, customerCpf);
    }
    return null;
  },

  async createLoyaltyTransaction(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createLoyaltyTransaction(data);
    }
    return null;
  },

  // =============================================
  // COUPONS
  // =============================================
  async getCoupons(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getCoupons(restaurantId);
    }
    return null;
  },

  async getCouponByCode(restaurantId: string, code: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getCouponByCode(restaurantId, code);
    }
    return null;
  },

  async createCoupon(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createCoupon(data);
    }
    return null;
  },

  async updateCoupon(id: string, data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.updateCoupon(id, data);
    }
    return null;
  },

  async deleteCoupon(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.deleteCoupon(id);
    }
    return null;
  },

  async incrementCouponUsage(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.incrementCouponUsage(id);
    }
    return null;
  },

  // =============================================
  // DELIVERY
  // =============================================
  async getDeliveryConfig(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getDeliveryConfig(restaurantId);
    }
    return null;
  },

  async createOrUpdateDeliveryConfig(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createOrUpdateDeliveryConfig(data);
    }
    return null;
  },

  async getDeliveryZones(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getDeliveryZones(restaurantId);
    }
    return null;
  },

  async getDeliveryZoneByZip(restaurantId: string, zipCode: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getDeliveryZoneByZip(restaurantId, zipCode);
    }
    return null;
  },

  async createDeliveryZone(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createDeliveryZone(data);
    }
    return null;
  },

  async updateDeliveryZone(id: string, data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.updateDeliveryZone(id, data);
    }
    return null;
  },

  async deleteDeliveryZone(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.deleteDeliveryZone(id);
    }
    return null;
  },

  // =============================================
  // BUSINESS HOURS
  // =============================================
  async getBusinessHours(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getBusinessHours(restaurantId);
    }
    return null;
  },

  async createOrUpdateBusinessHours(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createOrUpdateBusinessHours(data);
    }
    return null;
  },

  // =============================================
  // PAYMENT METHODS
  // =============================================
  async getPaymentMethods(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getPaymentMethods(restaurantId);
    }
    return null;
  },

  async getActivePaymentMethods(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getActivePaymentMethods(restaurantId);
    }
    return null;
  },

  async createPaymentMethod(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createPaymentMethod(data);
    }
    return null;
  },

  async updatePaymentMethod(id: string, data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.updatePaymentMethod(id, data);
    }
    return null;
  },

  async deletePaymentMethod(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.deletePaymentMethod(id);
    }
    return null;
  },

  async getCardFeesConfig(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getCardFeesConfig(restaurantId);
    }
    return null;
  },

  async createOrUpdateCardFeesConfig(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createOrUpdateCardFeesConfig(data);
    }
    return null;
  },

  // =============================================
  // COSTS
  // =============================================
  async getFixedCosts(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getFixedCosts(restaurantId);
    }
    return null;
  },

  async createFixedCost(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createFixedCost(data);
    }
    return null;
  },

  async updateFixedCost(id: string, data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.updateFixedCost(id, data);
    }
    return null;
  },

  async deleteFixedCost(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.deleteFixedCost(id);
    }
    return null;
  },

  async getVariableCosts(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getVariableCosts(restaurantId);
    }
    return null;
  },

  async createVariableCost(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createVariableCost(data);
    }
    return null;
  },

  async updateVariableCost(id: string, data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.updateVariableCost(id, data);
    }
    return null;
  },

  async deleteVariableCost(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.deleteVariableCost(id);
    }
    return null;
  },

  async getLaborCosts(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getLaborCosts(restaurantId);
    }
    return null;
  },

  async createLaborCost(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createLaborCost(data);
    }
    return null;
  },

  async updateLaborCost(id: string, data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.updateLaborCost(id, data);
    }
    return null;
  },

  async deleteLaborCost(id: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.deleteLaborCost(id);
    }
    return null;
  },

  async getOperationalCosts(restaurantId: string, monthYear: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getOperationalCosts(restaurantId, monthYear);
    }
    return null;
  },

  async createOrUpdateOperationalCosts(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createOrUpdateOperationalCosts(data);
    }
    return null;
  },

  // =============================================
  // REVIEWS
  // =============================================
  async getReviews(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getReviews(restaurantId);
    }
    return null;
  },

  async createReview(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createReview(data);
    }
    return null;
  },

  // =============================================
  // WHATSAPP CONFIG
  // =============================================
  async getWhatsAppConfig(restaurantId: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getWhatsAppConfig(restaurantId);
    }
    return null;
  },

  async createOrUpdateWhatsAppConfig(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createOrUpdateWhatsAppConfig(data);
    }
    return null;
  },

  // =============================================
  // AUTH
  // =============================================
  async login(username: string, password: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.login(username, password);
    }
    return null;
  },

  async createUser(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createUser(data);
    }
    return null;
  },

  async createRestaurantCredentials(data: any) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.createRestaurantCredentials(data);
    }
    return null;
  },

  // =============================================
  // REPORTS
  // =============================================
  async getOrdersForPeriod(restaurantId: string, startDate: string, endDate: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getOrdersForPeriod(restaurantId, startDate, endDate);
    }
    return null;
  },

  async getSalesReport(restaurantId: string, startDate: string, endDate: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getSalesReport(restaurantId, startDate, endDate);
    }
    return null;
  },

  async getCounterOrdersForPeriod(restaurantId: string, startDate: string, endDate: string) {
    if (isElectronApp() && window.electronDB) {
      return await window.electronDB.getCounterOrdersForPeriod(restaurantId, startDate, endDate);
    }
    return null;
  },
};

// =============================================
// BACKUP ADAPTER
// =============================================

export const backup = {
  async create(type: 'daily' | 'monthly' = 'daily') {
    if (isElectronApp() && window.electronBackup) {
      return await window.electronBackup.create(type);
    }
    return null;
  },

  async restore(filePath: string) {
    if (isElectronApp() && window.electronBackup) {
      return await window.electronBackup.restore(filePath);
    }
    return null;
  },

  async list(type: 'daily' | 'monthly' = 'daily') {
    if (isElectronApp() && window.electronBackup) {
      return await window.electronBackup.list(type);
    }
    return null;
  },

  async stats() {
    if (isElectronApp() && window.electronBackup) {
      return await window.electronBackup.stats();
    }
    return null;
  },

  async export() {
    if (isElectronApp() && window.electronBackup) {
      return await window.electronBackup.export();
    }
    return null;
  },

  async import() {
    if (isElectronApp() && window.electronBackup) {
      return await window.electronBackup.import();
    }
    return null;
  },
};

// =============================================
// IMAGE STORAGE ADAPTER
// =============================================

export const images = {
  async saveFromBase64(type: 'product' | 'logo' | 'banner', fileName: string, base64Data: string) {
    if (isElectronApp() && window.electronImages) {
      return await window.electronImages.saveFromBase64(type, fileName, base64Data);
    }
    return null;
  },

  async saveFromUrl(type: 'product' | 'logo' | 'banner', fileName: string, url: string) {
    if (isElectronApp() && window.electronImages) {
      return await window.electronImages.saveFromUrl(type, fileName, url);
    }
    return null;
  },

  async delete(filePath: string) {
    if (isElectronApp() && window.electronImages) {
      return await window.electronImages.delete(filePath);
    }
    return null;
  },

  async list(type: 'product' | 'logo' | 'banner') {
    if (isElectronApp() && window.electronImages) {
      return await window.electronImages.list(type);
    }
    return null;
  },

  async stats() {
    if (isElectronApp() && window.electronImages) {
      return await window.electronImages.stats();
    }
    return null;
  },

  async selectFile() {
    if (isElectronApp() && window.electronImages) {
      return await window.electronImages.selectFile();
    }
    return null;
  },
};

// =============================================
// FILE MANAGER ADAPTER
// =============================================

export const files = {
  async getConfig() {
    if (isElectronApp() && window.electronFiles) {
      return await window.electronFiles.getConfig();
    }
    return null;
  },

  async updateConfig(updates: any) {
    if (isElectronApp() && window.electronFiles) {
      return await window.electronFiles.updateConfig(updates);
    }
    return null;
  },

  async setCloudConfig(url: string, key: string) {
    if (isElectronApp() && window.electronFiles) {
      return await window.electronFiles.setCloudConfig(url, key);
    }
    return null;
  },

  async disableCloudSync() {
    if (isElectronApp() && window.electronFiles) {
      return await window.electronFiles.disableCloudSync();
    }
    return null;
  },

  async getStorageInfo() {
    if (isElectronApp() && window.electronFiles) {
      return await window.electronFiles.getStorageInfo();
    }
    return null;
  },

  async openDataFolder() {
    if (isElectronApp() && window.electronFiles) {
      return await window.electronFiles.openDataFolder();
    }
    return null;
  },
};

// =============================================
// EVENTS ADAPTER (for realtime)
// =============================================

export const events = {
  on(channel: string, callback: (payload: any) => void) {
    if (isElectronApp() && window.electronEvents) {
      return window.electronEvents.on(channel, callback);
    }
    return () => {}; // Return no-op unsubscribe function
  },

  off(id: number) {
    if (isElectronApp() && window.electronEvents) {
      window.electronEvents.off(id);
    }
  },

  removeAllListeners() {
    if (isElectronApp() && window.electronEvents) {
      window.electronEvents.removeAllListeners();
    }
  },
};

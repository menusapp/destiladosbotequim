/// <reference types="vite/client" />

interface PrinterInfo {
  name: string;
  displayName: string;
  description: string;
  status: number;
  isDefault: boolean;
}

interface PrinterConfig {
  restaurant_id: string;
  comanda_printer: string;
  comanda_paper_size: string;
  comanda_auto_print: number;
  cupom_printer: string;
  cupom_paper_size: string;
  cupom_auto_print: number;
}

interface ElectronPrinter {
  getList: () => Promise<PrinterInfo[]>;
  print: (printerName: string, content: any, options?: any) => Promise<{ success: boolean; error?: string }>;
  test: (printerName: string, paperSize?: string) => Promise<{ success: boolean; error?: string }>;
}

interface ElectronDB {
  // Restaurants
  getRestaurants: () => Promise<any[]>;
  getRestaurantById: (id: string) => Promise<any>;
  getRestaurantBySlug: (slug: string) => Promise<any>;
  createRestaurant: (data: any) => Promise<any>;
  updateRestaurant: (id: string, data: any) => Promise<any>;
  deleteRestaurant: (id: string) => Promise<any>;
  
  // Categories
  getCategories: (restaurantId: string) => Promise<any[]>;
  createCategory: (data: any) => Promise<any>;
  updateCategory: (id: string, data: any) => Promise<any>;
  deleteCategory: (id: string) => Promise<any>;
  
  // Products
  getProducts: (categoryId: string) => Promise<any[]>;
  getProductsByRestaurant: (restaurantId: string) => Promise<any[]>;
  getFeaturedProducts: (restaurantId: string) => Promise<any[]>;
  createProduct: (data: any) => Promise<any>;
  updateProduct: (id: string, data: any) => Promise<any>;
  deleteProduct: (id: string) => Promise<any>;
  
  // Tables
  getTables: (restaurantId: string) => Promise<any[]>;
  getTableById: (id: string) => Promise<any>;
  createTable: (data: any) => Promise<any>;
  updateTable: (id: string, data: any) => Promise<any>;
  deleteTable: (id: string) => Promise<any>;
  
  // Comandas
  getComandas: (restaurantId: string) => Promise<any[]>;
  getComandasByTable: (tableId: string) => Promise<any[]>;
  getActiveComandaByTable: (tableId: string) => Promise<any>;
  createComanda: (data: any) => Promise<any>;
  updateComanda: (id: string, data: any) => Promise<any>;
  closeComanda: (id: string) => Promise<any>;
  
  // Orders
  getOrders: (restaurantId: string) => Promise<any[]>;
  getOrdersByTable: (tableId: string) => Promise<any[]>;
  getOrdersByComanda: (comandaId: string) => Promise<any[]>;
  getOrdersByStatus: (restaurantId: string, status: string) => Promise<any[]>;
  getOrdersByType: (restaurantId: string, orderType: string) => Promise<any[]>;
  createOrder: (data: any) => Promise<any>;
  updateOrder: (id: string, data: any) => Promise<any>;
  deleteOrder: (id: string) => Promise<any>;
  
  // Order Items
  getOrderItems: (orderId: string) => Promise<any[]>;
  createOrderItem: (data: any) => Promise<any>;
  deleteOrderItem: (id: string) => Promise<any>;
  getOrderItemExtras: (orderItemId: string) => Promise<any[]>;
  createOrderItemExtra: (data: any) => Promise<any>;
  
  // Counter Orders (PDV)
  getCounterOrders: (restaurantId: string) => Promise<any[]>;
  createCounterOrder: (data: any) => Promise<any>;
  updateCounterOrder: (id: string, data: any) => Promise<any>;
  getCounterOrderItems: (counterOrderId: string) => Promise<any[]>;
  createCounterOrderItem: (data: any) => Promise<any>;
  createCounterOrderItemExtra: (data: any) => Promise<any>;
  
  // Bills
  getBills: (restaurantId: string) => Promise<any[]>;
  getBillsByTable: (tableId: string) => Promise<any[]>;
  getActiveBillByTable: (tableId: string) => Promise<any>;
  createBill: (data: any) => Promise<any>;
  updateBill: (id: string, data: any) => Promise<any>;
  deleteBill: (id: string) => Promise<any>;
  
  // Cash Register
  getCashSessions: (restaurantId: string) => Promise<any[]>;
  getOpenCashSession: (restaurantId: string) => Promise<any>;
  createCashSession: (data: any) => Promise<any>;
  updateCashSession: (id: string, data: any) => Promise<any>;
  closeCashSession: (id: string, data: any) => Promise<any>;
  getCashMovements: (sessionId: string) => Promise<any[]>;
  getCashMovementsByRestaurant: (restaurantId: string) => Promise<any[]>;
  createCashMovement: (data: any) => Promise<any>;
  
  // Stock
  getStockItems: (restaurantId: string) => Promise<any[]>;
  createStockItem: (data: any) => Promise<any>;
  updateStockItem: (id: string, data: any) => Promise<any>;
  deleteStockItem: (id: string) => Promise<any>;
  getStockCategories: (restaurantId: string) => Promise<any[]>;
  createStockCategory: (data: any) => Promise<any>;
  updateStockCategory: (id: string, data: any) => Promise<any>;
  deleteStockCategory: (id: string) => Promise<any>;
  getStockMovements: (stockItemId: string) => Promise<any[]>;
  getAllStockMovements: (restaurantId: string) => Promise<any[]>;
  createStockMovement: (data: any) => Promise<any>;
  
  // Product Ingredients
  getProductIngredients: (productId: string) => Promise<any[]>;
  createProductIngredient: (data: any) => Promise<any>;
  deleteProductIngredient: (id: string) => Promise<any>;
  deleteProductIngredientsByProduct: (productId: string) => Promise<any>;
  
  // Product Extras
  getProductExtras: (productId: string) => Promise<any[]>;
  createProductExtra: (data: any) => Promise<any>;
  updateProductExtra: (id: string, data: any) => Promise<any>;
  deleteProductExtra: (id: string) => Promise<any>;
  deleteProductExtrasByProduct: (productId: string) => Promise<any>;
  getProductExtraIngredients: (productExtraId: string) => Promise<any[]>;
  createProductExtraIngredient: (data: any) => Promise<any>;
  
  // Extra Categories
  getExtraCategories: (restaurantId: string) => Promise<any[]>;
  createExtraCategory: (data: any) => Promise<any>;
  updateExtraCategory: (id: string, data: any) => Promise<any>;
  deleteExtraCategory: (id: string) => Promise<any>;
  getExtraCategoryItems: (categoryId: string) => Promise<any[]>;
  createExtraCategoryItem: (data: any) => Promise<any>;
  updateExtraCategoryItem: (id: string, data: any) => Promise<any>;
  deleteExtraCategoryItem: (id: string) => Promise<any>;
  
  // Product Complement Groups
  getProductComplementGroups: (productId: string) => Promise<any[]>;
  createProductComplementGroup: (data: any) => Promise<any>;
  updateProductComplementGroup: (id: string, data: any) => Promise<any>;
  deleteProductComplementGroup: (id: string) => Promise<any>;
  deleteProductComplementGroupsByProduct: (productId: string) => Promise<any>;
  
  // Customers
  getCustomers: (restaurantId: string) => Promise<any[]>;
  getCustomerByCpf: (restaurantId: string, cpf: string) => Promise<any>;
  getCustomerByPhone: (restaurantId: string, phone: string) => Promise<any>;
  createCustomer: (data: any) => Promise<any>;
  updateCustomer: (id: string, data: any) => Promise<any>;
  deleteCustomer: (id: string) => Promise<any>;
  getCustomerAddresses: (customerCpf: string) => Promise<any[]>;
  createCustomerAddress: (data: any) => Promise<any>;
  updateCustomerAddress: (id: string, data: any) => Promise<any>;
  deleteCustomerAddress: (id: string) => Promise<any>;
  
  // Loyalty
  getLoyaltyPoints: (restaurantId: string, customerCpf: string) => Promise<any>;
  createOrUpdateLoyaltyPoints: (data: any) => Promise<any>;
  getLoyaltyTransactions: (restaurantId: string, customerCpf: string) => Promise<any[]>;
  createLoyaltyTransaction: (data: any) => Promise<any>;
  
  // Coupons
  getCoupons: (restaurantId: string) => Promise<any[]>;
  getCouponByCode: (restaurantId: string, code: string) => Promise<any>;
  createCoupon: (data: any) => Promise<any>;
  updateCoupon: (id: string, data: any) => Promise<any>;
  deleteCoupon: (id: string) => Promise<any>;
  incrementCouponUsage: (id: string) => Promise<any>;
  
  // Delivery
  getDeliveryConfig: (restaurantId: string) => Promise<any>;
  createOrUpdateDeliveryConfig: (data: any) => Promise<any>;
  getDeliveryZones: (restaurantId: string) => Promise<any[]>;
  getDeliveryZoneByZip: (restaurantId: string, zipCode: string) => Promise<any>;
  createDeliveryZone: (data: any) => Promise<any>;
  updateDeliveryZone: (id: string, data: any) => Promise<any>;
  deleteDeliveryZone: (id: string) => Promise<any>;
  
  // Business Hours
  getBusinessHours: (restaurantId: string) => Promise<any[]>;
  createOrUpdateBusinessHours: (data: any) => Promise<any>;
  
  // Payment Methods
  getPaymentMethods: (restaurantId: string) => Promise<any[]>;
  getActivePaymentMethods: (restaurantId: string) => Promise<any[]>;
  createPaymentMethod: (data: any) => Promise<any>;
  updatePaymentMethod: (id: string, data: any) => Promise<any>;
  deletePaymentMethod: (id: string) => Promise<any>;
  getCardFeesConfig: (restaurantId: string) => Promise<any>;
  createOrUpdateCardFeesConfig: (data: any) => Promise<any>;
  
  // Costs
  getFixedCosts: (restaurantId: string) => Promise<any[]>;
  createFixedCost: (data: any) => Promise<any>;
  updateFixedCost: (id: string, data: any) => Promise<any>;
  deleteFixedCost: (id: string) => Promise<any>;
  getVariableCosts: (restaurantId: string) => Promise<any[]>;
  createVariableCost: (data: any) => Promise<any>;
  updateVariableCost: (id: string, data: any) => Promise<any>;
  deleteVariableCost: (id: string) => Promise<any>;
  getLaborCosts: (restaurantId: string) => Promise<any[]>;
  createLaborCost: (data: any) => Promise<any>;
  updateLaborCost: (id: string, data: any) => Promise<any>;
  deleteLaborCost: (id: string) => Promise<any>;
  getOperationalCosts: (restaurantId: string, monthYear: string) => Promise<any>;
  createOrUpdateOperationalCosts: (data: any) => Promise<any>;
  
  // Reviews
  getReviews: (restaurantId: string) => Promise<any[]>;
  createReview: (data: any) => Promise<any>;
  
  // WhatsApp Config
  getWhatsAppConfig: (restaurantId: string) => Promise<any>;
  createOrUpdateWhatsAppConfig: (data: any) => Promise<any>;
  
  // Auth
  login: (username: string, password: string) => Promise<any>;
  createUser: (data: any) => Promise<any>;
  createRestaurantCredentials: (data: any) => Promise<any>;
  
  // Reports
  getOrdersForPeriod: (restaurantId: string, startDate: string, endDate: string) => Promise<any[]>;
  getSalesReport: (restaurantId: string, startDate: string, endDate: string) => Promise<any>;
  getCounterOrdersForPeriod: (restaurantId: string, startDate: string, endDate: string) => Promise<any[]>;
  
  // Printer Config
  getPrinterConfig: (restaurantId: string) => Promise<PrinterConfig | null>;
  savePrinterConfig: (config: PrinterConfig) => Promise<any>;
}

interface ElectronBackup {
  create: (type: string) => Promise<any>;
  restore: (filePath: string) => Promise<any>;
  list: (type: string) => Promise<any[]>;
  stats: () => Promise<any>;
  export: () => Promise<any>;
  import: () => Promise<any>;
}

interface ElectronImages {
  saveFromBase64: (type: string, fileName: string, base64Data: string) => Promise<any>;
  saveFromUrl: (type: string, fileName: string, url: string) => Promise<any>;
  delete: (filePath: string) => Promise<any>;
  list: (type: string) => Promise<string[]>;
  stats: () => Promise<any>;
  selectFile: () => Promise<{ success: boolean; path?: string }>;
}

interface ElectronFiles {
  getConfig: () => Promise<any>;
  updateConfig: (updates: any) => Promise<any>;
  setCloudConfig: (url: string, key: string) => Promise<any>;
  disableCloudSync: () => Promise<any>;
  getStorageInfo: () => Promise<any>;
  openDataFolder: () => Promise<{ success: boolean }>;
}

interface ElectronEvents {
  on: (channel: string, callback: (data: any) => void) => number;
  off: (id: number) => void;
  removeAllListeners: () => void;
}

interface ElectronPlatform {
  isElectron: boolean;
  platform: string;
  arch: string;
  version: string;
}

declare global {
  interface Window {
    electronDB?: ElectronDB;
    electronBackup?: ElectronBackup;
    electronImages?: ElectronImages;
    electronFiles?: ElectronFiles;
    electronEvents?: ElectronEvents;
    electronPrinter?: ElectronPrinter;
    isElectron?: boolean;
    electronPlatform?: ElectronPlatform;
  }
}

export {};

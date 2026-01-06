// Preload Script - Exposes safe APIs to renderer process
const { contextBridge, ipcRenderer } = require('electron');

// Event listeners storage
const eventListeners = new Map();
let eventListenerId = 0;

// Expose protected methods to renderer
contextBridge.exposeInMainWorld('electronDB', {
  // =============================================
  // RESTAURANTS
  // =============================================
  getRestaurants: () => ipcRenderer.invoke('db:getRestaurants'),
  getRestaurantById: (id) => ipcRenderer.invoke('db:getRestaurantById', id),
  getRestaurantBySlug: (slug) => ipcRenderer.invoke('db:getRestaurantBySlug', slug),
  createRestaurant: (data) => ipcRenderer.invoke('db:createRestaurant', data),
  updateRestaurant: (id, data) => ipcRenderer.invoke('db:updateRestaurant', id, data),
  deleteRestaurant: (id) => ipcRenderer.invoke('db:deleteRestaurant', id),

  // =============================================
  // CATEGORIES
  // =============================================
  getCategories: (restaurantId) => ipcRenderer.invoke('db:getCategories', restaurantId),
  createCategory: (data) => ipcRenderer.invoke('db:createCategory', data),
  updateCategory: (id, data) => ipcRenderer.invoke('db:updateCategory', id, data),
  deleteCategory: (id) => ipcRenderer.invoke('db:deleteCategory', id),

  // =============================================
  // PRODUCTS
  // =============================================
  getProducts: (categoryId) => ipcRenderer.invoke('db:getProducts', categoryId),
  getProductsByRestaurant: (restaurantId) => ipcRenderer.invoke('db:getProductsByRestaurant', restaurantId),
  getFeaturedProducts: (restaurantId) => ipcRenderer.invoke('db:getFeaturedProducts', restaurantId),
  createProduct: (data) => ipcRenderer.invoke('db:createProduct', data),
  updateProduct: (id, data) => ipcRenderer.invoke('db:updateProduct', id, data),
  deleteProduct: (id) => ipcRenderer.invoke('db:deleteProduct', id),

  // =============================================
  // TABLES
  // =============================================
  getTables: (restaurantId) => ipcRenderer.invoke('db:getTables', restaurantId),
  getTableById: (id) => ipcRenderer.invoke('db:getTableById', id),
  createTable: (data) => ipcRenderer.invoke('db:createTable', data),
  updateTable: (id, data) => ipcRenderer.invoke('db:updateTable', id, data),
  deleteTable: (id) => ipcRenderer.invoke('db:deleteTable', id),

  // =============================================
  // COMANDAS
  // =============================================
  getComandas: (restaurantId) => ipcRenderer.invoke('db:getComandas', restaurantId),
  getComandasByTable: (tableId) => ipcRenderer.invoke('db:getComandasByTable', tableId),
  getActiveComandaByTable: (tableId) => ipcRenderer.invoke('db:getActiveComandaByTable', tableId),
  createComanda: (data) => ipcRenderer.invoke('db:createComanda', data),
  updateComanda: (id, data) => ipcRenderer.invoke('db:updateComanda', id, data),
  closeComanda: (id) => ipcRenderer.invoke('db:closeComanda', id),

  // =============================================
  // ORDERS
  // =============================================
  getOrders: (restaurantId) => ipcRenderer.invoke('db:getOrders', restaurantId),
  getOrdersByTable: (tableId) => ipcRenderer.invoke('db:getOrdersByTable', tableId),
  getOrdersByComanda: (comandaId) => ipcRenderer.invoke('db:getOrdersByComanda', comandaId),
  getOrdersByStatus: (restaurantId, status) => ipcRenderer.invoke('db:getOrdersByStatus', restaurantId, status),
  getOrdersByType: (restaurantId, orderType) => ipcRenderer.invoke('db:getOrdersByType', restaurantId, orderType),
  createOrder: (data) => ipcRenderer.invoke('db:createOrder', data),
  updateOrder: (id, data) => ipcRenderer.invoke('db:updateOrder', id, data),
  deleteOrder: (id) => ipcRenderer.invoke('db:deleteOrder', id),

  // =============================================
  // ORDER ITEMS
  // =============================================
  getOrderItems: (orderId) => ipcRenderer.invoke('db:getOrderItems', orderId),
  createOrderItem: (data) => ipcRenderer.invoke('db:createOrderItem', data),
  deleteOrderItem: (id) => ipcRenderer.invoke('db:deleteOrderItem', id),
  getOrderItemExtras: (orderItemId) => ipcRenderer.invoke('db:getOrderItemExtras', orderItemId),
  createOrderItemExtra: (data) => ipcRenderer.invoke('db:createOrderItemExtra', data),

  // =============================================
  // COUNTER ORDERS (PDV)
  // =============================================
  getCounterOrders: (restaurantId) => ipcRenderer.invoke('db:getCounterOrders', restaurantId),
  createCounterOrder: (data) => ipcRenderer.invoke('db:createCounterOrder', data),
  updateCounterOrder: (id, data) => ipcRenderer.invoke('db:updateCounterOrder', id, data),
  getCounterOrderItems: (counterOrderId) => ipcRenderer.invoke('db:getCounterOrderItems', counterOrderId),
  createCounterOrderItem: (data) => ipcRenderer.invoke('db:createCounterOrderItem', data),
  createCounterOrderItemExtra: (data) => ipcRenderer.invoke('db:createCounterOrderItemExtra', data),

  // =============================================
  // BILLS
  // =============================================
  getBills: (restaurantId) => ipcRenderer.invoke('db:getBills', restaurantId),
  getBillsByTable: (tableId) => ipcRenderer.invoke('db:getBillsByTable', tableId),
  getActiveBillByTable: (tableId) => ipcRenderer.invoke('db:getActiveBillByTable', tableId),
  createBill: (data) => ipcRenderer.invoke('db:createBill', data),
  updateBill: (id, data) => ipcRenderer.invoke('db:updateBill', id, data),
  deleteBill: (id) => ipcRenderer.invoke('db:deleteBill', id),

  // =============================================
  // CASH REGISTER
  // =============================================
  getCashSessions: (restaurantId) => ipcRenderer.invoke('db:getCashSessions', restaurantId),
  getOpenCashSession: (restaurantId) => ipcRenderer.invoke('db:getOpenCashSession', restaurantId),
  createCashSession: (data) => ipcRenderer.invoke('db:createCashSession', data),
  updateCashSession: (id, data) => ipcRenderer.invoke('db:updateCashSession', id, data),
  closeCashSession: (id, data) => ipcRenderer.invoke('db:closeCashSession', id, data),
  getCashMovements: (sessionId) => ipcRenderer.invoke('db:getCashMovements', sessionId),
  getCashMovementsByRestaurant: (restaurantId) => ipcRenderer.invoke('db:getCashMovementsByRestaurant', restaurantId),
  createCashMovement: (data) => ipcRenderer.invoke('db:createCashMovement', data),

  // =============================================
  // STOCK
  // =============================================
  getStockItems: (restaurantId) => ipcRenderer.invoke('db:getStockItems', restaurantId),
  createStockItem: (data) => ipcRenderer.invoke('db:createStockItem', data),
  updateStockItem: (id, data) => ipcRenderer.invoke('db:updateStockItem', id, data),
  deleteStockItem: (id) => ipcRenderer.invoke('db:deleteStockItem', id),
  getStockCategories: (restaurantId) => ipcRenderer.invoke('db:getStockCategories', restaurantId),
  createStockCategory: (data) => ipcRenderer.invoke('db:createStockCategory', data),
  updateStockCategory: (id, data) => ipcRenderer.invoke('db:updateStockCategory', id, data),
  deleteStockCategory: (id) => ipcRenderer.invoke('db:deleteStockCategory', id),
  getStockMovements: (stockItemId) => ipcRenderer.invoke('db:getStockMovements', stockItemId),
  getAllStockMovements: (restaurantId) => ipcRenderer.invoke('db:getAllStockMovements', restaurantId),
  createStockMovement: (data) => ipcRenderer.invoke('db:createStockMovement', data),

  // =============================================
  // PRODUCT INGREDIENTS
  // =============================================
  getProductIngredients: (productId) => ipcRenderer.invoke('db:getProductIngredients', productId),
  createProductIngredient: (data) => ipcRenderer.invoke('db:createProductIngredient', data),
  deleteProductIngredient: (id) => ipcRenderer.invoke('db:deleteProductIngredient', id),
  deleteProductIngredientsByProduct: (productId) => ipcRenderer.invoke('db:deleteProductIngredientsByProduct', productId),

  // =============================================
  // PRODUCT EXTRAS
  // =============================================
  getProductExtras: (productId) => ipcRenderer.invoke('db:getProductExtras', productId),
  createProductExtra: (data) => ipcRenderer.invoke('db:createProductExtra', data),
  updateProductExtra: (id, data) => ipcRenderer.invoke('db:updateProductExtra', id, data),
  deleteProductExtra: (id) => ipcRenderer.invoke('db:deleteProductExtra', id),
  deleteProductExtrasByProduct: (productId) => ipcRenderer.invoke('db:deleteProductExtrasByProduct', productId),
  getProductExtraIngredients: (productExtraId) => ipcRenderer.invoke('db:getProductExtraIngredients', productExtraId),
  createProductExtraIngredient: (data) => ipcRenderer.invoke('db:createProductExtraIngredient', data),

  // =============================================
  // EXTRA CATEGORIES (COMPLEMENTS)
  // =============================================
  getExtraCategories: (restaurantId) => ipcRenderer.invoke('db:getExtraCategories', restaurantId),
  createExtraCategory: (data) => ipcRenderer.invoke('db:createExtraCategory', data),
  updateExtraCategory: (id, data) => ipcRenderer.invoke('db:updateExtraCategory', id, data),
  deleteExtraCategory: (id) => ipcRenderer.invoke('db:deleteExtraCategory', id),
  getExtraCategoryItems: (categoryId) => ipcRenderer.invoke('db:getExtraCategoryItems', categoryId),
  createExtraCategoryItem: (data) => ipcRenderer.invoke('db:createExtraCategoryItem', data),
  updateExtraCategoryItem: (id, data) => ipcRenderer.invoke('db:updateExtraCategoryItem', id, data),
  deleteExtraCategoryItem: (id) => ipcRenderer.invoke('db:deleteExtraCategoryItem', id),

  // =============================================
  // PRODUCT COMPLEMENT GROUPS
  // =============================================
  getProductComplementGroups: (productId) => ipcRenderer.invoke('db:getProductComplementGroups', productId),
  createProductComplementGroup: (data) => ipcRenderer.invoke('db:createProductComplementGroup', data),
  updateProductComplementGroup: (id, data) => ipcRenderer.invoke('db:updateProductComplementGroup', id, data),
  deleteProductComplementGroup: (id) => ipcRenderer.invoke('db:deleteProductComplementGroup', id),
  deleteProductComplementGroupsByProduct: (productId) => ipcRenderer.invoke('db:deleteProductComplementGroupsByProduct', productId),

  // =============================================
  // CUSTOMERS
  // =============================================
  getCustomers: (restaurantId) => ipcRenderer.invoke('db:getCustomers', restaurantId),
  getCustomerByCpf: (restaurantId, cpf) => ipcRenderer.invoke('db:getCustomerByCpf', restaurantId, cpf),
  getCustomerByPhone: (restaurantId, phone) => ipcRenderer.invoke('db:getCustomerByPhone', restaurantId, phone),
  createCustomer: (data) => ipcRenderer.invoke('db:createCustomer', data),
  updateCustomer: (id, data) => ipcRenderer.invoke('db:updateCustomer', id, data),
  deleteCustomer: (id) => ipcRenderer.invoke('db:deleteCustomer', id),
  getCustomerAddresses: (customerCpf) => ipcRenderer.invoke('db:getCustomerAddresses', customerCpf),
  createCustomerAddress: (data) => ipcRenderer.invoke('db:createCustomerAddress', data),
  updateCustomerAddress: (id, data) => ipcRenderer.invoke('db:updateCustomerAddress', id, data),
  deleteCustomerAddress: (id) => ipcRenderer.invoke('db:deleteCustomerAddress', id),

  // =============================================
  // LOYALTY
  // =============================================
  getLoyaltyPoints: (restaurantId, customerCpf) => ipcRenderer.invoke('db:getLoyaltyPoints', restaurantId, customerCpf),
  createOrUpdateLoyaltyPoints: (data) => ipcRenderer.invoke('db:createOrUpdateLoyaltyPoints', data),
  getLoyaltyTransactions: (restaurantId, customerCpf) => ipcRenderer.invoke('db:getLoyaltyTransactions', restaurantId, customerCpf),
  createLoyaltyTransaction: (data) => ipcRenderer.invoke('db:createLoyaltyTransaction', data),

  // =============================================
  // COUPONS
  // =============================================
  getCoupons: (restaurantId) => ipcRenderer.invoke('db:getCoupons', restaurantId),
  getCouponByCode: (restaurantId, code) => ipcRenderer.invoke('db:getCouponByCode', restaurantId, code),
  createCoupon: (data) => ipcRenderer.invoke('db:createCoupon', data),
  updateCoupon: (id, data) => ipcRenderer.invoke('db:updateCoupon', id, data),
  deleteCoupon: (id) => ipcRenderer.invoke('db:deleteCoupon', id),
  incrementCouponUsage: (id) => ipcRenderer.invoke('db:incrementCouponUsage', id),

  // =============================================
  // DELIVERY
  // =============================================
  getDeliveryConfig: (restaurantId) => ipcRenderer.invoke('db:getDeliveryConfig', restaurantId),
  createOrUpdateDeliveryConfig: (data) => ipcRenderer.invoke('db:createOrUpdateDeliveryConfig', data),
  getDeliveryZones: (restaurantId) => ipcRenderer.invoke('db:getDeliveryZones', restaurantId),
  getDeliveryZoneByZip: (restaurantId, zipCode) => ipcRenderer.invoke('db:getDeliveryZoneByZip', restaurantId, zipCode),
  createDeliveryZone: (data) => ipcRenderer.invoke('db:createDeliveryZone', data),
  updateDeliveryZone: (id, data) => ipcRenderer.invoke('db:updateDeliveryZone', id, data),
  deleteDeliveryZone: (id) => ipcRenderer.invoke('db:deleteDeliveryZone', id),

  // =============================================
  // BUSINESS HOURS
  // =============================================
  getBusinessHours: (restaurantId) => ipcRenderer.invoke('db:getBusinessHours', restaurantId),
  createOrUpdateBusinessHours: (data) => ipcRenderer.invoke('db:createOrUpdateBusinessHours', data),

  // =============================================
  // PAYMENT METHODS
  // =============================================
  getPaymentMethods: (restaurantId) => ipcRenderer.invoke('db:getPaymentMethods', restaurantId),
  getActivePaymentMethods: (restaurantId) => ipcRenderer.invoke('db:getActivePaymentMethods', restaurantId),
  createPaymentMethod: (data) => ipcRenderer.invoke('db:createPaymentMethod', data),
  updatePaymentMethod: (id, data) => ipcRenderer.invoke('db:updatePaymentMethod', id, data),
  deletePaymentMethod: (id) => ipcRenderer.invoke('db:deletePaymentMethod', id),
  getCardFeesConfig: (restaurantId) => ipcRenderer.invoke('db:getCardFeesConfig', restaurantId),
  createOrUpdateCardFeesConfig: (data) => ipcRenderer.invoke('db:createOrUpdateCardFeesConfig', data),

  // =============================================
  // COSTS
  // =============================================
  getFixedCosts: (restaurantId) => ipcRenderer.invoke('db:getFixedCosts', restaurantId),
  createFixedCost: (data) => ipcRenderer.invoke('db:createFixedCost', data),
  updateFixedCost: (id, data) => ipcRenderer.invoke('db:updateFixedCost', id, data),
  deleteFixedCost: (id) => ipcRenderer.invoke('db:deleteFixedCost', id),
  getVariableCosts: (restaurantId) => ipcRenderer.invoke('db:getVariableCosts', restaurantId),
  createVariableCost: (data) => ipcRenderer.invoke('db:createVariableCost', data),
  updateVariableCost: (id, data) => ipcRenderer.invoke('db:updateVariableCost', id, data),
  deleteVariableCost: (id) => ipcRenderer.invoke('db:deleteVariableCost', id),
  getLaborCosts: (restaurantId) => ipcRenderer.invoke('db:getLaborCosts', restaurantId),
  createLaborCost: (data) => ipcRenderer.invoke('db:createLaborCost', data),
  updateLaborCost: (id, data) => ipcRenderer.invoke('db:updateLaborCost', id, data),
  deleteLaborCost: (id) => ipcRenderer.invoke('db:deleteLaborCost', id),
  getOperationalCosts: (restaurantId, monthYear) => ipcRenderer.invoke('db:getOperationalCosts', restaurantId, monthYear),
  createOrUpdateOperationalCosts: (data) => ipcRenderer.invoke('db:createOrUpdateOperationalCosts', data),

  // =============================================
  // REVIEWS
  // =============================================
  getReviews: (restaurantId) => ipcRenderer.invoke('db:getReviews', restaurantId),
  createReview: (data) => ipcRenderer.invoke('db:createReview', data),

  // =============================================
  // WHATSAPP CONFIG
  // =============================================
  getWhatsAppConfig: (restaurantId) => ipcRenderer.invoke('db:getWhatsAppConfig', restaurantId),
  createOrUpdateWhatsAppConfig: (data) => ipcRenderer.invoke('db:createOrUpdateWhatsAppConfig', data),

  // =============================================
  // AUTH
  // =============================================
  login: (username, password) => ipcRenderer.invoke('db:login', username, password),
  createUser: (data) => ipcRenderer.invoke('db:createUser', data),
  createRestaurantCredentials: (data) => ipcRenderer.invoke('db:createRestaurantCredentials', data),

  // =============================================
  // REPORTS
  // =============================================
  getOrdersForPeriod: (restaurantId, startDate, endDate) => ipcRenderer.invoke('db:getOrdersForPeriod', restaurantId, startDate, endDate),
  getSalesReport: (restaurantId, startDate, endDate) => ipcRenderer.invoke('db:getSalesReport', restaurantId, startDate, endDate),
  getCounterOrdersForPeriod: (restaurantId, startDate, endDate) => ipcRenderer.invoke('db:getCounterOrdersForPeriod', restaurantId, startDate, endDate),

  // =============================================
  // PRINTER CONFIG
  // =============================================
  getPrinterConfig: (restaurantId) => ipcRenderer.invoke('db:getPrinterConfig', restaurantId),
  savePrinterConfig: (config) => ipcRenderer.invoke('db:savePrinterConfig', config),
});

// Expose backup API
contextBridge.exposeInMainWorld('electronBackup', {
  create: (type) => ipcRenderer.invoke('backup:create', type),
  restore: (filePath) => ipcRenderer.invoke('backup:restore', filePath),
  list: (type) => ipcRenderer.invoke('backup:list', type),
  stats: () => ipcRenderer.invoke('backup:stats'),
  export: () => ipcRenderer.invoke('backup:export'),
  import: () => ipcRenderer.invoke('backup:import'),
});

// Expose image storage API
contextBridge.exposeInMainWorld('electronImages', {
  saveFromBase64: (type, fileName, base64Data) => ipcRenderer.invoke('images:saveFromBase64', type, fileName, base64Data),
  saveFromUrl: (type, fileName, url) => ipcRenderer.invoke('images:saveFromUrl', type, fileName, url),
  delete: (filePath) => ipcRenderer.invoke('images:delete', filePath),
  list: (type) => ipcRenderer.invoke('images:list', type),
  stats: () => ipcRenderer.invoke('images:stats'),
  selectFile: () => ipcRenderer.invoke('images:selectFile'),
});

// Expose file manager API
contextBridge.exposeInMainWorld('electronFiles', {
  getConfig: () => ipcRenderer.invoke('files:getConfig'),
  updateConfig: (updates) => ipcRenderer.invoke('files:updateConfig', updates),
  setCloudConfig: (url, key) => ipcRenderer.invoke('files:setCloudConfig', url, key),
  disableCloudSync: () => ipcRenderer.invoke('files:disableCloudSync'),
  getStorageInfo: () => ipcRenderer.invoke('files:getStorageInfo'),
  openDataFolder: () => ipcRenderer.invoke('files:openDataFolder'),
});

// Expose event system for realtime updates
contextBridge.exposeInMainWorld('electronEvents', {
  on: (channel, callback) => {
    const id = eventListenerId++;
    const listener = (event, payload) => {
      callback(payload);
    };
    
    ipcRenderer.on(`event:${channel}`, listener);
    eventListeners.set(id, { channel, listener });
    
    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(`event:${channel}`, listener);
      eventListeners.delete(id);
    };
  },
  
  off: (id) => {
    const entry = eventListeners.get(id);
    if (entry) {
      ipcRenderer.removeListener(`event:${entry.channel}`, entry.listener);
      eventListeners.delete(id);
    }
  },
  
  removeAllListeners: () => {
    eventListeners.forEach((entry, id) => {
      ipcRenderer.removeListener(`event:${entry.channel}`, entry.listener);
    });
    eventListeners.clear();
  }
});

// Detect if running in Electron
contextBridge.exposeInMainWorld('isElectron', true);

// Expose printer API
contextBridge.exposeInMainWorld('electronPrinter', {
  getList: () => ipcRenderer.invoke('printer:getList'),
  print: (printerName, content, options) => ipcRenderer.invoke('printer:print', printerName, content, options),
  test: (printerName, paperSize) => ipcRenderer.invoke('printer:test', printerName, paperSize),
});

// Expose platform info
contextBridge.exposeInMainWorld('electronPlatform', {
  platform: process.platform,
  arch: process.arch,
  version: process.versions.electron,
  isWindows: process.platform === 'win32',
  isMac: process.platform === 'darwin',
  isLinux: process.platform === 'linux'
});

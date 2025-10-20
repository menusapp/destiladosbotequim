const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronDB', {
  // Restaurants
  getRestaurants: () => ipcRenderer.invoke('db:getRestaurants'),
  getRestaurantBySlug: (slug) => ipcRenderer.invoke('db:getRestaurantBySlug', slug),
  createRestaurant: (data) => ipcRenderer.invoke('db:createRestaurant', data),
  updateRestaurant: (id, data) => ipcRenderer.invoke('db:updateRestaurant', id, data),
  deleteRestaurant: (id) => ipcRenderer.invoke('db:deleteRestaurant', id),

  // Categories
  getCategories: (restaurantId) => ipcRenderer.invoke('db:getCategories', restaurantId),
  createCategory: (data) => ipcRenderer.invoke('db:createCategory', data),
  updateCategory: (id, data) => ipcRenderer.invoke('db:updateCategory', id, data),
  deleteCategory: (id) => ipcRenderer.invoke('db:deleteCategory', id),

  // Products
  getProducts: (categoryId) => ipcRenderer.invoke('db:getProducts', categoryId),
  getProductsByRestaurant: (restaurantId) => ipcRenderer.invoke('db:getProductsByRestaurant', restaurantId),
  createProduct: (data) => ipcRenderer.invoke('db:createProduct', data),
  updateProduct: (id, data) => ipcRenderer.invoke('db:updateProduct', id, data),
  deleteProduct: (id) => ipcRenderer.invoke('db:deleteProduct', id),

  // Tables
  getTables: (restaurantId) => ipcRenderer.invoke('db:getTables', restaurantId),
  createTable: (data) => ipcRenderer.invoke('db:createTable', data),
  updateTable: (id, data) => ipcRenderer.invoke('db:updateTable', id, data),
  deleteTable: (id) => ipcRenderer.invoke('db:deleteTable', id),

  // Orders
  getOrders: (restaurantId) => ipcRenderer.invoke('db:getOrders', restaurantId),
  getOrdersByTable: (tableId) => ipcRenderer.invoke('db:getOrdersByTable', tableId),
  createOrder: (data) => ipcRenderer.invoke('db:createOrder', data),
  updateOrder: (id, data) => ipcRenderer.invoke('db:updateOrder', id, data),
  deleteOrder: (id) => ipcRenderer.invoke('db:deleteOrder', id),

  // Order Items
  getOrderItems: (orderId) => ipcRenderer.invoke('db:getOrderItems', orderId),
  createOrderItem: (data) => ipcRenderer.invoke('db:createOrderItem', data),
  deleteOrderItem: (id) => ipcRenderer.invoke('db:deleteOrderItem', id),

  // Bills
  getBills: (restaurantId) => ipcRenderer.invoke('db:getBills', restaurantId),
  createBill: (data) => ipcRenderer.invoke('db:createBill', data),
  updateBill: (id, data) => ipcRenderer.invoke('db:updateBill', id, data),

  // Cash Register
  getCashSessions: (restaurantId) => ipcRenderer.invoke('db:getCashSessions', restaurantId),
  createCashSession: (data) => ipcRenderer.invoke('db:createCashSession', data),
  updateCashSession: (id, data) => ipcRenderer.invoke('db:updateCashSession', id, data),
  getCashMovements: (sessionId) => ipcRenderer.invoke('db:getCashMovements', sessionId),
  createCashMovement: (data) => ipcRenderer.invoke('db:createCashMovement', data),

  // Stock
  getStockItems: (restaurantId) => ipcRenderer.invoke('db:getStockItems', restaurantId),
  createStockItem: (data) => ipcRenderer.invoke('db:createStockItem', data),
  updateStockItem: (id, data) => ipcRenderer.invoke('db:updateStockItem', id, data),
  deleteStockItem: (id) => ipcRenderer.invoke('db:deleteStockItem', id),
  getStockCategories: (restaurantId) => ipcRenderer.invoke('db:getStockCategories', restaurantId),
  createStockCategory: (data) => ipcRenderer.invoke('db:createStockCategory', data),

  // Product Extras
  getProductExtras: (productId) => ipcRenderer.invoke('db:getProductExtras', productId),
  createProductExtra: (data) => ipcRenderer.invoke('db:createProductExtra', data),
  updateProductExtra: (id, data) => ipcRenderer.invoke('db:updateProductExtra', id, data),
  deleteProductExtra: (id) => ipcRenderer.invoke('db:deleteProductExtra', id),

  // Auth
  login: (username, password) => ipcRenderer.invoke('db:login', username, password),
  createUser: (data) => ipcRenderer.invoke('db:createUser', data),
});

// Detect if running in Electron
contextBridge.exposeInMainWorld('isElectron', true);

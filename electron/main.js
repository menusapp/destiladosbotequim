// Electron Main Process - Complete with all services
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Import services
const Database = require('./database');
const FileManager = require('./fileManager');
const BackupService = require('./backupService');
const ImageStorage = require('./imageStorage');
const { eventBus } = require('./eventBus');

let mainWindow;
let db;
let fileManager;
let backupService;
let imageStorage;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false // Allow loading local file:// images
    },
    icon: path.join(__dirname, '../public/favicon.ico'),
    title: "Menu's - Sistema de Gestão"
  });

  // In development, load from Vite server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  // Initialize file manager first (creates folder structure)
  fileManager = new FileManager();
  
  // Initialize database
  db = new Database(fileManager.getDatabasePath());
  db.setEventBus(eventBus);
  
  // Initialize other services
  backupService = new BackupService(db, fileManager);
  imageStorage = new ImageStorage(fileManager);
  
  // Start auto backup
  backupService.startAutoBackup(24); // Every 24 hours
  
  // Setup IPC handlers
  setupIpcHandlers();
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    backupService.stopAutoBackup();
    db.close();
    app.quit();
  }
});

function setupIpcHandlers() {
  // =============================================
  // RESTAURANTS
  // =============================================
  ipcMain.handle('db:getRestaurants', () => db.getRestaurants());
  ipcMain.handle('db:getRestaurantById', (_, id) => db.getRestaurantById(id));
  ipcMain.handle('db:getRestaurantBySlug', (_, slug) => db.getRestaurantBySlug(slug));
  ipcMain.handle('db:createRestaurant', (_, data) => db.createRestaurant(data));
  ipcMain.handle('db:updateRestaurant', (_, id, data) => {
    const result = db.updateRestaurant(id, data);
    eventBus.emitChange('restaurants', 'UPDATE', result);
    return result;
  });
  ipcMain.handle('db:deleteRestaurant', (_, id) => db.deleteRestaurant(id));

  // =============================================
  // CATEGORIES
  // =============================================
  ipcMain.handle('db:getCategories', (_, restaurantId) => db.getCategories(restaurantId));
  ipcMain.handle('db:createCategory', (_, data) => db.createCategory(data));
  ipcMain.handle('db:updateCategory', (_, id, data) => db.updateCategory(id, data));
  ipcMain.handle('db:deleteCategory', (_, id) => db.deleteCategory(id));

  // =============================================
  // PRODUCTS
  // =============================================
  ipcMain.handle('db:getProducts', (_, categoryId) => db.getProducts(categoryId));
  ipcMain.handle('db:getProductsByRestaurant', (_, restaurantId) => db.getProductsByRestaurant(restaurantId));
  ipcMain.handle('db:getFeaturedProducts', (_, restaurantId) => db.getFeaturedProducts(restaurantId));
  ipcMain.handle('db:createProduct', (_, data) => {
    const result = db.createProduct(data);
    eventBus.emitProductChange('INSERT', result);
    return result;
  });
  ipcMain.handle('db:updateProduct', (_, id, data) => {
    const result = db.updateProduct(id, data);
    eventBus.emitProductChange('UPDATE', result);
    return result;
  });
  ipcMain.handle('db:deleteProduct', (_, id) => db.deleteProduct(id));

  // =============================================
  // TABLES
  // =============================================
  ipcMain.handle('db:getTables', (_, restaurantId) => db.getTables(restaurantId));
  ipcMain.handle('db:getTableById', (_, id) => db.getTableById(id));
  ipcMain.handle('db:createTable', (_, data) => db.createTable(data));
  ipcMain.handle('db:updateTable', (_, id, data) => {
    const result = db.updateTable(id, data);
    eventBus.emitTableChange('UPDATE', result);
    return result;
  });
  ipcMain.handle('db:deleteTable', (_, id) => db.deleteTable(id));

  // =============================================
  // COMANDAS
  // =============================================
  ipcMain.handle('db:getComandas', (_, restaurantId) => db.getComandas(restaurantId));
  ipcMain.handle('db:getComandasByTable', (_, tableId) => db.getComandasByTable(tableId));
  ipcMain.handle('db:getActiveComandaByTable', (_, tableId) => db.getActiveComandaByTable(tableId));
  ipcMain.handle('db:createComanda', (_, data) => {
    const result = db.createComanda(data);
    eventBus.emitComandaChange('INSERT', result);
    return result;
  });
  ipcMain.handle('db:updateComanda', (_, id, data) => {
    const result = db.updateComanda(id, data);
    eventBus.emitComandaChange('UPDATE', result);
    return result;
  });
  ipcMain.handle('db:closeComanda', (_, id) => {
    const result = db.closeComanda(id);
    eventBus.emitComandaChange('UPDATE', result);
    return result;
  });

  // =============================================
  // ORDERS
  // =============================================
  ipcMain.handle('db:getOrders', (_, restaurantId) => db.getOrders(restaurantId));
  ipcMain.handle('db:getOrdersByTable', (_, tableId) => db.getOrdersByTable(tableId));
  ipcMain.handle('db:getOrdersByComanda', (_, comandaId) => db.getOrdersByComanda(comandaId));
  ipcMain.handle('db:getOrdersByStatus', (_, restaurantId, status) => db.getOrdersByStatus(restaurantId, status));
  ipcMain.handle('db:getOrdersByType', (_, restaurantId, orderType) => db.getOrdersByType(restaurantId, orderType));
  ipcMain.handle('db:createOrder', (_, data) => {
    const result = db.createOrder(data);
    eventBus.emitOrderChange('INSERT', result);
    return result;
  });
  ipcMain.handle('db:updateOrder', (_, id, data) => {
    const result = db.updateOrder(id, data);
    eventBus.emitOrderChange('UPDATE', result);
    return result;
  });
  ipcMain.handle('db:deleteOrder', (_, id) => db.deleteOrder(id));

  // =============================================
  // ORDER ITEMS
  // =============================================
  ipcMain.handle('db:getOrderItems', (_, orderId) => db.getOrderItems(orderId));
  ipcMain.handle('db:createOrderItem', (_, data) => db.createOrderItem(data));
  ipcMain.handle('db:deleteOrderItem', (_, id) => db.deleteOrderItem(id));
  ipcMain.handle('db:getOrderItemExtras', (_, orderItemId) => db.getOrderItemExtras(orderItemId));
  ipcMain.handle('db:createOrderItemExtra', (_, data) => db.createOrderItemExtra(data));

  // =============================================
  // COUNTER ORDERS (PDV)
  // =============================================
  ipcMain.handle('db:getCounterOrders', (_, restaurantId) => db.getCounterOrders(restaurantId));
  ipcMain.handle('db:createCounterOrder', (_, data) => db.createCounterOrder(data));
  ipcMain.handle('db:updateCounterOrder', (_, id, data) => db.updateCounterOrder(id, data));
  ipcMain.handle('db:getCounterOrderItems', (_, counterOrderId) => db.getCounterOrderItems(counterOrderId));
  ipcMain.handle('db:createCounterOrderItem', (_, data) => db.createCounterOrderItem(data));
  ipcMain.handle('db:createCounterOrderItemExtra', (_, data) => db.createCounterOrderItemExtra(data));

  // =============================================
  // BILLS
  // =============================================
  ipcMain.handle('db:getBills', (_, restaurantId) => db.getBills(restaurantId));
  ipcMain.handle('db:getBillsByTable', (_, tableId) => db.getBillsByTable(tableId));
  ipcMain.handle('db:getActiveBillByTable', (_, tableId) => db.getActiveBillByTable(tableId));
  ipcMain.handle('db:createBill', (_, data) => {
    const result = db.createBill(data);
    eventBus.emitBillChange('INSERT', result);
    return result;
  });
  ipcMain.handle('db:updateBill', (_, id, data) => {
    const result = db.updateBill(id, data);
    eventBus.emitBillChange('UPDATE', result);
    return result;
  });
  ipcMain.handle('db:deleteBill', (_, id) => db.deleteBill(id));

  // =============================================
  // CASH REGISTER
  // =============================================
  ipcMain.handle('db:getCashSessions', (_, restaurantId) => db.getCashSessions(restaurantId));
  ipcMain.handle('db:getOpenCashSession', (_, restaurantId) => db.getOpenCashSession(restaurantId));
  ipcMain.handle('db:createCashSession', (_, data) => db.createCashSession(data));
  ipcMain.handle('db:updateCashSession', (_, id, data) => db.updateCashSession(id, data));
  ipcMain.handle('db:closeCashSession', (_, id, data) => db.closeCashSession(id, data));
  ipcMain.handle('db:getCashMovements', (_, sessionId) => db.getCashMovements(sessionId));
  ipcMain.handle('db:getCashMovementsByRestaurant', (_, restaurantId) => db.getCashMovementsByRestaurant(restaurantId));
  ipcMain.handle('db:createCashMovement', (_, data) => db.createCashMovement(data));

  // =============================================
  // STOCK
  // =============================================
  ipcMain.handle('db:getStockItems', (_, restaurantId) => db.getStockItems(restaurantId));
  ipcMain.handle('db:createStockItem', (_, data) => db.createStockItem(data));
  ipcMain.handle('db:updateStockItem', (_, id, data) => db.updateStockItem(id, data));
  ipcMain.handle('db:deleteStockItem', (_, id) => db.deleteStockItem(id));
  ipcMain.handle('db:getStockCategories', (_, restaurantId) => db.getStockCategories(restaurantId));
  ipcMain.handle('db:createStockCategory', (_, data) => db.createStockCategory(data));
  ipcMain.handle('db:updateStockCategory', (_, id, data) => db.updateStockCategory(id, data));
  ipcMain.handle('db:deleteStockCategory', (_, id) => db.deleteStockCategory(id));
  ipcMain.handle('db:getStockMovements', (_, stockItemId) => db.getStockMovements(stockItemId));
  ipcMain.handle('db:getAllStockMovements', (_, restaurantId) => db.getAllStockMovements(restaurantId));
  ipcMain.handle('db:createStockMovement', (_, data) => db.createStockMovement(data));

  // =============================================
  // PRODUCT INGREDIENTS
  // =============================================
  ipcMain.handle('db:getProductIngredients', (_, productId) => db.getProductIngredients(productId));
  ipcMain.handle('db:createProductIngredient', (_, data) => db.createProductIngredient(data));
  ipcMain.handle('db:deleteProductIngredient', (_, id) => db.deleteProductIngredient(id));
  ipcMain.handle('db:deleteProductIngredientsByProduct', (_, productId) => db.deleteProductIngredientsByProduct(productId));

  // =============================================
  // PRODUCT EXTRAS
  // =============================================
  ipcMain.handle('db:getProductExtras', (_, productId) => db.getProductExtras(productId));
  ipcMain.handle('db:createProductExtra', (_, data) => db.createProductExtra(data));
  ipcMain.handle('db:updateProductExtra', (_, id, data) => db.updateProductExtra(id, data));
  ipcMain.handle('db:deleteProductExtra', (_, id) => db.deleteProductExtra(id));
  ipcMain.handle('db:deleteProductExtrasByProduct', (_, productId) => db.deleteProductExtrasByProduct(productId));
  ipcMain.handle('db:getProductExtraIngredients', (_, productExtraId) => db.getProductExtraIngredients(productExtraId));
  ipcMain.handle('db:createProductExtraIngredient', (_, data) => db.createProductExtraIngredient(data));

  // =============================================
  // EXTRA CATEGORIES (COMPLEMENTS)
  // =============================================
  ipcMain.handle('db:getExtraCategories', (_, restaurantId) => db.getExtraCategories(restaurantId));
  ipcMain.handle('db:createExtraCategory', (_, data) => db.createExtraCategory(data));
  ipcMain.handle('db:updateExtraCategory', (_, id, data) => db.updateExtraCategory(id, data));
  ipcMain.handle('db:deleteExtraCategory', (_, id) => db.deleteExtraCategory(id));
  ipcMain.handle('db:getExtraCategoryItems', (_, categoryId) => db.getExtraCategoryItems(categoryId));
  ipcMain.handle('db:createExtraCategoryItem', (_, data) => db.createExtraCategoryItem(data));
  ipcMain.handle('db:updateExtraCategoryItem', (_, id, data) => db.updateExtraCategoryItem(id, data));
  ipcMain.handle('db:deleteExtraCategoryItem', (_, id) => db.deleteExtraCategoryItem(id));

  // =============================================
  // PRODUCT COMPLEMENT GROUPS
  // =============================================
  ipcMain.handle('db:getProductComplementGroups', (_, productId) => db.getProductComplementGroups(productId));
  ipcMain.handle('db:createProductComplementGroup', (_, data) => db.createProductComplementGroup(data));
  ipcMain.handle('db:updateProductComplementGroup', (_, id, data) => db.updateProductComplementGroup(id, data));
  ipcMain.handle('db:deleteProductComplementGroup', (_, id) => db.deleteProductComplementGroup(id));
  ipcMain.handle('db:deleteProductComplementGroupsByProduct', (_, productId) => db.deleteProductComplementGroupsByProduct(productId));

  // =============================================
  // CUSTOMERS
  // =============================================
  ipcMain.handle('db:getCustomers', (_, restaurantId) => db.getCustomers(restaurantId));
  ipcMain.handle('db:getCustomerByCpf', (_, restaurantId, cpf) => db.getCustomerByCpf(restaurantId, cpf));
  ipcMain.handle('db:getCustomerByPhone', (_, restaurantId, phone) => db.getCustomerByPhone(restaurantId, phone));
  ipcMain.handle('db:createCustomer', (_, data) => db.createCustomer(data));
  ipcMain.handle('db:updateCustomer', (_, id, data) => db.updateCustomer(id, data));
  ipcMain.handle('db:deleteCustomer', (_, id) => db.deleteCustomer(id));
  ipcMain.handle('db:getCustomerAddresses', (_, customerCpf) => db.getCustomerAddresses(customerCpf));
  ipcMain.handle('db:createCustomerAddress', (_, data) => db.createCustomerAddress(data));
  ipcMain.handle('db:updateCustomerAddress', (_, id, data) => db.updateCustomerAddress(id, data));
  ipcMain.handle('db:deleteCustomerAddress', (_, id) => db.deleteCustomerAddress(id));

  // =============================================
  // LOYALTY
  // =============================================
  ipcMain.handle('db:getLoyaltyPoints', (_, restaurantId, customerCpf) => db.getLoyaltyPoints(restaurantId, customerCpf));
  ipcMain.handle('db:createOrUpdateLoyaltyPoints', (_, data) => db.createOrUpdateLoyaltyPoints(data));
  ipcMain.handle('db:getLoyaltyTransactions', (_, restaurantId, customerCpf) => db.getLoyaltyTransactions(restaurantId, customerCpf));
  ipcMain.handle('db:createLoyaltyTransaction', (_, data) => db.createLoyaltyTransaction(data));

  // =============================================
  // COUPONS
  // =============================================
  ipcMain.handle('db:getCoupons', (_, restaurantId) => db.getCoupons(restaurantId));
  ipcMain.handle('db:getCouponByCode', (_, restaurantId, code) => db.getCouponByCode(restaurantId, code));
  ipcMain.handle('db:createCoupon', (_, data) => db.createCoupon(data));
  ipcMain.handle('db:updateCoupon', (_, id, data) => db.updateCoupon(id, data));
  ipcMain.handle('db:deleteCoupon', (_, id) => db.deleteCoupon(id));
  ipcMain.handle('db:incrementCouponUsage', (_, id) => db.incrementCouponUsage(id));

  // =============================================
  // DELIVERY
  // =============================================
  ipcMain.handle('db:getDeliveryConfig', (_, restaurantId) => db.getDeliveryConfig(restaurantId));
  ipcMain.handle('db:createOrUpdateDeliveryConfig', (_, data) => db.createOrUpdateDeliveryConfig(data));
  ipcMain.handle('db:getDeliveryZones', (_, restaurantId) => db.getDeliveryZones(restaurantId));
  ipcMain.handle('db:getDeliveryZoneByZip', (_, restaurantId, zipCode) => db.getDeliveryZoneByZip(restaurantId, zipCode));
  ipcMain.handle('db:createDeliveryZone', (_, data) => db.createDeliveryZone(data));
  ipcMain.handle('db:updateDeliveryZone', (_, id, data) => db.updateDeliveryZone(id, data));
  ipcMain.handle('db:deleteDeliveryZone', (_, id) => db.deleteDeliveryZone(id));

  // =============================================
  // BUSINESS HOURS
  // =============================================
  ipcMain.handle('db:getBusinessHours', (_, restaurantId) => db.getBusinessHours(restaurantId));
  ipcMain.handle('db:createOrUpdateBusinessHours', (_, data) => db.createOrUpdateBusinessHours(data));

  // =============================================
  // PAYMENT METHODS
  // =============================================
  ipcMain.handle('db:getPaymentMethods', (_, restaurantId) => db.getPaymentMethods(restaurantId));
  ipcMain.handle('db:getActivePaymentMethods', (_, restaurantId) => db.getActivePaymentMethods(restaurantId));
  ipcMain.handle('db:createPaymentMethod', (_, data) => db.createPaymentMethod(data));
  ipcMain.handle('db:updatePaymentMethod', (_, id, data) => db.updatePaymentMethod(id, data));
  ipcMain.handle('db:deletePaymentMethod', (_, id) => db.deletePaymentMethod(id));
  ipcMain.handle('db:getCardFeesConfig', (_, restaurantId) => db.getCardFeesConfig(restaurantId));
  ipcMain.handle('db:createOrUpdateCardFeesConfig', (_, data) => db.createOrUpdateCardFeesConfig(data));

  // =============================================
  // COSTS
  // =============================================
  ipcMain.handle('db:getFixedCosts', (_, restaurantId) => db.getFixedCosts(restaurantId));
  ipcMain.handle('db:createFixedCost', (_, data) => db.createFixedCost(data));
  ipcMain.handle('db:updateFixedCost', (_, id, data) => db.updateFixedCost(id, data));
  ipcMain.handle('db:deleteFixedCost', (_, id) => db.deleteFixedCost(id));
  ipcMain.handle('db:getVariableCosts', (_, restaurantId) => db.getVariableCosts(restaurantId));
  ipcMain.handle('db:createVariableCost', (_, data) => db.createVariableCost(data));
  ipcMain.handle('db:updateVariableCost', (_, id, data) => db.updateVariableCost(id, data));
  ipcMain.handle('db:deleteVariableCost', (_, id) => db.deleteVariableCost(id));
  ipcMain.handle('db:getLaborCosts', (_, restaurantId) => db.getLaborCosts(restaurantId));
  ipcMain.handle('db:createLaborCost', (_, data) => db.createLaborCost(data));
  ipcMain.handle('db:updateLaborCost', (_, id, data) => db.updateLaborCost(id, data));
  ipcMain.handle('db:deleteLaborCost', (_, id) => db.deleteLaborCost(id));
  ipcMain.handle('db:getOperationalCosts', (_, restaurantId, monthYear) => db.getOperationalCosts(restaurantId, monthYear));
  ipcMain.handle('db:createOrUpdateOperationalCosts', (_, data) => db.createOrUpdateOperationalCosts(data));

  // =============================================
  // REVIEWS
  // =============================================
  ipcMain.handle('db:getReviews', (_, restaurantId) => db.getReviews(restaurantId));
  ipcMain.handle('db:createReview', (_, data) => db.createReview(data));

  // =============================================
  // WHATSAPP CONFIG
  // =============================================
  ipcMain.handle('db:getWhatsAppConfig', (_, restaurantId) => db.getWhatsAppConfig(restaurantId));
  ipcMain.handle('db:createOrUpdateWhatsAppConfig', (_, data) => db.createOrUpdateWhatsAppConfig(data));

  // =============================================
  // AUTH
  // =============================================
  ipcMain.handle('db:login', (_, username, password) => db.login(username, password));
  ipcMain.handle('db:createUser', (_, data) => db.createUser(data));
  ipcMain.handle('db:createRestaurantCredentials', (_, data) => db.createRestaurantCredentials(data));

  // =============================================
  // REPORTS
  // =============================================
  ipcMain.handle('db:getOrdersForPeriod', (_, restaurantId, startDate, endDate) => db.getOrdersForPeriod(restaurantId, startDate, endDate));
  ipcMain.handle('db:getSalesReport', (_, restaurantId, startDate, endDate) => db.getSalesReport(restaurantId, startDate, endDate));
  ipcMain.handle('db:getCounterOrdersForPeriod', (_, restaurantId, startDate, endDate) => db.getCounterOrdersForPeriod(restaurantId, startDate, endDate));

  // =============================================
  // BACKUP
  // =============================================
  ipcMain.handle('backup:create', (_, type) => backupService.createBackup(type));
  ipcMain.handle('backup:restore', (_, filePath) => backupService.restoreBackup(filePath));
  ipcMain.handle('backup:list', (_, type) => fileManager.listBackups(type));
  ipcMain.handle('backup:stats', () => backupService.getBackupStats());
  ipcMain.handle('backup:export', async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `menus-backup-${new Date().toISOString().split('T')[0]}.json`,
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });
    if (!result.canceled && result.filePath) {
      return backupService.exportToJson(result.filePath);
    }
    return { success: false, error: 'Cancelled' };
  });
  ipcMain.handle('backup:import', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });
    if (!result.canceled && result.filePaths[0]) {
      return backupService.importFromJson(result.filePaths[0]);
    }
    return { success: false, error: 'Cancelled' };
  });

  // =============================================
  // IMAGE STORAGE
  // =============================================
  ipcMain.handle('images:saveFromBase64', (_, type, fileName, base64Data) => imageStorage.saveFromBase64(type, fileName, base64Data));
  ipcMain.handle('images:saveFromUrl', async (_, type, fileName, url) => imageStorage.saveFromUrl(type, fileName, url));
  ipcMain.handle('images:delete', (_, filePath) => imageStorage.deleteImage(filePath));
  ipcMain.handle('images:list', (_, type) => {
    switch (type) {
      case 'product': return imageStorage.listProductImages();
      case 'logo': return imageStorage.listLogoImages();
      case 'banner': return imageStorage.listBannerImages();
      default: return [];
    }
  });
  ipcMain.handle('images:stats', () => imageStorage.getStorageStats());
  ipcMain.handle('images:selectFile', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }]
    });
    if (!result.canceled && result.filePaths[0]) {
      return { success: true, path: result.filePaths[0] };
    }
    return { success: false };
  });

  // =============================================
  // FILE MANAGER
  // =============================================
  ipcMain.handle('files:getConfig', () => fileManager.getConfig());
  ipcMain.handle('files:updateConfig', (_, updates) => fileManager.updateConfig(updates));
  ipcMain.handle('files:setCloudConfig', (_, url, key) => fileManager.setCloudConfig(url, key));
  ipcMain.handle('files:disableCloudSync', () => fileManager.disableCloudSync());
  ipcMain.handle('files:getStorageInfo', () => fileManager.getStorageInfo());
  ipcMain.handle('files:openDataFolder', () => {
    shell.openPath(fileManager.getPath('base'));
    return { success: true };
  });

  // =============================================
  // EVENTS (for realtime)
  // =============================================
  ipcMain.handle('events:subscribe', (event, channel, table) => {
    // The renderer will handle subscriptions via the preload script
    return { success: true };
  });
}

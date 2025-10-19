const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('./database');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let db;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../public/favicon.ico')
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
}

app.whenReady().then(() => {
  // Initialize database
  db = new Database();
  
  // Setup IPC handlers
  setupIpcHandlers();
  
  createWindow();

  // Check for updates (only in production)
  if (process.env.NODE_ENV !== 'development') {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    db.close();
    app.quit();
  }
});

function setupIpcHandlers() {
  // Restaurants
  ipcMain.handle('db:getRestaurants', () => db.getRestaurants());
  ipcMain.handle('db:getRestaurantBySlug', (_, slug) => db.getRestaurantBySlug(slug));
  ipcMain.handle('db:createRestaurant', (_, data) => db.createRestaurant(data));
  ipcMain.handle('db:updateRestaurant', (_, id, data) => db.updateRestaurant(id, data));
  ipcMain.handle('db:deleteRestaurant', (_, id) => db.deleteRestaurant(id));

  // Categories
  ipcMain.handle('db:getCategories', (_, restaurantId) => db.getCategories(restaurantId));
  ipcMain.handle('db:createCategory', (_, data) => db.createCategory(data));
  ipcMain.handle('db:updateCategory', (_, id, data) => db.updateCategory(id, data));
  ipcMain.handle('db:deleteCategory', (_, id) => db.deleteCategory(id));

  // Products
  ipcMain.handle('db:getProducts', (_, categoryId) => db.getProducts(categoryId));
  ipcMain.handle('db:getProductsByRestaurant', (_, restaurantId) => db.getProductsByRestaurant(restaurantId));
  ipcMain.handle('db:createProduct', (_, data) => db.createProduct(data));
  ipcMain.handle('db:updateProduct', (_, id, data) => db.updateProduct(id, data));
  ipcMain.handle('db:deleteProduct', (_, id) => db.deleteProduct(id));

  // Tables
  ipcMain.handle('db:getTables', (_, restaurantId) => db.getTables(restaurantId));
  ipcMain.handle('db:createTable', (_, data) => db.createTable(data));
  ipcMain.handle('db:updateTable', (_, id, data) => db.updateTable(id, data));
  ipcMain.handle('db:deleteTable', (_, id) => db.deleteTable(id));

  // Orders
  ipcMain.handle('db:getOrders', (_, restaurantId) => db.getOrders(restaurantId));
  ipcMain.handle('db:getOrdersByTable', (_, tableId) => db.getOrdersByTable(tableId));
  ipcMain.handle('db:createOrder', (_, data) => db.createOrder(data));
  ipcMain.handle('db:updateOrder', (_, id, data) => db.updateOrder(id, data));
  ipcMain.handle('db:deleteOrder', (_, id) => db.deleteOrder(id));

  // Order Items
  ipcMain.handle('db:getOrderItems', (_, orderId) => db.getOrderItems(orderId));
  ipcMain.handle('db:createOrderItem', (_, data) => db.createOrderItem(data));
  ipcMain.handle('db:deleteOrderItem', (_, id) => db.deleteOrderItem(id));

  // Bills
  ipcMain.handle('db:getBills', (_, restaurantId) => db.getBills(restaurantId));
  ipcMain.handle('db:createBill', (_, data) => db.createBill(data));
  ipcMain.handle('db:updateBill', (_, id, data) => db.updateBill(id, data));

  // Cash Register
  ipcMain.handle('db:getCashSessions', (_, restaurantId) => db.getCashSessions(restaurantId));
  ipcMain.handle('db:createCashSession', (_, data) => db.createCashSession(data));
  ipcMain.handle('db:updateCashSession', (_, id, data) => db.updateCashSession(id, data));
  ipcMain.handle('db:getCashMovements', (_, sessionId) => db.getCashMovements(sessionId));
  ipcMain.handle('db:createCashMovement', (_, data) => db.createCashMovement(data));

  // Stock
  ipcMain.handle('db:getStockItems', (_, restaurantId) => db.getStockItems(restaurantId));
  ipcMain.handle('db:createStockItem', (_, data) => db.createStockItem(data));
  ipcMain.handle('db:updateStockItem', (_, id, data) => db.updateStockItem(id, data));
  ipcMain.handle('db:deleteStockItem', (_, id) => db.deleteStockItem(id));
  ipcMain.handle('db:getStockCategories', (_, restaurantId) => db.getStockCategories(restaurantId));
  ipcMain.handle('db:createStockCategory', (_, data) => db.createStockCategory(data));

  // Product Extras
  ipcMain.handle('db:getProductExtras', (_, productId) => db.getProductExtras(productId));
  ipcMain.handle('db:createProductExtra', (_, data) => db.createProductExtra(data));
  ipcMain.handle('db:updateProductExtra', (_, id, data) => db.updateProductExtra(id, data));
  ipcMain.handle('db:deleteProductExtra', (_, id) => db.deleteProductExtra(id));

  // Auth
  ipcMain.handle('db:login', (_, username, password) => db.login(username, password));
  ipcMain.handle('db:createUser', (_, data) => db.createUser(data));
  
  // App version
  ipcMain.handle('app:getVersion', () => app.getVersion());
}

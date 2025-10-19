/// <reference types="vite/client" />

interface Window {
  electronDB?: {
    // Restaurants
    getRestaurants: () => Promise<any[]>;
    getRestaurantBySlug: (slug: string) => Promise<any>;
    createRestaurant: (data: any) => Promise<any>;
    updateRestaurant: (id: string, data: any) => Promise<void>;
    deleteRestaurant: (id: string) => Promise<void>;

    // Categories
    getCategories: (restaurantId: string) => Promise<any[]>;
    createCategory: (data: any) => Promise<any>;
    updateCategory: (id: string, data: any) => Promise<void>;
    deleteCategory: (id: string) => Promise<void>;

    // Products
    getProducts: (categoryId: string) => Promise<any[]>;
    getProductsByRestaurant: (restaurantId: string) => Promise<any[]>;
    createProduct: (data: any) => Promise<any>;
    updateProduct: (id: string, data: any) => Promise<void>;
    deleteProduct: (id: string) => Promise<void>;

    // Tables
    getTables: (restaurantId: string) => Promise<any[]>;
    createTable: (data: any) => Promise<any>;
    updateTable: (id: string, data: any) => Promise<void>;
    deleteTable: (id: string) => Promise<void>;

    // Orders
    getOrders: (restaurantId: string) => Promise<any[]>;
    getOrdersByTable: (tableId: string) => Promise<any[]>;
    createOrder: (data: any) => Promise<any>;
    updateOrder: (id: string, data: any) => Promise<void>;
    deleteOrder: (id: string) => Promise<void>;

    // Order Items
    getOrderItems: (orderId: string) => Promise<any[]>;
    createOrderItem: (data: any) => Promise<any>;
    deleteOrderItem: (id: string) => Promise<void>;

    // Bills
    getBills: (restaurantId: string) => Promise<any[]>;
    createBill: (data: any) => Promise<any>;
    updateBill: (id: string, data: any) => Promise<void>;

    // Cash Register
    getCashSessions: (restaurantId: string) => Promise<any[]>;
    createCashSession: (data: any) => Promise<any>;
    updateCashSession: (id: string, data: any) => Promise<void>;
    getCashMovements: (sessionId: string) => Promise<any[]>;
    createCashMovement: (data: any) => Promise<any>;

    // Stock
    getStockItems: (restaurantId: string) => Promise<any[]>;
    createStockItem: (data: any) => Promise<any>;
    updateStockItem: (id: string, data: any) => Promise<void>;
    deleteStockItem: (id: string) => Promise<void>;
    getStockCategories: (restaurantId: string) => Promise<any[]>;
    createStockCategory: (data: any) => Promise<any>;

    // Product Extras
    getProductExtras: (productId: string) => Promise<any[]>;
    createProductExtra: (data: any) => Promise<any>;
    updateProductExtra: (id: string, data: any) => Promise<void>;
    deleteProductExtra: (id: string) => Promise<void>;

    // Auth
    login: (username: string, password: string) => Promise<any>;
    createUser: (data: any) => Promise<any>;
    
    // App
    getVersion: () => Promise<string>;
  };
  isElectron?: boolean;
}

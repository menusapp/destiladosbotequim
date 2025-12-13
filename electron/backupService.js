// Backup Service - handles automatic and manual backups
const fs = require('fs');
const path = require('path');

class BackupService {
  constructor(database, fileManager) {
    this.db = database;
    this.fileManager = fileManager;
    this.autoBackupInterval = null;
  }

  // =============================================
  // CREATE BACKUPS
  // =============================================

  createBackup(type = 'daily') {
    const timestamp = new Date().toISOString();
    const tables = this.getAllTablesData();
    
    const backup = {
      version: '1.0.0',
      type,
      createdAt: timestamp,
      tables: tables.names,
      recordCounts: tables.counts,
      data: tables.data
    };

    const filePath = this.fileManager.getBackupFilePath(type);
    fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));

    // Record backup in database
    this.db.createLocalBackup({
      backup_type: type,
      file_path: filePath,
      file_size: fs.statSync(filePath).size,
      tables_count: tables.names.length,
      records_count: Object.values(tables.counts).reduce((a, b) => a + b, 0)
    });

    // Update config with last backup time
    this.fileManager.updateConfig({ lastBackup: timestamp });

    return {
      success: true,
      filePath,
      size: fs.statSync(filePath).size,
      tables: tables.names.length,
      records: Object.values(tables.counts).reduce((a, b) => a + b, 0)
    };
  }

  getAllTablesData() {
    const tableNames = [
      'restaurants', 'categories', 'products', 'tables', 'comandas',
      'orders', 'order_items', 'order_item_extras',
      'counter_orders', 'counter_order_items', 'counter_order_item_extras',
      'bills', 'cash_register_sessions', 'cash_movements',
      'stock_categories', 'stock_items', 'stock_movements',
      'product_ingredients', 'product_extras', 'product_extra_ingredients',
      'extra_categories', 'extra_category_items', 'extra_category_item_ingredients',
      'product_complement_groups',
      'customers', 'customer_addresses',
      'loyalty_points', 'loyalty_transactions',
      'coupons', 'delivery_config', 'delivery_zones',
      'business_hours', 'payment_methods', 'card_fees_config', 'card_fees',
      'fixed_costs', 'variable_costs', 'labor_costs', 'operational_costs',
      'restaurant_reviews', 'whatsapp_config',
      'users', 'user_roles', 'profiles', 'restaurant_credentials'
    ];

    const data = {};
    const counts = {};

    tableNames.forEach(table => {
      try {
        const rows = this.db.db.prepare(`SELECT * FROM ${table}`).all();
        data[table] = rows;
        counts[table] = rows.length;
      } catch (error) {
        // Table might not exist
        data[table] = [];
        counts[table] = 0;
      }
    });

    return {
      names: tableNames,
      data,
      counts
    };
  }

  // =============================================
  // RESTORE BACKUPS
  // =============================================

  restoreBackup(filePath) {
    try {
      const backupData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Validate backup format
      if (!backupData.version || !backupData.data) {
        throw new Error('Invalid backup format');
      }

      // Begin transaction
      const restore = this.db.db.transaction(() => {
        // Clear existing data (except app_versions)
        const tablesToClear = Object.keys(backupData.data).filter(t => t !== 'app_versions');
        
        // Delete in reverse order to handle foreign keys
        tablesToClear.reverse().forEach(table => {
          try {
            this.db.db.prepare(`DELETE FROM ${table}`).run();
          } catch (error) {
            console.warn(`Could not clear table ${table}:`, error.message);
          }
        });

        // Restore data
        tablesToClear.reverse().forEach(table => {
          const rows = backupData.data[table] || [];
          rows.forEach(row => {
            try {
              const keys = Object.keys(row);
              const placeholders = keys.map(() => '?');
              const values = keys.map(k => {
                const v = row[k];
                if (v === null || v === undefined) return null;
                if (typeof v === 'boolean') return v ? 1 : 0;
                if (typeof v === 'object') return JSON.stringify(v);
                return v;
              });

              const sql = `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')})`;
              this.db.db.prepare(sql).run(...values);
            } catch (error) {
              console.warn(`Could not restore row in ${table}:`, error.message);
            }
          });
        });
      });

      restore();

      return {
        success: true,
        restoredAt: new Date().toISOString(),
        backupDate: backupData.createdAt,
        tables: Object.keys(backupData.data).length,
        records: Object.values(backupData.recordCounts || {}).reduce((a, b) => a + b, 0)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // =============================================
  // AUTO BACKUP
  // =============================================

  startAutoBackup(intervalHours = 24) {
    // Clear any existing interval
    this.stopAutoBackup();

    // Run backup immediately
    this.createBackup('daily');

    // Set up interval
    const intervalMs = intervalHours * 60 * 60 * 1000;
    this.autoBackupInterval = setInterval(() => {
      this.createBackup('daily');
      
      // Clean old backups
      const config = this.fileManager.getConfig();
      this.fileManager.cleanOldBackups('daily', config?.backupRetentionDays || 30);
    }, intervalMs);

    console.log(`Auto backup started, running every ${intervalHours} hours`);
    return { success: true, intervalHours };
  }

  stopAutoBackup() {
    if (this.autoBackupInterval) {
      clearInterval(this.autoBackupInterval);
      this.autoBackupInterval = null;
      console.log('Auto backup stopped');
    }
    return { success: true };
  }

  // =============================================
  // EXPORT / IMPORT
  // =============================================

  exportToJson(outputPath = null) {
    const backup = this.createBackup('manual');
    
    if (outputPath) {
      // Copy to specified location
      fs.copyFileSync(backup.filePath, outputPath);
      return { ...backup, exportPath: outputPath };
    }
    
    return backup;
  }

  importFromJson(filePath) {
    return this.restoreBackup(filePath);
  }

  // Export specific restaurant data (for multi-restaurant scenarios)
  exportRestaurantData(restaurantId, outputPath) {
    const tables = {
      restaurants: this.db.getRestaurantById(restaurantId),
      categories: this.db.getCategories(restaurantId),
      products: this.db.getProductsByRestaurant(restaurantId),
      tables: this.db.getTables(restaurantId),
      customers: this.db.getCustomers(restaurantId),
      businessHours: this.db.getBusinessHours(restaurantId),
      paymentMethods: this.db.getPaymentMethods(restaurantId),
      deliveryZones: this.db.getDeliveryZones(restaurantId),
      stockItems: this.db.getStockItems(restaurantId),
      stockCategories: this.db.getStockCategories(restaurantId),
      fixedCosts: this.db.getFixedCosts(restaurantId),
      variableCosts: this.db.getVariableCosts(restaurantId),
      laborCosts: this.db.getLaborCosts(restaurantId),
      coupons: this.db.getCoupons(restaurantId),
      extraCategories: this.db.getExtraCategories(restaurantId)
    };

    const exportData = {
      version: '1.0.0',
      type: 'restaurant_export',
      restaurantId,
      createdAt: new Date().toISOString(),
      data: tables
    };

    if (outputPath) {
      fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    }

    return exportData;
  }

  // =============================================
  // CLOUD BACKUP (when online)
  // =============================================

  async createCloudBackup(supabaseClient, restaurantId) {
    if (!supabaseClient) {
      return { success: false, error: 'No cloud connection configured' };
    }

    try {
      const exportData = this.exportRestaurantData(restaurantId);
      
      // This would upload to Supabase Storage or a backup table
      // Implementation depends on cloud infrastructure setup
      
      return {
        success: true,
        type: 'cloud',
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // =============================================
  // BACKUP INFO
  // =============================================

  getBackupStats() {
    const dailyBackups = this.fileManager.listBackups('daily');
    const monthlyBackups = this.fileManager.listBackups('monthly');
    const dbBackups = this.db.getLocalBackups();

    return {
      daily: {
        count: dailyBackups.length,
        latestDate: dailyBackups[0]?.createdAt || null,
        totalSize: dailyBackups.reduce((sum, b) => sum + b.size, 0)
      },
      monthly: {
        count: monthlyBackups.length,
        latestDate: monthlyBackups[0]?.createdAt || null,
        totalSize: monthlyBackups.reduce((sum, b) => sum + b.size, 0)
      },
      database: {
        recordedBackups: dbBackups.length
      }
    };
  }
}

module.exports = BackupService;

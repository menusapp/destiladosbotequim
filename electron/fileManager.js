// File Manager - handles local folder structure, images, and backups
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

class FileManager {
  constructor() {
    this.userDataPath = app ? app.getPath('userData') : '.';
    this.basePath = path.join(this.userDataPath, 'MenusData');
    
    this.paths = {
      base: this.basePath,
      database: path.join(this.basePath, 'database'),
      images: path.join(this.basePath, 'images'),
      productImages: path.join(this.basePath, 'images', 'products'),
      logos: path.join(this.basePath, 'images', 'logos'),
      banners: path.join(this.basePath, 'images', 'banners'),
      backups: path.join(this.basePath, 'backups'),
      dailyBackups: path.join(this.basePath, 'backups', 'daily'),
      monthlyBackups: path.join(this.basePath, 'backups', 'monthly'),
      config: path.join(this.basePath, 'config'),
      temp: path.join(this.basePath, 'temp')
    };
    
    this.initializeFolders();
  }

  initializeFolders() {
    // Create all required folders
    Object.values(this.paths).forEach(folderPath => {
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
        console.log(`Created folder: ${folderPath}`);
      }
    });

    // Create default config file if not exists
    const configPath = path.join(this.paths.config, 'settings.json');
    if (!fs.existsSync(configPath)) {
      const defaultConfig = {
        version: '1.0.0',
        autoBackup: true,
        backupRetentionDays: 30,
        cloudSyncEnabled: false,
        supabaseUrl: null,
        supabaseAnonKey: null,
        lastBackup: null,
        createdAt: new Date().toISOString()
      };
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
      console.log('Created default config file');
    }
  }

  getPath(type) {
    return this.paths[type] || this.paths.base;
  }

  getDatabasePath() {
    return path.join(this.paths.database, 'menus-local.db');
  }

  // =============================================
  // IMAGE MANAGEMENT
  // =============================================

  saveImage(type, fileName, buffer) {
    let targetFolder;
    
    switch (type) {
      case 'product':
        targetFolder = this.paths.productImages;
        break;
      case 'logo':
        targetFolder = this.paths.logos;
        break;
      case 'banner':
        targetFolder = this.paths.banners;
        break;
      default:
        targetFolder = this.paths.images;
    }

    // Generate unique filename if needed
    const ext = path.extname(fileName) || '.jpg';
    const baseName = path.basename(fileName, ext);
    const uniqueName = `${baseName}_${Date.now()}${ext}`;
    const filePath = path.join(targetFolder, uniqueName);

    fs.writeFileSync(filePath, buffer);
    
    // Return local file URL
    return `file://${filePath}`;
  }

  saveImageFromBase64(type, fileName, base64Data) {
    // Remove data URL prefix if present
    const base64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    return this.saveImage(type, fileName, buffer);
  }

  saveImageFromUrl(type, fileName, url) {
    // For now, just return the URL - actual download would be done in main process
    return url;
  }

  getImagePath(type, fileName) {
    let folder;
    
    switch (type) {
      case 'product':
        folder = this.paths.productImages;
        break;
      case 'logo':
        folder = this.paths.logos;
        break;
      case 'banner':
        folder = this.paths.banners;
        break;
      default:
        folder = this.paths.images;
    }

    const filePath = path.join(folder, fileName);
    return fs.existsSync(filePath) ? `file://${filePath}` : null;
  }

  deleteImage(filePath) {
    try {
      // Handle file:// URLs
      const cleanPath = filePath.replace('file://', '');
      if (fs.existsSync(cleanPath)) {
        fs.unlinkSync(cleanPath);
        return true;
      }
    } catch (error) {
      console.error('Error deleting image:', error);
    }
    return false;
  }

  listImages(type) {
    let folder;
    
    switch (type) {
      case 'product':
        folder = this.paths.productImages;
        break;
      case 'logo':
        folder = this.paths.logos;
        break;
      case 'banner':
        folder = this.paths.banners;
        break;
      default:
        folder = this.paths.images;
    }

    try {
      return fs.readdirSync(folder).map(file => ({
        name: file,
        path: `file://${path.join(folder, file)}`
      }));
    } catch (error) {
      return [];
    }
  }

  // =============================================
  // CONFIG MANAGEMENT
  // =============================================

  getConfig() {
    const configPath = path.join(this.paths.config, 'settings.json');
    try {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  updateConfig(updates) {
    const configPath = path.join(this.paths.config, 'settings.json');
    const current = this.getConfig() || {};
    const updated = { ...current, ...updates, updatedAt: new Date().toISOString() };
    fs.writeFileSync(configPath, JSON.stringify(updated, null, 2));
    return updated;
  }

  setCloudConfig(supabaseUrl, supabaseAnonKey) {
    return this.updateConfig({
      cloudSyncEnabled: true,
      supabaseUrl,
      supabaseAnonKey
    });
  }

  disableCloudSync() {
    return this.updateConfig({
      cloudSyncEnabled: false,
      supabaseUrl: null,
      supabaseAnonKey: null
    });
  }

  // =============================================
  // BACKUP UTILITIES
  // =============================================

  getBackupFilePath(type = 'daily') {
    const folder = type === 'monthly' ? this.paths.monthlyBackups : this.paths.dailyBackups;
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toISOString().split('T')[1].replace(/:/g, '-').split('.')[0];
    return path.join(folder, `backup_${date}_${time}.json`);
  }

  listBackups(type = 'daily') {
    const folder = type === 'monthly' ? this.paths.monthlyBackups : this.paths.dailyBackups;
    
    try {
      return fs.readdirSync(folder)
        .filter(file => file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(folder, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            path: filePath,
            size: stats.size,
            createdAt: stats.birthtime
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      return [];
    }
  }

  cleanOldBackups(type = 'daily', retentionDays = 30) {
    const folder = type === 'monthly' ? this.paths.monthlyBackups : this.paths.dailyBackups;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      const files = fs.readdirSync(folder);
      let deletedCount = 0;

      files.forEach(file => {
        const filePath = path.join(folder, file);
        const stats = fs.statSync(filePath);
        
        if (stats.birthtime < cutoffDate) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      });

      return { success: true, deletedCount };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // =============================================
  // TEMP FILES
  // =============================================

  saveTempFile(fileName, data) {
    const filePath = path.join(this.paths.temp, fileName);
    fs.writeFileSync(filePath, data);
    return filePath;
  }

  getTempFilePath(fileName) {
    return path.join(this.paths.temp, fileName);
  }

  cleanTempFiles() {
    try {
      const files = fs.readdirSync(this.paths.temp);
      files.forEach(file => {
        fs.unlinkSync(path.join(this.paths.temp, file));
      });
      return { success: true, deletedCount: files.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // =============================================
  // UTILITIES
  // =============================================

  getStorageInfo() {
    const calculateFolderSize = (folderPath) => {
      let size = 0;
      try {
        const files = fs.readdirSync(folderPath);
        files.forEach(file => {
          const filePath = path.join(folderPath, file);
          const stats = fs.statSync(filePath);
          if (stats.isDirectory()) {
            size += calculateFolderSize(filePath);
          } else {
            size += stats.size;
          }
        });
      } catch (error) {
        // Folder doesn't exist or isn't accessible
      }
      return size;
    };

    return {
      basePath: this.basePath,
      database: calculateFolderSize(this.paths.database),
      images: calculateFolderSize(this.paths.images),
      backups: calculateFolderSize(this.paths.backups),
      total: calculateFolderSize(this.basePath)
    };
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = FileManager;

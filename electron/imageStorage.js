// Image Storage Service - handles local image storage and management
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

class ImageStorage {
  constructor(fileManager) {
    this.fileManager = fileManager;
  }

  // =============================================
  // SAVE IMAGES
  // =============================================

  saveFromBuffer(type, fileName, buffer) {
    return this.fileManager.saveImage(type, fileName, buffer);
  }

  saveFromBase64(type, fileName, base64Data) {
    return this.fileManager.saveImageFromBase64(type, fileName, base64Data);
  }

  async saveFromUrl(type, fileName, url) {
    return new Promise((resolve, reject) => {
      // Determine protocol
      const protocol = url.startsWith('https') ? https : http;
      
      protocol.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          // Handle redirect
          this.saveFromUrl(type, fileName, response.headers.location)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: ${response.statusCode}`));
          return;
        }

        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const localPath = this.saveFromBuffer(type, fileName, buffer);
          resolve(localPath);
        });
        response.on('error', reject);
      }).on('error', reject);
    });
  }

  saveFromFile(type, sourcePath) {
    try {
      const buffer = fs.readFileSync(sourcePath);
      const fileName = path.basename(sourcePath);
      return this.saveFromBuffer(type, fileName, buffer);
    } catch (error) {
      console.error('Error saving from file:', error);
      return null;
    }
  }

  // =============================================
  // GET IMAGES
  // =============================================

  getImagePath(type, fileName) {
    return this.fileManager.getImagePath(type, fileName);
  }

  getImageUrl(localPath) {
    // Convert local path to file:// URL for use in <img> tags
    if (!localPath) return null;
    if (localPath.startsWith('file://')) return localPath;
    if (localPath.startsWith('http://') || localPath.startsWith('https://')) return localPath;
    return `file://${localPath}`;
  }

  // Check if URL is local (file://) or remote (http/https)
  isLocalImage(url) {
    return url && url.startsWith('file://');
  }

  // =============================================
  // DELETE IMAGES
  // =============================================

  deleteImage(filePath) {
    return this.fileManager.deleteImage(filePath);
  }

  deleteProductImage(productId, imageUrl) {
    if (this.isLocalImage(imageUrl)) {
      return this.deleteImage(imageUrl);
    }
    return false; // Don't delete remote images
  }

  // =============================================
  // LIST IMAGES
  // =============================================

  listProductImages() {
    return this.fileManager.listImages('product');
  }

  listLogoImages() {
    return this.fileManager.listImages('logo');
  }

  listBannerImages() {
    return this.fileManager.listImages('banner');
  }

  // =============================================
  // IMAGE PROCESSING
  // =============================================

  // Generate a unique filename
  generateFileName(originalName, prefix = '') {
    const ext = path.extname(originalName) || '.jpg';
    const baseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}${baseName}_${timestamp}_${random}${ext}`;
  }

  // Get image dimensions (would require additional library like sharp)
  async getImageDimensions(filePath) {
    // Placeholder - would need image processing library
    return { width: null, height: null };
  }

  // =============================================
  // STORAGE INFO
  // =============================================

  getStorageStats() {
    const productImages = this.listProductImages();
    const logos = this.listLogoImages();
    const banners = this.listBannerImages();

    const calculateSize = (images) => {
      return images.reduce((sum, img) => {
        try {
          const filePath = img.path.replace('file://', '');
          const stats = fs.statSync(filePath);
          return sum + stats.size;
        } catch {
          return sum;
        }
      }, 0);
    };

    return {
      products: {
        count: productImages.length,
        size: calculateSize(productImages)
      },
      logos: {
        count: logos.length,
        size: calculateSize(logos)
      },
      banners: {
        count: banners.length,
        size: calculateSize(banners)
      },
      total: {
        count: productImages.length + logos.length + banners.length,
        size: calculateSize(productImages) + calculateSize(logos) + calculateSize(banners)
      }
    };
  }

  // =============================================
  // CLEANUP
  // =============================================

  // Find orphaned images (not referenced by any product)
  findOrphanedImages(db) {
    const productImages = this.listProductImages();
    const products = db.db.prepare('SELECT image_url FROM products WHERE image_url IS NOT NULL').all();
    const usedUrls = new Set(products.map(p => p.image_url));

    return productImages.filter(img => !usedUrls.has(img.path));
  }

  // Clean up orphaned images
  cleanupOrphanedImages(db) {
    const orphaned = this.findOrphanedImages(db);
    let deletedCount = 0;

    orphaned.forEach(img => {
      if (this.deleteImage(img.path)) {
        deletedCount++;
      }
    });

    return {
      found: orphaned.length,
      deleted: deletedCount
    };
  }
}

module.exports = ImageStorage;

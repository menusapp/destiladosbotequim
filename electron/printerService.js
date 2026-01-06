// Printer Service - Manages thermal printer operations
const { BrowserWindow } = require('electron');

class PrinterService {
  constructor() {
    this.mainWindow = null;
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  // Get list of all system printers
  async getPrinters() {
    if (!this.mainWindow) {
      return [];
    }
    
    try {
      const printers = await this.mainWindow.webContents.getPrintersAsync();
      return printers.map(printer => ({
        name: printer.name,
        displayName: printer.displayName || printer.name,
        description: printer.description || '',
        status: printer.status,
        isDefault: printer.isDefault
      }));
    } catch (error) {
      console.error('Error getting printers:', error);
      return [];
    }
  }

  // Print receipt/comanda content
  async print(printerName, content, options = {}) {
    if (!this.mainWindow) {
      return { success: false, error: 'Main window not available' };
    }

    try {
      const paperSize = options.paperSize || '80mm';
      
      // Create hidden window for printing
      const printWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      // Load print content as HTML
      const htmlContent = this.generatePrintHtml(content, paperSize);
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

      // Wait for content to load
      await new Promise(resolve => setTimeout(resolve, 200));

      // Print silently
      const success = await printWindow.webContents.print({
        silent: true,
        printBackground: true,
        deviceName: printerName,
        margins: {
          marginType: 'none'
        }
      });

      printWindow.close();

      return { success: true };
    } catch (error) {
      console.error('Print error:', error);
      return { success: false, error: error.message };
    }
  }

  // Print test page
  async testPrint(printerName, paperSize = '80mm') {
    const testContent = {
      type: 'test',
      title: "Menu's - Teste de Impressão",
      lines: [
        { text: '================================', bold: true },
        { text: 'TESTE DE IMPRESSÃO', bold: true, center: true },
        { text: '================================', bold: true },
        { text: '' },
        { text: `Impressora: ${printerName}` },
        { text: `Papel: ${paperSize}` },
        { text: `Data: ${new Date().toLocaleString('pt-BR')}` },
        { text: '' },
        { text: '--------------------------------' },
        { text: 'Produto Exemplo          R$ 25,90' },
        { text: '  + Adicional             R$ 5,00' },
        { text: 'Outro Produto            R$ 18,50' },
        { text: '--------------------------------' },
        { text: 'TOTAL:                  R$ 49,40', bold: true },
        { text: '--------------------------------' },
        { text: '' },
        { text: 'Se você está lendo isso,', center: true },
        { text: 'a impressora está funcionando!', center: true },
        { text: '' },
        { text: '================================', bold: true },
      ]
    };

    return this.print(printerName, testContent, { paperSize });
  }

  // Generate HTML for printing
  generatePrintHtml(content, paperSize) {
    const widthMm = paperSize === '58mm' ? 48 : 72; // Account for margins
    const fontSize = paperSize === '58mm' ? '10px' : '12px';

    let bodyHtml = '';
    
    if (content.lines) {
      content.lines.forEach(line => {
        let style = `font-size: ${fontSize}; margin: 0; padding: 0; white-space: pre-wrap;`;
        if (line.bold) style += ' font-weight: bold;';
        if (line.center) style += ' text-align: center;';
        bodyHtml += `<p style="${style}">${line.text || '&nbsp;'}</p>`;
      });
    } else if (typeof content === 'string') {
      bodyHtml = `<pre style="font-size: ${fontSize}; margin: 0; font-family: monospace;">${content}</pre>`;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page {
            size: ${widthMm}mm auto;
            margin: 0;
          }
          body {
            font-family: 'Courier New', monospace;
            width: ${widthMm}mm;
            margin: 0;
            padding: 2mm;
            font-size: ${fontSize};
          }
          * {
            box-sizing: border-box;
          }
        </style>
      </head>
      <body>
        ${bodyHtml}
      </body>
      </html>
    `;
  }

  // Format order for printing (comanda)
  formatComanda(order, items, restaurantName) {
    const lines = [
      { text: '================================', bold: true },
      { text: restaurantName || 'COMANDA', bold: true, center: true },
      { text: '================================', bold: true },
      { text: '' },
      { text: `Pedido #${order.id?.slice(-6).toUpperCase() || '------'}`, bold: true },
      { text: `Mesa: ${order.table_number || '-'}` },
      { text: `Cliente: ${order.customer_name || '-'}` },
      { text: `Data: ${new Date(order.created_at).toLocaleString('pt-BR')}` },
      { text: '' },
      { text: '--------------------------------' },
    ];

    items.forEach(item => {
      const qty = item.quantity || 1;
      const name = item.product_name || item.name || 'Produto';
      lines.push({ text: `${qty}x ${name}`, bold: true });
      
      if (item.notes) {
        lines.push({ text: `   Obs: ${item.notes}` });
      }
      
      if (item.extras && item.extras.length > 0) {
        item.extras.forEach(extra => {
          lines.push({ text: `   + ${extra.name}` });
        });
      }
    });

    lines.push({ text: '--------------------------------' });
    
    if (order.notes) {
      lines.push({ text: '' });
      lines.push({ text: 'OBSERVAÇÕES:', bold: true });
      lines.push({ text: order.notes });
    }

    lines.push({ text: '' });
    lines.push({ text: '================================', bold: true });

    return { lines };
  }

  // Format receipt for printing (cupom)
  formatReceipt(order, items, restaurantName, payment) {
    const lines = [
      { text: '================================', bold: true },
      { text: restaurantName || 'CUPOM', bold: true, center: true },
      { text: '================================', bold: true },
      { text: '' },
      { text: `Pedido #${order.id?.slice(-6).toUpperCase() || '------'}` },
      { text: `Data: ${new Date().toLocaleString('pt-BR')}` },
      { text: `Cliente: ${order.customer_name || '-'}` },
      { text: '' },
      { text: '--------------------------------' },
    ];

    let subtotal = 0;
    items.forEach(item => {
      const qty = item.quantity || 1;
      const name = item.product_name || item.name || 'Produto';
      const price = item.price_at_order || item.price || 0;
      const itemTotal = qty * price;
      subtotal += itemTotal;

      const priceStr = `R$ ${itemTotal.toFixed(2).replace('.', ',')}`;
      const line = `${qty}x ${name}`.padEnd(24) + priceStr.padStart(8);
      lines.push({ text: line });

      if (item.extras && item.extras.length > 0) {
        item.extras.forEach(extra => {
          const extraPrice = extra.price_at_order || extra.price || 0;
          subtotal += extraPrice;
          lines.push({ text: `   + ${extra.name}` });
        });
      }
    });

    lines.push({ text: '--------------------------------' });
    lines.push({ text: `Subtotal:`.padEnd(24) + `R$ ${subtotal.toFixed(2).replace('.', ',')}`.padStart(8) });

    if (order.delivery_fee > 0) {
      lines.push({ text: `Taxa entrega:`.padEnd(24) + `R$ ${order.delivery_fee.toFixed(2).replace('.', ',')}`.padStart(8) });
      subtotal += order.delivery_fee;
    }

    if (order.coupon_discount > 0) {
      lines.push({ text: `Desconto:`.padEnd(24) + `-R$ ${order.coupon_discount.toFixed(2).replace('.', ',')}`.padStart(8) });
      subtotal -= order.coupon_discount;
    }

    lines.push({ text: '================================', bold: true });
    lines.push({ text: `TOTAL:`.padEnd(24) + `R$ ${subtotal.toFixed(2).replace('.', ',')}`.padStart(8), bold: true });
    lines.push({ text: '================================', bold: true });

    if (payment) {
      lines.push({ text: '' });
      lines.push({ text: `Pagamento: ${payment.method || '-'}` });
      if (payment.change > 0) {
        lines.push({ text: `Troco: R$ ${payment.change.toFixed(2).replace('.', ',')}` });
      }
    }

    lines.push({ text: '' });
    lines.push({ text: 'Obrigado pela preferência!', center: true });
    lines.push({ text: '' });

    return { lines };
  }
}

module.exports = PrinterService;

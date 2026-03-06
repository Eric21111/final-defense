const { ThermalPrinter, PrinterTypes, CharacterSet, BreakLine } = require('node-thermal-printer');
const escpos = require('escpos');
let windowsPrinterDriver = null;
let UsbAdapter = null;

try {

  windowsPrinterDriver = require('printer');

  if (windowsPrinterDriver && typeof windowsPrinterDriver.getPrinters === 'function') {
    console.log('Windows printer driver module loaded successfully');
  } else {
    console.warn('Windows printer driver module loaded but appears to be invalid');
    windowsPrinterDriver = null;
  }
} catch (err) {
  console.warn('Windows printer driver module "printer" failed to load:', err.message);
  console.warn('Install it with "npm install printer" or use TCP/IP printing instead.');
  windowsPrinterDriver = null;
}

try {

  const usb = require('usb');

  if (usb && typeof usb.on === 'undefined') {
    const EventEmitter = require('events');
    const usbEmitter = new EventEmitter();
   
    usb.on = function(event, callback) {
      usbEmitter.on(event, callback);
    };
    usb.emit = function(event, ...args) {
      usbEmitter.emit(event, ...args);
    };
    usb.removeListener = function(event, callback) {
      usbEmitter.removeListener(event, callback);
    };
    usb.removeAllListeners = function(event) {
      usbEmitter.removeAllListeners(event);
    };
  }
  
  UsbAdapter = require('escpos-usb');
  escpos.USB = UsbAdapter;
} catch (err) {
  console.warn('Optional module "escpos-usb" is not installed. Run "npm install escpos escpos-usb" to enable direct USB thermal printing.');
}


const RECEIPT_CHAR_WIDTH = parseInt(process.env.RECEIPT_CHAR_WIDTH || '32', 10);


if (RECEIPT_CHAR_WIDTH !== 32) {
  console.warn(`⚠️  WARNING: RECEIPT_CHAR_WIDTH is set to ${RECEIPT_CHAR_WIDTH}, but 58mm paper requires 32 characters per line.`);
  console.warn(`   Current setting will work for ${RECEIPT_CHAR_WIDTH === 48 ? '80mm' : 'custom'} paper width.`);
} else {
  console.log('✅ Receipt configured for 58mm thermal paper (32 characters per line)');
}
const DEFAULT_STORE_NAME = process.env.STORE_NAME || 'CreateYourStyle';
const DEFAULT_ADDRESS_LINES = (process.env.STORE_ADDRESS || 'TC USHS - #831100254488|Pasoanca, Zambonaga City').split('|');
const CURRENCY_SYMBOL = process.env.PRINTER_CURRENCY_SYMBOL || '₱';

const formatCurrency = (value = 0) => `${CURRENCY_SYMBOL}${Number(value || 0).toFixed(2)}`;
const lineBreak = (char = '-') => char.repeat(RECEIPT_CHAR_WIDTH);
const padLine = (left = '', right = '') => {
  const lhs = String(left);
  const rhs = String(right);
  const spacing = Math.max(RECEIPT_CHAR_WIDTH - lhs.length - rhs.length, 0);
  return `${lhs}${' '.repeat(spacing)}${rhs}`.slice(0, RECEIPT_CHAR_WIDTH);
};

const parseUsbId = (value) => {
  if (!value) return null;
  if (typeof value === 'number') return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const radix = trimmed.toLowerCase().startsWith('0x') ? 16 : 10;
  const parsed = parseInt(trimmed, radix);
  return Number.isNaN(parsed) ? null : parsed;
};

const printViaEscposUsb = (receiptData = {}) => new Promise((resolve, reject) => {
  if (!UsbAdapter) {
    reject(new Error('escpos-usb adapter is not installed. Run "npm install escpos escpos-usb" inside backend/.'));
    return;
  }

  const vendorId = parseUsbId(process.env.PRINTER_VENDOR_ID);
  const productId = parseUsbId(process.env.PRINTER_PRODUCT_ID);


  console.log('USB Printer Configuration:');
  console.log(`  Vendor ID: ${process.env.PRINTER_VENDOR_ID} -> ${vendorId} (${vendorId ? '0x' + vendorId.toString(16) : 'not set'})`);
  console.log(`  Product ID: ${process.env.PRINTER_PRODUCT_ID} -> ${productId} (${productId ? '0x' + productId.toString(16) : 'not set'})`);

  let device;
  try {
    if (vendorId && productId) {
      console.log(`Attempting to connect to USB printer with VID: 0x${vendorId.toString(16)}, PID: 0x${productId.toString(16)}`);
      device = new escpos.USB(vendorId, productId);
    } else {
      console.log('No vendor/product ID specified, attempting auto-detect...');
      device = new escpos.USB();
    }
  } catch (usbError) {
    const errorMsg = usbError.message || 'Unknown USB error';
    console.error('USB Error Details:', errorMsg);
    console.error('\n⚠️  IMPORTANT: USB printing requires WinUSB driver to be installed.');
    console.error('   Steps to fix:');
    console.error('   1. Download Zadig: https://zadig.akeo.ie/');
    console.error('   2. Open Zadig → Options → List All Devices');
    console.error(`   3. Select your printer (VID: 0x${vendorId ? vendorId.toString(16).padStart(4, '0') : 'XXXX'}, PID: 0x${productId ? productId.toString(16).padStart(4, '0') : 'YYYY'})`);
    console.error('   4. Select "WinUSB" as the driver');
    console.error('   5. Click "Install Driver" or "Replace Driver"');
    console.error('   6. Restart your computer if prompted');
    console.error('\n   The system will automatically fall back to file printing until the driver is installed.\n');
    reject(new Error(`USB device initialization failed: ${errorMsg}. WinUSB driver required. See console for installation instructions.`));
    return;
  }

  if (!device || typeof device.open !== 'function') {
    reject(new Error('USB device object is invalid. The escpos-usb library may be incompatible. Try using the thermal printer interface instead.'));
    return;
  }

  device.open((error) => {
    if (error) {
      reject(error);
      return;
    }

    const printer = new escpos.Printer(device, {
      encoding: process.env.PRINTER_ENCODING || 'GB18030'
    });

    const closePrinter = () => {
      try {
        printer.close();
      } catch (closeErr) {
        console.error('Failed to close printer connection', closeErr);
      }
    };

    const storeName = receiptData.storeName || DEFAULT_STORE_NAME;
    const contactNumber = receiptData.contactNumber || '+631112224444';
    const location = receiptData.location || 'Pasonanca, Zamboanga City';
    const receiptNo = receiptData.receiptNo || '000000';
    const paymentMethod = receiptData.paymentMethod || 'CASH';
    const referenceNo = receiptData.referenceNo || receiptData.reference || '';
    const issueDate = receiptData.date || new Date().toLocaleDateString();
    const issueTime = receiptData.time || new Date().toLocaleTimeString();

    try {
      // Header: Business name
      printer
        .align('ct')
        .size(1, 0)
        .text(storeName)
        .size(0, 0)
        .feed(1);

      // Time and Contact 
      printer.align('lt');
      const timeLine = padLine(issueTime, contactNumber);
      printer.text(timeLine);
      
      // Location 
      printer.align('ct');
      printer.text(location);
      printer.feed(1);
      printer.text(lineBreak());

      // Receipt 
      printer.align('ct');
      printer.text('Receipt No:');
      printer.style('B');
      printer.text(`#${receiptNo}`);
      printer.style('NORMAL');
      printer.text(lineBreak());

      // Item table headers
      printer.align('lt');
      // Format: Item (14 chars) | Qty (5 chars) | Price (13 chars) = 32 chars
      // Tighter spacing - items closer to qty
      const itemCol = 'Item'.padEnd(14);
      const qtyCol = 'Qty'.padStart(5);
      const priceCol = 'Price'.padStart(13);
      printer.text(`${itemCol}${qtyCol}${priceCol}`);
      printer.text(lineBreak());

      // Items
      (receiptData.items || []).forEach((item) => {
        const itemName = (item.name || item.itemName || 'Item').toString();
        const qty = item.qty || item.quantity || 1;
        const price = item.price || item.itemPrice || 0;

        // Format: Item name (truncated to 14 chars), Qty (5 chars right-aligned), Price (13 chars right-aligned)
        const itemNameLine = itemName.substring(0, 14).padEnd(14);
        const qtyStr = qty.toString().padStart(5);
        // Use PHP format to match image
        const priceStr = `PHP ${price.toFixed(2)}`.padStart(13);
        printer.text(`${itemNameLine}${qtyStr}${priceStr}`);
      });

      if ((receiptData.items || []).length === 0) {
        printer.text('No line items provided.');
      }

      printer.text(lineBreak());

      // Payment summary
      printer.align('lt');
      // printer.text(padLine('Transaction/Reference', referenceNo || '-'));
      printer.text(padLine('Payment Method', paymentMethod));
      printer.text(padLine('Subtotal', `PHP ${(receiptData.subtotal || 0).toFixed(2)}`));
      printer.text(lineBreak());
      printer.text(padLine('Discount', `PHP ${(receiptData.discount || 0).toFixed(2)}`));
      printer.text(lineBreak());
      printer.style('B');
      printer.text(padLine('Total', `PHP ${(receiptData.total || 0).toFixed(2)}`));
      printer.style('NORMAL');

      if (receiptData.cash !== undefined) {
        printer.text(padLine('Cash', `PHP ${receiptData.cash.toFixed(2)}`));
      }

      if (receiptData.change !== undefined) {
        printer.text(padLine('Change', `PHP ${receiptData.change.toFixed(2)}`));
      }

      printer.text(lineBreak());
      printer.align('ct');
      printer.style('B');
      printer.text('This is not an official receipt');
      printer.style('NORMAL');
      printer.feed(2);
      printer.cut('full');
      closePrinter();
      resolve();
    } catch (printErr) {
      closePrinter();
      reject(printErr);
    }
  });
});

const printReceipt = async (req, res) => {
  try {
    const { receiptData } = req.body;

    if (!receiptData) {
      return res.status(400).json({ success: false, message: 'Receipt data is required' });
    }

    // Initialize printer configuration from environment variables or defaults
    const printerType = process.env.PRINTER_TYPE || 'EPSON'; // EPSON, STAR, or other
    // Default to 'file' if Windows printer driver is not available, otherwise use 'printer'
    const defaultInterface = (!windowsPrinterDriver) ? 'file' : 'printer';
    let printerInterface = process.env.PRINTER_INTERFACE || defaultInterface; // 'printer', 'tcp', 'usb', 'file', or 'bluetooth'
    let printerName = process.env.PRINTER_NAME || (defaultInterface === 'file' ? './receipt.txt' : ''); // Windows printer name or file path
    const printerIP = process.env.PRINTER_IP || '192.168.1.100'; // Network printer IP
    const printerPort = process.env.PRINTER_PORT || '9100'; // Network printer port
    const printerTransport = (process.env.PRINTER_TRANSPORT || '').toLowerCase();

    if (printerTransport === 'escpos-usb') {
      try {
        await printViaEscposUsb(receiptData);
        return res.json({
          success: true,
          message: 'Receipt sent to USB thermal printer successfully'
        });
      } catch (usbError) {
        console.error('USB print error:', usbError);
      
      
        printerInterface = 'file';
        printerName = process.env.PRINTER_NAME || './receipt.txt';
    
      }
    }


    let printer;

    let printerTypeEnum = PrinterTypes.EPSON;
    if (printerType === 'STAR') {
      printerTypeEnum = PrinterTypes.STAR;
    } else if (printerType === 'BEPOST') {
      printerTypeEnum = PrinterTypes.BEPOST;
    }

    let interfaceString;
    if (printerInterface === 'tcp' || printerInterface === 'network') {
      interfaceString = `tcp://${printerIP}:${printerPort}`;
    } else if (printerInterface === 'usb') {
      interfaceString = 'usb';
    } else if (printerInterface === 'file') {
     
      interfaceString = `file:${printerName || './receipt.txt'}`;
    } else {
      
      interfaceString = printerName ? `printer:${printerName}` : 'printer';
    }

    if ((interfaceString.startsWith('printer:') || interfaceString === 'printer') && !windowsPrinterDriver) {
      console.warn('Windows printer driver module "printer" is not available. Falling back to file printing...');
      interfaceString = `file:${printerName || './receipt.txt'}`;
      console.log(`Receipt will be saved to: ${interfaceString.replace('file:', '')}`);
    }

    const printerConfig = {
      type: printerTypeEnum,
      interface: interfaceString,
      characterSet: CharacterSet.PC852_LATIN2,
      removeSpecialCharacters: false,
      lineCharacter: '-',
      breakLine: BreakLine.WORD,
      options: {
        timeout: 30000, 
      }
    };

    if ((interfaceString.startsWith('printer:') || interfaceString === 'printer') && windowsPrinterDriver) {
      printerConfig.driver = windowsPrinterDriver;
    }

    printer = new ThermalPrinter(printerConfig);
    
   
    if (!printer) {
      throw new Error('Failed to initialize printer. Please check printer configuration.');
    }

 
    let isConnected = true;
   
    const shouldCheckConnection = printerInterface === 'tcp' || printerInterface === 'network';

    if (shouldCheckConnection) {
      isConnected = false;
      try {
        isConnected = await printer.isPrinterConnected();
      } catch (connectionError) {
        console.error('Printer connection check failed:', connectionError);
        
        isConnected = true;
      }

      if (!isConnected) {
        return res.status(500).json({ 
          success: false, 
          message: 'Printer not connected. Please check printer connection and configuration. See README_PRINTER_SETUP.md for setup instructions.' 
        });
      }
    }

  
    const storeName = receiptData.storeName || DEFAULT_STORE_NAME;
    const contactNumber = receiptData.contactNumber || '+631112224444';
    const location = receiptData.location || 'Pasonanca, Zamboanga City';
    const referenceNo = receiptData.referenceNo || receiptData.reference || '';
    const issueTime = receiptData.time || new Date().toLocaleTimeString();


    printer.alignCenter();
    printer.setTextSize(1, 0);
    printer.bold(true);
    printer.println(storeName);
    printer.bold(false);
    printer.setTextSize(0, 0);
    
  
    printer.alignLeft();
    const timeContactLine = `${issueTime}${' '.repeat(Math.max(0, RECEIPT_CHAR_WIDTH - issueTime.length - contactNumber.length))}${contactNumber}`;
    printer.println(timeContactLine.substring(0, RECEIPT_CHAR_WIDTH));
    

    printer.alignCenter();
    printer.println(location);
    printer.drawLine();
    

    printer.alignCenter();
    printer.println('Receipt No:');
    printer.bold(true);
    printer.println(`#${receiptData.receiptNo || '000000'}`);
    printer.bold(false);
    printer.drawLine();

 
    printer.alignLeft();
    printer.tableCustom([
      { text: 'Item', align: 'LEFT', width: 0.55 },
      { text: 'Qty', align: 'CENTER', width: 0.15 },
      { text: 'Price', align: 'RIGHT', width: 0.3 }
    ]);
    printer.drawLine();

    // Items
    if (receiptData.items && receiptData.items.length > 0) {
      receiptData.items.forEach(item => {
        const itemName = item.name || item.itemName || 'Item';
        const qty = item.qty || item.quantity || 1;
        const price = item.price || item.itemPrice || 0;

        printer.tableCustom([
          { text: itemName.substring(0, 20), align: 'LEFT', width: 0.55 },
          { text: qty.toString(), align: 'CENTER', width: 0.15 },
          { text: `PHP${price.toFixed(2)}`, align: 'RIGHT', width: 0.3 }
        ]);
      });
    }

    printer.drawLine();

    // Payment summary
    printer.alignLeft();
    printer.println(`Transaction/Reference: ${referenceNo || '-'}`);
    printer.println(`Payment Method: ${receiptData.paymentMethod || 'CASH'}`);
    printer.println(`Subtotal: PHP ${(receiptData.subtotal || 0).toFixed(2)}`);
    printer.drawLine();
    printer.println(`Discount: PHP ${(receiptData.discount || 0).toFixed(2)}`);
    printer.drawLine();
    printer.bold(true);
    printer.println(`Total: PHP ${(receiptData.total || 0).toFixed(2)}`);
    printer.bold(false);
    
    if (receiptData.cash) {
      printer.println(`Cash: PHP ${receiptData.cash.toFixed(2)}`);
      printer.println(`Change: PHP ${(receiptData.change || 0).toFixed(2)}`);
    }

    printer.drawLine();
    printer.alignCenter();
    printer.bold(true);
    printer.println('This is not an official receipt');
    printer.bold(false);
    printer.newLine();
    printer.cut();

 
    const isFilePrinting = interfaceString.startsWith('file:');
    
    if (isFilePrinting) {
      console.warn('WARNING: Using file printing mode. Receipt will be saved to file, not printed to physical printer.');
      console.warn(`File location: ${printerName || './receipt.txt'}`);
    } else {
      console.log(`Attempting to print to: ${interfaceString}`);
    }

    let printSuccess = false;
    try {
      console.log('Sending print job to printer...');
      await printer.execute();
      printSuccess = true;
      console.log('Print job sent successfully');
    } catch (executeError) {
     
      console.error('Printer execute error:', executeError);
      console.error('Error details:', {
        message: executeError.message,
        stack: executeError.stack,
        interface: interfaceString,
        printerType: printerType
      });
      
    
      const errorMessage = executeError.message || 'Unknown printer error';
      const isTimeout = errorMessage.toLowerCase().includes('timeout') || errorMessage.toLowerCase().includes('timed out');
      const isConnection = errorMessage.toLowerCase().includes('connect') || errorMessage.toLowerCase().includes('connection');
      
      return res.status(500).json({ 
        success: false, 
        message: `Print execution failed: ${errorMessage}. ${isTimeout ? 'Printer may be slow or unresponsive.' : isConnection ? 'Please check printer connection.' : 'Please check printer configuration and connection.'}`
      });
    }
    

    if (!printSuccess) {
      return res.status(500).json({ 
        success: false, 
        message: 'Print job did not complete successfully'
      });
    }

    if (isFilePrinting) {
      return res.json({ 
        success: false, 
        message: `Receipt saved to file (${printerName || './receipt.txt'}) but not printed. Please configure a physical printer. See PRINTER_SETUP.md for instructions.`,
        fileSaved: true,
        filePath: printerName || './receipt.txt'
      });
    }
    
   
    console.log('Print completed successfully');
    res.json({ 
      success: true, 
      message: 'Receipt printed successfully' 
    });
  } catch (error) {
    console.error('Print error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to print receipt: ' + error.message 
    });
  }
};

module.exports = { printReceipt };


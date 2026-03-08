

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const escpos = require('escpos');

let BluetoothAdapter;
try {
  BluetoothAdapter = require('escpos-bluetooth');
  escpos.Bluetooth = BluetoothAdapter;
} catch (error) {
  console.warn('[printService] escpos-bluetooth not available:', error.message);
}

let bluetoothSerialPort;
try {
  bluetoothSerialPort = require('bluetooth-serial-port');
} catch (error) {
  console.warn('[printService] bluetooth-serial-port fallback not available:', error.message);
}

const DEFAULT_BT_ADDRESS = process.env.PRINTER_BT_ADDRESS || '00:00:00:00:00:00';
const DEFAULT_BT_CHANNEL = Number(process.env.PRINTER_BT_CHANNEL || 1);
const MAX_LINE_CHARS = Number(process.env.PRINTER_LINE_CHARS || 32); // 58 mm 

// Format currency for receipt
const formatCurrency = value => `PHP ${Number(value || 0).toFixed(2)}`;

// Pad line with left and right text
const padLine = (left, right = '') => {
  const cleanLeft = String(left ?? '').trim();
  const cleanRight = String(right ?? '').trim();
  const available = MAX_LINE_CHARS - (cleanLeft.length + cleanRight.length);
  const spacer = available > 0 ? ' '.repeat(available) : ' ';
  return (cleanLeft + spacer + cleanRight).slice(0, MAX_LINE_CHARS);
};

// Build receipt lines from receipt object (matching new clean design)
const buildReceiptLines = receipt => {
  const lines = [];
  const storeName = receipt.storeName || 'Create Your Style';
  const location = receipt.location || 'Pasonanca, Zamboanga City';
  const receiptNo = receipt.receiptNo || '000000';
  const paymentMethod = receipt.paymentMethod || 'Cash';
  const cashier = receipt.cashier || receipt.cashierName || receipt.performedByName || 'Staff';
  
  // Format date/time
  const receiptDate = receipt.date || new Date().toLocaleDateString('en-US', { 
    month: 'numeric', 
    day: 'numeric', 
    year: 'numeric' 
  });
  const receiptTime = receipt.time || new Date().toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  });

  // Header (centered)
  const centerText = (text) => {
    const padding = Math.floor((MAX_LINE_CHARS - text.length) / 2);
    return ' '.repeat(Math.max(0, padding)) + text;
  };

  lines.push(centerText(storeName));
  lines.push(centerText(location));
  lines.push('');
  
  // Receipt number section
  lines.push(centerText('RECEIPT'));
  lines.push(centerText(`#${receiptNo}`));
  lines.push('');

  // Date, Cashier, Payment info
  lines.push(padLine('Date:', `${receiptDate}, ${receiptTime}`));
  lines.push(padLine('Cashier:', cashier));
  lines.push(padLine('Payment:', paymentMethod));
  lines.push('');

  // Items
  (receipt.items || []).forEach(item => {
    // Remove colors/variants in parentheses from item name
    let itemName = (item.name || item.itemName || 'Item').toString();
    itemName = itemName.replace(/\s*\([^)]*\)\s*$/, '').trim();
    
    const qty = item.qty || item.quantity || 1;
    const price = item.price || item.itemPrice || 0;
    const size = item.size || item.selectedSize || '';
    const color = item.variant || '';

    lines.push(itemName);
    // Add size/color info if available
    if (size || color) {
      const parts = [];
      if (size) parts.push(size);
      if (color) parts.push(color);
      lines.push(parts.join(' / '));
    }
    lines.push(`${qty} x P${Number(price).toFixed(2)}`);
  });
  lines.push('');

  // Summary
  lines.push(padLine('Subtotal:', `P${Number(receipt.subtotal || 0).toFixed(2)}`));
  lines.push(padLine('Discount:', `P${Number(receipt.discount || 0).toFixed(2)}`));
  lines.push('');
  lines.push(padLine('Total:', `P${Number(receipt.total || 0).toFixed(2)}`));

  if (receipt.cash !== undefined) {
    lines.push(padLine('Amount Received:', `P${Number(receipt.cash).toFixed(2)}`));
  }

  if (receipt.change !== undefined) {
    lines.push(padLine('Change:', `P${Number(receipt.change).toFixed(2)}`));
  }

  lines.push('');
  lines.push(centerText('Thank you for your purchase!'));
  lines.push(centerText('This is not an official receipt'));

  return lines;
};

const normalizeLines = rawLines => {
  const expandedLines = [];
  rawLines.forEach(line => {
    const text = String(line || '');
    if (text.length <= MAX_LINE_CHARS) {
      expandedLines.push(text);
      return;
    }
    for (let i = 0; i < text.length; i += MAX_LINE_CHARS) {
      expandedLines.push(text.slice(i, i + MAX_LINE_CHARS));
    }
  });
  return expandedLines;
};


const printViaEscpos = (lines, { address, channel }) =>
  new Promise((resolve, reject) => {
    if (!BluetoothAdapter) {
      return reject(new Error('escpos-bluetooth adapter missing'));
    }

    const device = new escpos.Bluetooth(address, channel);
    const printer = new escpos.Printer(device, { encoding: 'GB18030' });

    device.open(error => {
      if (error) {
        return reject(error);
      }

      try {
        lines.forEach(line => printer.text(line));
        printer.cut().close();
        resolve();
      } catch (printError) {
        reject(printError);
      }
    });
  });


const printViaBluetoothSerial = (lines, { address, channel }) =>
  new Promise((resolve, reject) => {
    if (!bluetoothSerialPort) {
      return reject(new Error('bluetooth-serial-port module missing'));
    }

    const btSerial = new bluetoothSerialPort.BluetoothSerialPort();
    const payload = Buffer.from(`${lines.join('\n')}\n\n`, 'ascii');

    const connect = targetChannel => {
      btSerial.connect(
        address,
        targetChannel,
        () => {
          btSerial.write(payload, err => {
            if (err) {
              return reject(err);
            }
            btSerial.close();
            resolve();
          });
        },
        err => reject(err)
      );
    };

    if (channel) {
      connect(channel);
      return;
    }

    btSerial.findSerialPortChannel(
      address,
      discoveredChannel => connect(discoveredChannel),
      err => reject(err || new Error('Unable to locate printer channel'))
    );
  });

async function handlePrint(lines, config) {
  try {
    await printViaEscpos(lines, config);
  } catch (error) {
    console.warn('[printService] escpos-bluetooth failed, trying fallback:', error.message);
    await printViaBluetoothSerial(lines, config);
  }
}

function startPrintServer({
  port = 3000,
  printerAddress = DEFAULT_BT_ADDRESS,
  printerChannel = DEFAULT_BT_CHANNEL
} = {}) {
  const app = express();
  app.use(cors());
  app.use(bodyParser.json({ limit: '10kb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/print', async (req, res) => {
    const body = req.body || {};
    let lines;

    // Check if this is a receipt object (has storeName or items) or direct lines array
    if (body.storeName || body.items || body.receiptNo) {
      // Receipt object format - build lines from it
      lines = buildReceiptLines(body);
    } else if (Array.isArray(body.lines) && body.lines.length > 0) {
      // Direct lines array format (backward compatibility)
      lines = body.lines;
    } else {
      return res.status(400).json({ message: 'Receipt object or `lines` array is required' });
    }

    try {
      await handlePrint(
        normalizeLines(lines),
        { address: printerAddress, channel: printerChannel }
      );
      res.json({ ok: true });
    } catch (error) {
      console.error('[printService] Failed to print:', error);
      res.status(500).json({ message: error.message });
    }
  });

  return new Promise((resolve, reject) => {
    const server = app
      .listen(port, () => {
        console.log(`[printService] Listening on http://localhost:${port}`);
        resolve(server);
      })
      .on('error', reject);
  });
}

module.exports = {
  startPrintServer
};


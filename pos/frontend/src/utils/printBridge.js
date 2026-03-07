const MAX_WIDTH = Number(import.meta.env.VITE_RECEIPT_LINE_WIDTH || 32);
const PRINT_API_URL = import.meta.env.VITE_PRINT_API_URL || 'http://localhost:9100';
const USE_NETWORK_PRINTER = import.meta.env.VITE_USE_NETWORK_PRINTER === 'true';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const formatCurrency = value => `PHP ${Number(value || 0).toFixed(2)}`;

const padLine = (left, right = '') => {
  const cleanLeft = String(left ?? '').trim();
  const cleanRight = String(right ?? '').trim();
  const available = MAX_WIDTH - (cleanLeft.length + cleanRight.length);
  const spacer = available > 0 ? ' '.repeat(available) : ' ';
  return (cleanLeft + spacer + cleanRight).slice(0, MAX_WIDTH);
};

const chunkText = (text) => {
  if (!text) return [''];
  const normalized = String(text);
  const chunks = [];
  for (let i = 0; i < normalized.length; i += MAX_WIDTH) {
    chunks.push(normalized.slice(i, i + MAX_WIDTH));
  }
  return chunks.length ? chunks : [''];
};

export const buildReceiptLines = receipt => {
  const lines = [];
  const storeName = receipt.storeName || 'Create Your Style';
  const contactNumber = receipt.contactNumber || '+631112224444';
  const location = receipt.location || 'Pasonanca, Zamboanga City';
  const issueTime = receipt.time || '12:00PM';
  const referenceNo = receipt.referenceNo || receipt.reference || '-';

  // Header
  lines.push(storeName);
  lines.push(padLine(issueTime, contactNumber));
  lines.push(location);
  lines.push('-'.repeat(MAX_WIDTH));

  // Receipt No
  lines.push('Receipt No:');
  lines.push(`#${receipt.receiptNo || '000000'}`);
  lines.push('-'.repeat(MAX_WIDTH));

  // Item table headers (Item: 20, Qty: 3, Price: 9 = 32 chars)
  const itemCol = 'Item'.padEnd(20);
  const qtyCol = 'Qty'.padStart(3);
  const priceCol = 'Price'.padStart(9);
  lines.push(`${itemCol}${qtyCol}${priceCol}`);
  lines.push('-'.repeat(MAX_WIDTH));

  // Items
  (receipt.items || []).forEach(item => {
    const itemName = (item.name || item.itemName || 'Item').toString();
    const qty = item.qty || item.quantity || 1;
    const price = item.price || item.itemPrice || 0;

    const itemNameLine = itemName.substring(0, 20).padEnd(20);
    const qtyStr = qty.toString().padStart(3);
    const priceStr = formatCurrency(price).padStart(9);
    lines.push(`${itemNameLine}${qtyStr}${priceStr}`);
  });

  lines.push('-'.repeat(MAX_WIDTH));

  // Payment summary
  lines.push(padLine('Transaction/Reference', referenceNo));
  lines.push(padLine('Payment Method', receipt.paymentMethod || 'CASH'));
  lines.push(padLine('Subtotal', formatCurrency(receipt.subtotal || 0)));
  lines.push('-'.repeat(MAX_WIDTH));
  lines.push(padLine('Discount', formatCurrency(receipt.discount || 0)));
  lines.push('-'.repeat(MAX_WIDTH));
  lines.push(padLine('Total', formatCurrency(receipt.total || 0)));

  if (receipt.cash !== undefined) {
    lines.push(padLine('Cash', formatCurrency(receipt.cash)));
  }

  if (receipt.change !== undefined) {
    lines.push(padLine('Change', formatCurrency(receipt.change)));
  }

  lines.push('-'.repeat(MAX_WIDTH));
  lines.push('This is not an official receipt');
  return lines;
};

/**
 * Build HTML content for printing a receipt using window.print()
 */
const buildReceiptHTML = (receipt) => {
  const storeName = receipt.storeName || 'Create Your Style';
  const contactNumber = receipt.contactNumber || '+631112224444';
  const location = receipt.location || 'Pasonanca, Zamboanga City';
  const issueTime = receipt.time || '12:00PM';
  const referenceNo = receipt.referenceNo || receipt.reference || '-';
  const receiptNo = receipt.receiptNo || '000000';
  const paymentMethod = receipt.paymentMethod || 'CASH';
  const subtotal = Number(receipt.subtotal || 0);
  const discount = Number(receipt.discount || 0);
  const total = Number(receipt.total || 0);
  const cash = receipt.cash !== undefined ? Number(receipt.cash) : null;
  const change = receipt.change !== undefined ? Number(receipt.change) : null;
  const cashier = receipt.cashier || receipt.performedByName || 'N/A';

  const itemsHTML = (receipt.items || []).map(item => {
    const itemName = (item.name || item.itemName || 'Item').toString();
    const qty = item.qty || item.quantity || 1;
    const price = Number(item.price || item.itemPrice || 0);
    const itemTotal = qty * price;
    const size = item.size || item.selectedSize || '';
    
    return `
      <tr>
        <td style="padding: 4px 0; text-align: left; font-size: 11px;">
          ${itemName}${size ? ` <span style="color: #666; font-size: 9px;">(${size})</span>` : ''}
        </td>
        <td style="padding: 4px 0; text-align: center; font-size: 11px;">${qty}</td>
        <td style="padding: 4px 0; text-align: right; font-size: 11px;">₱${price.toFixed(2)}</td>
        <td style="padding: 4px 0; text-align: right; font-size: 11px;">₱${itemTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Receipt - #${receiptNo}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        @page {
          size: 58mm auto;
          margin: 0;
        }
        @media print {
          body {
            width: 58mm;
            margin: 0;
            padding: 5px;
          }
          .no-print {
            display: none !important;
          }
        }
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: 11px;
          line-height: 1.3;
          width: 58mm;
          max-width: 58mm;
          padding: 8px;
          background: white;
          color: #000;
        }
        .receipt-container {
          width: 100%;
        }
        .header {
          text-align: center;
          margin-bottom: 8px;
        }
        .store-name {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 4px;
        }
        .header-info {
          display: flex;
          justify-content: space-between;
          font-size: 9px;
          margin: 4px 0;
        }
        .location {
          font-size: 9px;
          text-align: center;
        }
        .divider {
          border-top: 1px dashed #000;
          margin: 6px 0;
        }
        .receipt-no {
          text-align: center;
          margin: 8px 0;
        }
        .receipt-no-label {
          font-size: 10px;
        }
        .receipt-no-value {
          font-size: 16px;
          font-weight: bold;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 8px 0;
        }
        .items-table th {
          border-bottom: 1px solid #000;
          padding: 4px 0;
          font-size: 10px;
          font-weight: bold;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 2px 0;
          font-size: 11px;
        }
        .summary-row.total {
          font-weight: bold;
          font-size: 12px;
          padding: 4px 0;
        }
        .footer {
          text-align: center;
          margin-top: 12px;
          font-size: 10px;
          font-weight: bold;
        }
        .print-btn {
          display: block;
          width: 100%;
          padding: 12px;
          margin-top: 20px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
        }
        .print-btn:hover {
          background: #45a049;
        }
      </style>
    </head>
    <body>
      <div class="receipt-container">
        <div class="header">
          <div class="store-name">${storeName}</div>
          <div class="header-info">
            <span>${issueTime}</span>
            <span>${contactNumber}</span>
          </div>
          <div class="location">${location}</div>
        </div>

        <div class="divider"></div>

        <div class="receipt-no">
          <div class="receipt-no-label">Receipt No:</div>
          <div class="receipt-no-value">#${receiptNo}</div>
        </div>

        <div class="divider"></div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="text-align: left;">Item</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Price</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML || '<tr><td colspan="4" style="text-align: center; padding: 8px;">No items</td></tr>'}
          </tbody>
        </table>

        <div class="divider"></div>

        <div class="summary-row">
          <span>Reference:</span>
          <span>${referenceNo}</span>
        </div>
        <div class="summary-row">
          <span>Payment:</span>
          <span>${paymentMethod}</span>
        </div>
        <div class="summary-row">
          <span>Cashier:</span>
          <span>${cashier}</span>
        </div>
        
        <div class="divider"></div>
        
        <div class="summary-row">
          <span>Subtotal:</span>
          <span>₱${subtotal.toFixed(2)}</span>
        </div>
        <div class="summary-row">
          <span>Discount:</span>
          <span>₱${discount.toFixed(2)}</span>
        </div>
        
        <div class="divider"></div>
        
        <div class="summary-row total">
          <span>TOTAL:</span>
          <span>₱${total.toFixed(2)}</span>
        </div>
        
        ${cash !== null ? `
        <div class="summary-row">
          <span>Cash:</span>
          <span>₱${cash.toFixed(2)}</span>
        </div>
        ` : ''}
        
        ${change !== null ? `
        <div class="summary-row">
          <span>Change:</span>
          <span>₱${change.toFixed(2)}</span>
        </div>
        ` : ''}

        <div class="divider"></div>

        <div class="footer">
          This is not an official receipt
        </div>

        <button class="print-btn no-print" onclick="window.print(); return false;">
          🖨️ Print Receipt
        </button>
      </div>

      <script>
        // Auto-print when opened
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
        
        // Close window after printing (optional)
        window.onafterprint = function() {
          // Give user a moment to see the result
          setTimeout(function() {
            window.close();
          }, 500);
        };
      </script>
    </body>
    </html>
  `;
};

/**
 * Print receipt using window.print() or send to thermal printer via backend API
 */
export async function sendReceiptToPrinter(receipt) {
  if (!receipt) throw new Error('No receipt payload provided');

  // If network printer is enabled, send to backend API
  if (USE_NETWORK_PRINTER) {
    return sendToNetworkPrinter(receipt);
  }

  // Otherwise, use window.print()
  return printViaWindow(receipt);
}

/**
 * Send receipt to thermal printer via backend API (localhost:9100)
 */
async function sendToNetworkPrinter(receipt) {
  try {
    const response = await fetch(`${API_BASE_URL}/print/receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ receiptData: receipt }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Failed to print receipt');
    }

    return { success: true, message: 'Receipt sent to printer' };
  } catch (error) {
    console.error('Network printer error:', error);
    // Fallback to window.print() if network printer fails
    console.log('Falling back to window.print()...');
    return printViaWindow(receipt);
  }
}

/**
 * Print receipt using window.print() - opens a new window with the receipt and triggers print dialog
 */
async function printViaWindow(receipt) {
  return new Promise((resolve, reject) => {
    try {
      // Build the receipt HTML
      const receiptHTML = buildReceiptHTML(receipt);
      
      // Open a new window for printing
      const printWindow = window.open('', '_blank', 'width=300,height=600');
      
      if (!printWindow) {
        throw new Error('Unable to open print window. Please allow pop-ups for this site.');
      }

      // Write the receipt HTML to the new window
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
      
      // Focus the print window
      printWindow.focus();

      // Resolve after a short delay to allow the print dialog to open
      setTimeout(() => {
        resolve({ success: true, message: 'Print dialog opened' });
      }, 500);

    } catch (error) {
      reject(error);
    }
  });
}


const MAX_WIDTH = Number(import.meta.env.VITE_RECEIPT_LINE_WIDTH || 32);

const padLine = (left, right = '') => {
  const cleanLeft = String(left ?? '').trim();
  const cleanRight = String(right ?? '').trim();
  const available = MAX_WIDTH - (cleanLeft.length + cleanRight.length);
  const spacer = available > 0 ? ' '.repeat(available) : ' ';
  return (cleanLeft + spacer + cleanRight).slice(0, MAX_WIDTH);
};

const centerText = (text) => {
  const padding = Math.floor((MAX_WIDTH - text.length) / 2);
  return ' '.repeat(Math.max(0, padding)) + text;
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
    const itemName = (item.name || item.itemName || 'Item').toString();
    const qty = item.qty || item.quantity || 1;
    const price = item.price || item.itemPrice || 0;

    lines.push(itemName);
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

/**
 * Build HTML content for printing a receipt using window.print()
 */
const buildReceiptHTML = (receipt) => {
  const storeName = receipt.storeName || 'Create Your Style';
  const location = receipt.location || 'Pasonanca, Zamboanga City';
  const receiptNo = receipt.receiptNo || '000000';
  const paymentMethod = receipt.paymentMethod || 'Cash';
  const subtotal = Number(receipt.subtotal || 0);
  const discount = Number(receipt.discount || 0);
  const total = Number(receipt.total || 0);
  const cash = receipt.cash !== undefined ? Number(receipt.cash) : null;
  const change = receipt.change !== undefined ? Number(receipt.change) : null;
  const cashier = receipt.cashier || receipt.cashierName || receipt.performedByName || 'Staff';
  
  // Format date
  const receiptDate = receipt.date || new Date().toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
  const receiptTime = receipt.time || new Date().toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  });

  const itemsHTML = (receipt.items || []).map(item => {
    const itemName = (item.name || item.itemName || 'Item').toString();
    const qty = item.qty || item.quantity || 1;
    const price = Number(item.price || item.itemPrice || 0);
    
    return `
      <div style="margin-bottom: 8px;">
        <div style="font-weight: 600; font-size: 11px; color: #1a202c;">${itemName}</div>
        <div style="font-size: 10px; color: #718096;">${qty} x P${price.toFixed(2)}</div>
      </div>
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
            padding: 8px;
          }
          .no-print {
            display: none !important;
          }
        }
        body {
          font-family: Arial, sans-serif;
          font-size: 11px;
          line-height: 1.4;
          width: 58mm;
          max-width: 58mm;
          padding: 10px;
          background: white;
          color: #1a202c;
        }
        .receipt-container {
          width: 100%;
        }
      </style>
    </head>
    <body>
      <div class="receipt-container">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 15px;">
          <div style="font-size: 16px; font-weight: bold; color: #1a365d; margin-bottom: 4px;">${storeName}</div>
          <div style="font-size: 10px; color: #4a5568;">${location}</div>
        </div>

        <!-- Receipt Number -->
        <div style="text-align: center; margin: 15px 0; border-top: 1px dashed #cbd5e0; border-bottom: 1px dashed #cbd5e0; padding: 10px 0;">
          <div style="font-size: 9px; color: #718096; text-transform: uppercase; letter-spacing: 1px;">Receipt</div>
          <div style="font-size: 16px; font-weight: bold; color: #2d3748;">#${receiptNo}</div>
        </div>

        <!-- Date, Cashier, Payment -->
        <div style="margin-bottom: 15px;">
          <div style="display: flex; justify-content: space-between; margin: 4px 0; font-size: 11px;">
            <span style="color: #4a5568;">Date:</span>
            <span style="color: #1a202c;">${receiptDate}, ${receiptTime}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 4px 0; font-size: 11px;">
            <span style="color: #4a5568;">Cashier:</span>
            <span style="color: #1a202c;">${cashier}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 4px 0; font-size: 11px;">
            <span style="color: #4a5568;">Payment:</span>
            <span style="color: #1a202c;">${paymentMethod}</span>
          </div>
        </div>

        <!-- Items -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 10px; margin-bottom: 15px;">
          ${itemsHTML || '<div style="text-align: center; color: #718096; padding: 8px;">No items</div>'}
        </div>

        <!-- Summary -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 10px;">
          <div style="display: flex; justify-content: space-between; margin: 4px 0; font-size: 11px;">
            <span style="color: #4a5568;">Subtotal:</span>
            <span style="color: #1a202c;">P${subtotal.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 4px 0; font-size: 11px;">
            <span style="color: #4a5568;">Discount:</span>
            <span style="color: #1a202c;">P${discount.toFixed(2)}</span>
          </div>
          
          <!-- Total -->
          <div style="display: flex; justify-content: space-between; margin: 8px 0; padding-top: 8px; border-top: 1px solid #e2e8f0;">
            <span style="font-weight: bold; color: #1a365d; font-size: 13px;">Total:</span>
            <span style="font-weight: bold; color: #1a365d; font-size: 13px;">P${total.toFixed(2)}</span>
          </div>
          
          ${cash !== null ? `
          <div style="display: flex; justify-content: space-between; margin: 4px 0; font-size: 11px;">
            <span style="color: #4a5568;">Amount Received:</span>
            <span style="color: #1a202c;">P${cash.toFixed(2)}</span>
          </div>
          ` : ''}
          
          ${change !== null ? `
          <div style="display: flex; justify-content: space-between; margin: 4px 0; font-size: 11px;">
            <span style="color: #4a5568;">Change:</span>
            <span style="color: #1a202c;">P${change.toFixed(2)}</span>
          </div>
          ` : ''}
        </div>

        <!-- Footer -->
        <div style="text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px dashed #cbd5e0;">
          <div style="font-size: 11px; color: #4a5568;">Thank you for your purchase!</div>
          <div style="font-size: 10px; color: #a0aec0; margin-top: 2px;">This is not an official receipt</div>
        </div>

        <button class="no-print" style="display: block; width: 100%; padding: 12px; margin-top: 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; font-size: 14px; cursor: pointer;" onclick="window.print(); return false;">
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
 * Print receipt by sending to the local print server at localhost:9100
 * Falls back to window.print() if the print server is not available
 */
export async function sendReceiptToPrinter(receipt) {
  if (!receipt) throw new Error('No receipt payload provided');

  // Send the receipt data in your original format
  const printData = {
    // Store info
    storeName: receipt.storeName || 'Create Your Style',
    contactNumber: receipt.contactNumber || '+631112224444',
    location: receipt.location || 'Pasonanca, Zamboanga City',
    
    // Receipt info
    receiptNo: receipt.receiptNo || '000000',
    referenceNo: receipt.referenceNo || receipt.reference || '-',
    date: receipt.date || new Date().toLocaleDateString(),
    time: receipt.time || new Date().toLocaleTimeString(),
    
    // Cashier
    cashier: receipt.cashier || receipt.performedByName || 'N/A',
    
    // Items
    items: (receipt.items || []).map(item => ({
      name: item.name || item.itemName || 'Item',
      qty: item.qty || item.quantity || 1,
      price: item.price || item.itemPrice || 0,
      total: (item.price || item.itemPrice || 0) * (item.qty || item.quantity || 1),
      size: item.size || item.selectedSize || '',
      variant: item.variant || '',
    })),
    
    // Payment
    paymentMethod: receipt.paymentMethod || 'CASH',
    subtotal: receipt.subtotal || 0,
    discount: receipt.discount || 0,
    discounts: receipt.discounts || [],
    total: receipt.total || 0,
    cash: receipt.cash,
    change: receipt.change,
  };

  try {
    // Try to send to the local print server first
    const response = await fetch('http://localhost:9100/print', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(printData),
    });

    const result = await response.json();

    if (result.success) {
      return { success: true, message: 'Receipt printed successfully' };
    } else {
      throw new Error(result.error || 'Print failed');
    }
  } catch (error) {
    console.warn('Print server not available, falling back to window.print()', error);
    
    // Fallback to window.print() if print server is not available
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
          resolve({ success: true, message: 'Print dialog opened (fallback)' });
        }, 500);

      } catch (fallbackError) {
        reject(fallbackError);
      }
    });
  }
}




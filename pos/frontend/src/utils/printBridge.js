import { formatReceiptVariantSizeLine } from './transactionDisplay';
import { getReceiptProfile } from './receiptProfile';

function mergeReceiptWithStoreProfile(receipt = {}) {
  const p = getReceiptProfile();
  const totalPay = Number(receipt.total ?? receipt.totalAmount ?? 0);
  const rate = Number(
    receipt.vatRateApplied ?? p.vatRatePercent ?? 12
  );

  const birFromTxn = !!(
    receipt.birTinSnapshot ||
    receipt.birPtuSnapshot ||
    receipt.netOfVat != null ||
    receipt.vatAmount != null
  );
  const birEffective =
    receipt.birCompliantEnabled ??
    (birFromTxn ? true : p.birCompliantEnabled);

  let netOfVat = receipt.netOfVat;
  let vatAmount = receipt.vatAmount;

  if (
    birEffective &&
    (vatAmount === undefined || vatAmount === null) &&
    Number.isFinite(totalPay) &&
    totalPay > 0 &&
    Number.isFinite(rate) &&
    rate > 0
  ) {
    const factor = 1 + rate / 100;
    const net = totalPay / factor;
    const vat = totalPay - net;
    netOfVat = Math.round(net * 100) / 100;
    vatAmount = Math.round(vat * 100) / 100;
  }

  return {
    ...receipt,
    total: totalPay,
    storeName: receipt.storeName ?? p.storeName,
    location: receipt.location ?? p.receiptAddress,
    contactNumber: receipt.contactNumber ?? p.receiptContactNumber,
    receiptTagline:
      receipt.receiptTagline !== undefined && receipt.receiptTagline !== null
        ? receipt.receiptTagline
        : p.receiptTagline,
    thankYouMessage: receipt.thankYouMessage ?? p.receiptThankYouMessage,
    disclaimer: receipt.disclaimer ?? p.receiptDisclaimer,
    birCompliantEnabled: Boolean(birEffective),
    storeTin: receipt.birTinSnapshot ?? receipt.storeTin ?? p.storeTin,
    ptuNumber: receipt.birPtuSnapshot ?? receipt.ptuNumber ?? p.ptuNumber,
    vatRateApplied: Number.isFinite(rate) ? rate : 12,
    netOfVat: netOfVat !== undefined ? netOfVat : receipt.netOfVat,
    vatAmount:
      vatAmount !== undefined && vatAmount !== null ? vatAmount : receipt.vatAmount
  };
}

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

export const buildReceiptLines = (receipt) => {
  const r = mergeReceiptWithStoreProfile(receipt);
  const lines = [];
  const storeName = r.storeName || 'Create Your Style';
  const location = r.location || 'Pasonanca, Zamboanga City';
  const receiptNo = r.receiptNo || '000000';
  const paymentMethod = r.paymentMethod || 'Cash';
  const cashier = r.cashier || r.cashierName || r.performedByName || 'Staff';


  const receiptDate = r.date || new Date().toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric'
  });
  const receiptTime = r.time || new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });


  lines.push(centerText(storeName));
  if ((r.receiptTagline || '').trim()) {
    chunkText(String(r.receiptTagline).trim()).forEach((c) => lines.push(centerText(c)));
  }
  lines.push(centerText(location));

  if (r.birCompliantEnabled && (r.storeTin || r.ptuNumber)) {
    lines.push('');
    if (r.storeTin) {
      chunkText(`TIN: ${r.storeTin}`).forEach((c) => lines.push(centerText(c)));
    }
    if (r.ptuNumber) {
      chunkText(`PTU: ${r.ptuNumber}`).forEach((c) => lines.push(centerText(c)));
    }
  }

  lines.push('--------------------------------');


  lines.push(centerText('RECEIPT'));
  lines.push(centerText(`#${receiptNo}`));
  lines.push('');


  lines.push(padLine('Date:', `${receiptDate}, ${receiptTime}`));
  lines.push(padLine('Cashier:', cashier));
  lines.push(padLine('Payment:', paymentMethod));
  lines.push('--------------------------------');


  (r.items || []).forEach((item) => {

    let itemName = (item.name || item.itemName || 'Item').toString();
    itemName = itemName.replace(/\s*\([^)]*\)\s*$/, '').trim();

    const qty = item.qty || item.quantity || 1;
    const price = item.price || item.itemPrice || 0;
    const variantSizeLine = formatReceiptVariantSizeLine(item);

    lines.push(itemName);

    if (variantSizeLine) {
      lines.push(variantSizeLine);
    }
    lines.push(`${qty} x PHP ${Number(price).toFixed(2)}`);
  });
  lines.push('--------------------------------');


  const totalPay = Number(r.total ?? r.totalAmount ?? 0);

  lines.push(padLine('Subtotal:', `PHP ${Number(r.subtotal || 0).toFixed(2)}`));
  lines.push(padLine('Discount:', `PHP ${Number(r.discount || 0).toFixed(2)}`));

  if (
    r.birCompliantEnabled &&
    r.vatAmount != null &&
    r.netOfVat != null
  ) {
    lines.push('');
    lines.push(
      padLine('Net (vatable) sales', `PHP ${Number(r.netOfVat).toFixed(2)}`)
    );
    const vr = Number(r.vatRateApplied || 12);
    lines.push(
      padLine(`VAT ${vr}%`, `PHP ${Number(r.vatAmount).toFixed(2)}`)
    );
    lines.push(padLine('Total (incl. VAT)', `PHP ${totalPay.toFixed(2)}`));
  } else {
    lines.push('');
    lines.push(padLine('Total:', `PHP ${totalPay.toFixed(2)}`));
  }

  if (r.cash !== undefined) {
    lines.push(padLine('Amount Received:', `PHP ${Number(r.cash).toFixed(2)}`));
  }

  if (r.change !== undefined) {
    lines.push(padLine('Change:', `PHP ${Number(r.change).toFixed(2)}`));
  }

  lines.push('--------------------------------');
  const thanks = r.thankYouMessage || 'Thank you for your purchase!';
  const disc = r.disclaimer || 'This is not an official receipt';
  chunkText(thanks).forEach((c) => lines.push(centerText(c)));
  chunkText(disc).forEach((c) => lines.push(centerText(c)));

  return lines;
};




const htmlEsc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const buildReceiptHTML = (receiptRaw) => {
  const receipt = mergeReceiptWithStoreProfile(receiptRaw);
  const storeName = htmlEsc(receipt.storeName || 'Create Your Style');
  const location = htmlEsc(receipt.location || 'Pasonanca, Zamboanga City');
  const tagline = (receipt.receiptTagline || '').trim();
  const receiptNo = receipt.receiptNo || '000000';
  const paymentMethod = receipt.paymentMethod || 'Cash';
  const subtotal = Number(receipt.subtotal || 0);
  const discount = Number(receipt.discount || 0);
  const total = Number(receipt.total ?? receipt.totalAmount ?? 0);
  const showBirVat =
    receipt.birCompliantEnabled &&
    receipt.vatAmount != null &&
    receipt.netOfVat != null;
  const vrHtml = Number(receipt.vatRateApplied || 12);
  const cash = receipt.cash !== undefined ? Number(receipt.cash) : null;
  const change = receipt.change !== undefined ? Number(receipt.change) : null;
  const cashier = receipt.cashier || receipt.cashierName || receipt.performedByName || 'Staff';


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

  const itemsHTML = (receipt.items || []).map((item) => {

    let itemName = (item.name || item.itemName || 'Item').toString();
    itemName = itemName.replace(/\s*\([^)]*\)\s*$/, '').trim();

    const qty = item.qty || item.quantity || 1;
    const price = Number(item.price || item.itemPrice || 0);
    const variantSizeLine = formatReceiptVariantSizeLine(item);

    let sizeColorInfo = '';
    if (variantSizeLine) {
      sizeColorInfo = `<div style="font-size: 9px; color: #a0aec0;">${variantSizeLine}</div>`;
    }

    return `
      <div style="margin-bottom: 8px;">
        <div style="font-weight: 600; font-size: 11px; color: #1a202c;">${itemName}</div>
        ${sizeColorInfo}
        <div style="font-size: 10px; color: #718096;">${qty} x PHP ${price.toFixed(2)}</div>
      </div>
    `;
  }).join('');


  const dashedLine = '<div class="dashed-line">--------------------------------</div>';

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
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .dashed-line {
            display: block !important;
            text-align: center;
            font-family: monospace;
            font-size: 10px;
            color: #333 !important;
            letter-spacing: -1px;
            margin: 8px 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
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
        .dashed-line {
          display: block;
          text-align: center;
          font-family: monospace;
          font-size: 10px;
          color: #333;
          letter-spacing: -1px;
          margin: 8px 0;
        }
      </style>
    </head>
    <body>
      <div class="receipt-container">
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 10px;">
          <div style="font-size: 16px; font-weight: bold; color: #1a365d; margin-bottom: 4px;">${storeName}</div>
          ${tagline ? `<div style="font-size: 9px; color: #718096; margin-bottom: 2px;">${htmlEsc(tagline)}</div>` : ''}
          <div style="font-size: 10px; color: #4a5568;">${location}</div>
          ${receipt.birCompliantEnabled && (receipt.storeTin || receipt.ptuNumber) ? `
          <div style="margin-top: 8px; font-size: 9px; color: #4a5568; line-height: 1.4;">
            ${receipt.storeTin ? `<div>TIN: ${htmlEsc(receipt.storeTin)}</div>` : ''}
            ${receipt.ptuNumber ? `<div>PTU: ${htmlEsc(receipt.ptuNumber)}</div>` : ''}
          </div>` : ''}
        </div>

        ${dashedLine}

        <!-- Receipt Number -->
        <div style="text-align: center; margin: 10px 0;">
          <div style="font-size: 9px; color: #718096; text-transform: uppercase; letter-spacing: 1px;">Receipt</div>
          <div style="font-size: 16px; font-weight: bold; color: #2d3748;">#${receiptNo}</div>
        </div>

        <!-- Date, Cashier, Payment -->
        <div style="margin-bottom: 10px;">
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

        ${dashedLine}

        <!-- Items -->
        <div style="padding: 10px 0;">
          ${itemsHTML || '<div style="text-align: center; color: #718096; padding: 8px;">No items</div>'}
        </div>

        ${dashedLine}

        <!-- Summary -->
        <div style="padding-top: 10px;">
          <div style="display: flex; justify-content: space-between; margin: 4px 0; font-size: 11px;">
            <span style="color: #4a5568;">Subtotal:</span>
            <span style="color: #1a202c;">PHP ${subtotal.toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 4px 0; font-size: 11px;">
            <span style="color: #4a5568;">Discount:</span>
            <span style="color: #1a202c;">PHP ${discount.toFixed(2)}</span>
          </div>
          
          ${showBirVat ? `
          <div style="display: flex; justify-content: space-between; margin: 4px 0; padding-top: 6px; font-size: 11px;">
            <span style="color: #4a5568;">Net (vatable) sales:</span>
            <span style="color: #1a202c;">PHP ${Number(receipt.netOfVat).toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 4px 0; font-size: 11px;">
            <span style="color: #4a5568;">VAT ${vrHtml}%:</span>
            <span style="color: #1a202c;">PHP ${Number(receipt.vatAmount).toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin: 8px 0; padding-top: 8px;">
            <span style="font-weight: bold; color: #1a365d; font-size: 13px;">Total (incl. VAT):</span>
            <span style="font-weight: bold; color: #1a365d; font-size: 13px;">PHP ${total.toFixed(2)}</span>
          </div>
          ` : `
          <div style="display: flex; justify-content: space-between; margin: 8px 0; padding-top: 8px;">
            <span style="font-weight: bold; color: #1a365d; font-size: 13px;">Total:</span>
            <span style="font-weight: bold; color: #1a365d; font-size: 13px;">PHP ${total.toFixed(2)}</span>
          </div>
          `}
          
          ${cash !== null ? `
          <div style="display: flex; justify-content: space-between; margin: 4px 0; font-size: 11px;">
            <span style="color: #4a5568;">Amount Received:</span>
            <span style="color: #1a202c;">PHP ${cash.toFixed(2)}</span>
          </div>
          ` : ''}
          
          ${change !== null ? `
          <div style="display: flex; justify-content: space-between; margin: 4px 0; font-size: 11px;">
            <span style="color: #4a5568;">Change:</span>
            <span style="color: #1a202c;">PHP ${change.toFixed(2)}</span>
          </div>
          ` : ''}
        </div>

        ${dashedLine}

        <!-- Footer -->
        <div style="text-align: center; margin-top: 10px;">
          <div style="font-size: 11px; color: #4a5568;">${htmlEsc(receipt.thankYouMessage || 'Thank you for your purchase!')}</div>
          <div style="font-size: 10px; color: #a0aec0; margin-top: 2px;">${htmlEsc(receipt.disclaimer || 'This is not an official receipt')}</div>
        </div>

      </div>
    </body>
    </html>
  `;
};





export async function sendReceiptToPrinter(receipt) {
  if (!receipt) throw new Error('No receipt payload provided');

  const merged = mergeReceiptWithStoreProfile(receipt);

  const printData = {

    storeName: merged.storeName || 'Create Your Style',
    contactNumber: merged.contactNumber || '+631112224444',
    location: merged.location || 'Pasonanca, Zamboanga City',


    receiptNo: merged.receiptNo || '000000',
    referenceNo: merged.referenceNo || merged.reference || '-',
    date: merged.date || new Date().toLocaleDateString(),
    time: merged.time || new Date().toLocaleTimeString(),


    cashier: merged.cashier || merged.performedByName || 'N/A',


    items: (merged.items || []).map((item) => ({
      name: item.name || item.itemName || 'Item',
      qty: item.qty || item.quantity || 1,
      price: item.price || item.itemPrice || 0,
      total: (item.price || item.itemPrice || 0) * (item.qty || item.quantity || 1),
      size: item.size || item.selectedSize || '',
      selectedSize: item.selectedSize || item.size || '',
      variant: item.selectedVariation || item.variant || '',
      selectedVariation: item.selectedVariation || item.variant || ''
    })),


    paymentMethod: merged.paymentMethod || 'CASH',
    subtotal: merged.subtotal || 0,
    discount: merged.discount || 0,
    discounts: merged.discounts || [],
    total: merged.total || 0,
    cash: merged.cash,
    change: merged.change
  };

  try {


    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 500);

    const response = await fetch('http://localhost:9100/print', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(printData),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const result = await response.json();

    if (result.success) {
      return { success: true, message: 'Receipt printed successfully' };
    } else {
      throw new Error(result.error || 'Print failed');
    }
  } catch (error) {
    console.warn('Print server not available, falling back to window.print()', error);


    return new Promise((resolve, reject) => {
      try {
        const receiptHTML = buildReceiptHTML(merged);


        let iframe = document.getElementById('receipt-print-iframe');
        if (!iframe) {
          iframe = document.createElement('iframe');
          iframe.id = 'receipt-print-iframe';
          iframe.style.cssText = 'position:fixed;top:-10000px;left:-10000px;width:0;height:0;border:none;visibility:hidden;';
          document.body.appendChild(iframe);
        }

        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(receiptHTML);
        doc.close();


        iframe.onload = () => {
          try {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            resolve({ success: true, message: 'Print dialog opened (iframe fallback)' });
          } catch (printErr) {
            reject(printErr);
          }
        };
      } catch (fallbackError) {
        reject(fallbackError);
      }
    });
  }
}
const nodemailer = require('nodemailer');

// Create reusable transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

/**
 * Send low stock alert email to owner
 * @param {string} ownerEmail - Owner's email address
 * @param {Array} lowStockItems - Array of low stock items
 */
const sendLowStockAlert = async (ownerEmail, lowStockItems) => {
  if (!ownerEmail || !lowStockItems || lowStockItems.length === 0) {
    console.log('[EmailService] No email to send - missing owner email or no low stock items');
    return { success: false, message: 'No email to send' };
  }

  const transporter = createTransporter();

  // Separate out of stock and low stock items
  const outOfStockItems = lowStockItems.filter(item => item.currentStock === 0);
  const lowItems = lowStockItems.filter(item => item.currentStock > 0);

  // Build HTML email content
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #AD7F65 0%, #76462B 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; }
        .section { margin-bottom: 20px; }
        .section-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; padding: 10px; border-radius: 5px; }
        .out-of-stock-title { background: #fee2e2; color: #dc2626; }
        .low-stock-title { background: #fef3c7; color: #d97706; }
        .item { background: white; padding: 12px; margin-bottom: 8px; border-radius: 5px; border-left: 4px solid; display: flex; justify-content: space-between; }
        .item-out { border-left-color: #dc2626; }
        .item-low { border-left-color: #f59e0b; }
        .item-name { font-weight: bold; }
        .item-sku { color: #666; font-size: 12px; }
        .item-stock { font-weight: bold; text-align: right; }
        .stock-zero { color: #dc2626; }
        .stock-low { color: #f59e0b; }
        .footer { background: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 10px 10px; }
        .summary { background: white; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .summary-item { display: inline-block; margin-right: 20px; }
        .summary-count { font-size: 24px; font-weight: bold; }
        .summary-label { font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔔 Stock Alert - ${process.env.STORE_NAME || 'Create Your Style'}</h1>
        </div>
        <div class="content">
          <div class="summary">
            <div class="summary-item">
              <div class="summary-count" style="color: #dc2626;">${outOfStockItems.length}</div>
              <div class="summary-label">Out of Stock</div>
            </div>
            <div class="summary-item">
              <div class="summary-count" style="color: #f59e0b;">${lowItems.length}</div>
              <div class="summary-label">Low Stock</div>
            </div>
            <div class="summary-item">
              <div class="summary-count">${lowStockItems.length}</div>
              <div class="summary-label">Total Alerts</div>
            </div>
          </div>
          
          ${outOfStockItems.length > 0 ? `
          <div class="section">
            <div class="section-title out-of-stock-title">⛔ Out of Stock Items (${outOfStockItems.length})</div>
            ${outOfStockItems.map(item => `
              <div class="item item-out">
                <div>
                  <div class="item-name">${item.itemName}</div>
                  <div class="item-sku">SKU: ${item.sku}</div>
                </div>
                <div class="item-stock stock-zero">0 in stock</div>
              </div>
            `).join('')}
          </div>
          ` : ''}
          
          ${lowItems.length > 0 ? `
          <div class="section">
            <div class="section-title low-stock-title">⚠️ Low Stock Items (${lowItems.length})</div>
            ${lowItems.map(item => `
              <div class="item item-low">
                <div>
                  <div class="item-name">${item.itemName}</div>
                  <div class="item-sku">SKU: ${item.sku}</div>
                </div>
                <div class="item-stock stock-low">${item.currentStock} in stock</div>
              </div>
            `).join('')}
          </div>
          ` : ''}
          
          <p style="margin-top: 20px; color: #666;">
            Please restock these items to avoid running out of inventory.
          </p>
        </div>
        <div class="footer">
          <p>This is an automated notification from ${process.env.STORE_NAME || 'Create Your Style'} POS System</p>
          <p>You will receive this alert every 5 hours while items remain low on stock.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: `"${process.env.STORE_NAME || 'Create Your Style'} POS" <${process.env.EMAIL_USER}>`,
    to: ownerEmail,
    subject: `🔔 Stock Alert: ${outOfStockItems.length} out of stock, ${lowItems.length} low stock items`,
    html: htmlContent
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EmailService] Low stock alert sent to ${ownerEmail}. Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EmailService] Failed to send low stock alert:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendLowStockAlert
};

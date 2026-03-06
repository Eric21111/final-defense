const cron = require('node-cron');
const { sendLowStockAlert } = require('./emailService');
const Product = require('../models/Product');
const Employee = require('../models/Employee');

// Track last email sent time to prevent duplicate emails
let lastEmailSentTime = null;
const MIN_EMAIL_INTERVAL_MS = 5 * 60 * 60 * 1000; // 5 hours in milliseconds

/**
 * Get low stock items from database
 */
const getLowStockItems = async () => {
  try {
    const products = await Product.find({});
    
    const lowStockItems = products.filter(p => {
      const stock = p.currentStock || 0;
      const reorder = p.reorderNumber || 5;
      return stock <= reorder && stock >= 0;
    }).map(p => ({
      _id: p._id,
      itemName: p.itemName,
      sku: p.sku,
      currentStock: p.currentStock || 0,
      reorderNumber: p.reorderNumber || 5,
      alertType: (p.currentStock || 0) === 0 ? 'out_of_stock' : 'low_stock'
    }));

    // Sort: out of stock first
    lowStockItems.sort((a, b) => {
      if (a.alertType === 'out_of_stock' && b.alertType !== 'out_of_stock') return -1;
      if (a.alertType !== 'out_of_stock' && b.alertType === 'out_of_stock') return 1;
      return a.currentStock - b.currentStock;
    });

    return lowStockItems;
  } catch (error) {
    console.error('[StockAlertCron] Error fetching low stock items:', error.message);
    return [];
  }
};

/**
 * Get owner's email from database
 */
const getOwnerEmail = async () => {
  try {
    const employees = await Employee.find({ role: 'Owner', status: 'Active' });
    
    if (employees.length > 0 && employees[0].email) {
      return employees[0].email;
    }
    
    console.log('[StockAlertCron] No active owner found in database');
    return null;
  } catch (error) {
    console.error('[StockAlertCron] Error fetching owner email:', error.message);
    return null;
  }
};


/**
 * Check if enough time has passed since last email
 */
const canSendEmail = () => {
  if (!lastEmailSentTime) {
    return true;
  }
  
  const timeSinceLastEmail = Date.now() - lastEmailSentTime;
  const canSend = timeSinceLastEmail >= MIN_EMAIL_INTERVAL_MS;
  
  if (!canSend) {
    const remainingMinutes = Math.ceil((MIN_EMAIL_INTERVAL_MS - timeSinceLastEmail) / (60 * 1000));
    console.log(`[StockAlertCron] Email cooldown active. Next email allowed in ${remainingMinutes} minutes.`);
  }
  
  return canSend;
};

/**
 * Run the stock alert check and send email if needed
 * @param {boolean} forceCheck - If true, bypasses the cooldown check (for scheduled cron only)
 */
const runStockAlertCheck = async (forceCheck = false) => {
  console.log('[StockAlertCron] Running stock alert check...');
  
  // Check cooldown unless this is a forced check from the cron schedule
  if (!forceCheck && !canSendEmail()) {
    console.log('[StockAlertCron] Skipping - email was sent recently.');
    return;
  }
  
  try {
    const lowStockItems = await getLowStockItems();
    
    if (lowStockItems.length === 0) {
      console.log('[StockAlertCron] No low stock items found. Skipping email.');
      return;
    }

    const ownerEmail = await getOwnerEmail();
    
    if (!ownerEmail) {
      console.log('[StockAlertCron] No owner email found. Skipping email.');
      return;
    }

    console.log(`[StockAlertCron] Found ${lowStockItems.length} low stock items. Sending email to ${ownerEmail}...`);
    
    const result = await sendLowStockAlert(ownerEmail, lowStockItems);
    
    if (result.success) {
      lastEmailSentTime = Date.now();
      console.log('[StockAlertCron] Stock alert email sent successfully! Next email allowed after 5 hours.');
    } else {
      console.log('[StockAlertCron] Failed to send stock alert email:', result.error || result.message);
    }
  } catch (error) {
    console.error('[StockAlertCron] Error in stock alert check:', error.message);
  }
};

/**
 * Initialize the cron job
 * Runs every 5 hours at minute 0
 */
const initStockAlertCron = () => {
  // Schedule: At minute 0 past every 5th hour (0:00, 5:00, 10:00, 15:00, 20:00)
  // Cron pattern: 0 */5 * * * (every 5 hours)
  cron.schedule('0 */5 * * *', async () => {
    console.log('[StockAlertCron] Scheduled cron triggered at', new Date().toISOString());
    await runStockAlertCheck(true); // Force check for scheduled runs
  });

  console.log('[StockAlertCron] Stock alert cron job initialized (runs every 5 hours at minute 0)');
  
  // Only run on startup if no email has been sent in the last 5 hours
  // This prevents spam when server restarts frequently
  setTimeout(async () => {
    if (canSendEmail()) {
      console.log('[StockAlertCron] Running initial stock alert check (first run or cooldown expired)...');
      await runStockAlertCheck(false);
    } else {
      console.log('[StockAlertCron] Skipping initial check - email was sent recently.');
    }
  }, 10000); // Wait 10 seconds for DB connection
};

module.exports = {
  initStockAlertCron,
  runStockAlertCheck,
  getLowStockItems,
  getOwnerEmail
};

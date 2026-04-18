const SalesTransaction = require("../models/SalesTransaction");

/** Legacy POS numbering — random 6-digit, collision-checked (non-BIR mode). */
async function generateRandomReceiptNumber() {
    let attempts = 0;
    while (attempts < 10) {
        const receiptNo = Math.floor(100000 + Math.random() * 900000).toString();
        const existing = await SalesTransaction.findOne({ receiptNo });
        if (!existing) {
            return receiptNo;
        }
        attempts++;
    }
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.floor(10 + Math.random() * 90).toString();
    return `${timestamp}${random}`;
}

module.exports = { generateRandomReceiptNumber };

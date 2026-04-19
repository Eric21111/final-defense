const ReceiptCounter = require("../models/ReceiptCounter");

const DEFAULT_RECEIPT_COUNTER_KEY = "__DEFAULT__";

/**
 * Global POS numbering — sequential 6-digit (non-BIR mode).
 * Example: 000001, 000002, ...
 */
async function generateRandomReceiptNumber() {
    const doc = await ReceiptCounter.findOneAndUpdate(
        { terminalId: DEFAULT_RECEIPT_COUNTER_KEY },
        { $inc: { lastSeq: 1 }, $setOnInsert: { terminalId: DEFAULT_RECEIPT_COUNTER_KEY } },
        { new: true, upsert: true },
    );

    return String(doc.lastSeq).padStart(6, "0");
}

module.exports = { generateRandomReceiptNumber };

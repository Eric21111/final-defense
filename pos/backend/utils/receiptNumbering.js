const ReceiptCounter = require("../models/ReceiptCounter");

const DEFAULT_RECEIPT_COUNTER_KEY = "__DEFAULT__";

/**
 * Global POS numbering — sequential 6-digit (non-BIR mode).
 * Example: 000001, 000002, ...
 */
async function generateRandomReceiptNumber() {
    const doc = await ReceiptCounter.findOneAndUpdate(
        { terminalId: DEFAULT_RECEIPT_COUNTER_KEY },
        [
            {
                $set: {
                    terminalId: DEFAULT_RECEIPT_COUNTER_KEY,
                    lastSeq: {
                        $let: {
                            vars: {
                                nextSeq: { $add: [{ $ifNull: ["$lastSeq", 0] }, 1] },
                            },
                            in: {
                                $cond: [{ $gt: ["$$nextSeq", 999999] }, 1, "$$nextSeq"],
                            },
                        },
                    },
                },
            },
        ],
        { new: true, upsert: true },
    );

    return String(doc.lastSeq).padStart(6, "0");
}

module.exports = { generateRandomReceiptNumber };

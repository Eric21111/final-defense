const ReceiptCounter = require("../models/ReceiptCounter");

/**
 * VAT-inclusive total: split into net (vatable sales) and VAT amount.
 * Philippines default VAT 12%: VAT = Total * 12/112
 */
function computeVatInclusiveBreakdown(totalIncl, vatRatePercent = 12) {
    const total = Number(totalIncl);
    const rate = Number(vatRatePercent);
    if (!Number.isFinite(total) || total < 0) {
        return { netOfVat: 0, vatAmount: 0, vatRateApplied: Number.isFinite(rate) ? rate : 12 };
    }
    if (!Number.isFinite(rate) || rate <= 0) {
        return {
            netOfVat: Math.round(total * 100) / 100,
            vatAmount: 0,
            vatRateApplied: 0,
        };
    }
    const factor = 1 + rate / 100;
    const net = total / factor;
    const vat = total - net;
    return {
        netOfVat: Math.round(net * 100) / 100,
        vatAmount: Math.round(vat * 100) / 100,
        vatRateApplied: rate,
    };
}

/**
 * Atomically increment and return next receipt number for a terminal.
 * @returns {{ receiptNo: string, terminalId: string }}
 */
async function getNextSequentialReceiptNo(terminalIdRaw) {
    const safe = String(terminalIdRaw || "")
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 32);
    if (!safe) {
        const e = new Error(
            "Terminal ID is required for BIR-compliant sequential receipts.",
        );
        e.code = "TERMINAL_ID_REQUIRED";
        throw e;
    }
    const doc = await ReceiptCounter.findOneAndUpdate(
        { terminalId: safe },
        { $inc: { lastSeq: 1 }, $setOnInsert: { terminalId: safe } },
        { new: true, upsert: true },
    );
    const n = doc.lastSeq;
    return {
        receiptNo: `${safe}-${String(n).padStart(6, "0")}`,
        terminalId: safe,
    };
}

module.exports = {
    computeVatInclusiveBreakdown,
    getNextSequentialReceiptNo,
};

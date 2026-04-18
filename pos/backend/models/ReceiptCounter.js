const mongoose = require("mongoose");

/**
 * Per-terminal sequential receipt counter for BIR-compliant numbering.
 * receiptNo format: {terminalId}-{000001}
 */
const receiptCounterSchema = new mongoose.Schema(
    {
        terminalId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            maxlength: 32,
        },
        lastSeq: {
            type: Number,
            default: 0,
            min: 0,
        },
    },
    { timestamps: true },
);

receiptCounterSchema.index({ terminalId: 1 }, { unique: true });

module.exports = mongoose.model("ReceiptCounter", receiptCounterSchema);

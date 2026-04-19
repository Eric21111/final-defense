const mongoose = require("mongoose");

const openingFloatEntrySchema = new mongoose.Schema(
    {
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Employee",
            required: true,
        },
        employeeName: {
            type: String,
            required: true,
            trim: true,
        },
        employeeRole: {
            type: String,
            default: "",
            trim: true,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        businessDate: {
            type: Date,
            default: Date.now,
        },
        updatedAt: {
            type: Date,
            default: null,
        },
    },
    { _id: true }
);

const globalSettingsSchema = new mongoose.Schema(
    {
        storeName: {
            type: String,
            default: "Create Your Style",
        },
        receiptTagline: {
            type: String,
            default: "",
            trim: true,
        },
        receiptAddress: {
            type: String,
            default: "Pasonanca, Zamboanga City",
            trim: true,
        },
        receiptContactNumber: {
            type: String,
            default: "+631112224444",
            trim: true,
        },
        receiptThankYouMessage: {
            type: String,
            default: "Thank you for your purchase!",
            trim: true,
        },
        receiptDisclaimer: {
            type: String,
            default: "This is not an official receipt",
            trim: true,
        },
        /** BIR registration–ready receipt mode (sequential receipt #, TIN/PTU/VAT on receipt). */
        birCompliantEnabled: {
            type: Boolean,
            default: false,
        },
        /** Placeholder until actual TIN registration — shown on receipt when BIR mode is on. */
        storeTin: {
            type: String,
            default: "000-000-000-000",
            trim: true,
        },
        ptuNumber: {
            type: String,
            default: "",
            trim: true,
        },
        /** Standard PH VAT rate for VAT-inclusive totals (default 12). */
        vatRatePercent: {
            type: Number,
            default: 12,
            min: 0,
            max: 100,
        },
        /** POS terminal label for BIR sequential receipt numbers (e.g. POS01). Synced with Settings save. */
        posTerminalId: {
            type: String,
            default: "",
            trim: true,
            maxlength: 32,
        },
        openingFloat: {
            type: Number,
            default: 2000,
        },
        openingFloats: {
            type: [openingFloatEntrySchema],
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("GlobalSettings", globalSettingsSchema);

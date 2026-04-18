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

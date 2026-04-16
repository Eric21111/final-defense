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

const mongoose = require('mongoose');

const remittanceSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    employeeName: {
        type: String,
        required: true
    },
    shiftDate: {
        type: Date,
        required: true
    },
    grossSales: {
        type: Number,
        required: true,
        default: 0
    },
    returns: {
        type: Number,
        default: 0
    },
    netSales: {
        type: Number,
        required: true,
        default: 0
    },
    noOfSales: {
        type: Number,
        default: 0
    },
    denominations: {
        p1000: { type: Number, default: 0 },
        p500: { type: Number, default: 0 },
        p200: { type: Number, default: 0 },
        p100: { type: Number, default: 0 },
        p50: { type: Number, default: 0 },
        p20: { type: Number, default: 0 },
        p10: { type: Number, default: 0 },
        p5: { type: Number, default: 0 },
        p1: { type: Number, default: 0 },
        c25: { type: Number, default: 0 },
        c10: { type: Number, default: 0 },
        c5: { type: Number, default: 0 }
    },
    totalCashOnHand: {
        type: Number,
        required: true,
        default: 0
    },
    openingFloat: {
        type: Number,
        default: 2000
    },
    cashToRemit: {
        type: Number,
        required: true,
        default: 0
    },
    expectedCash: {
        type: Number,
        default: 0
    },
    variance: {
        type: Number,
        default: 0
    },
    remarks: {
        type: String,
        default: ''
    },
    receivedBy: {
        type: String,
        default: ''
    },
    status: {
        type: String,
        enum: ['Submitted', 'Reviewed'],
        default: 'Submitted'
    },
    submittedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

remittanceSchema.index({ employeeId: 1, shiftDate: -1 });
remittanceSchema.index({ submittedAt: -1 });
remittanceSchema.index({ status: 1 });

module.exports.schema = remittanceSchema;
module.exports = mongoose.model('Remittance', remittanceSchema);

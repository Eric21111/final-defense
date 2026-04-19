const mongoose = require('mongoose');
const Remittance = require('../models/Remittance');
const SalesTransaction = require('../models/SalesTransaction');
const GlobalSettings = require('../models/GlobalSettings');

const startOfLocalDay = (value = new Date()) => {
    const date = new Date(value);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const isSameLocalDay = (left, right) => {
    const a = startOfLocalDay(left);
    const b = startOfLocalDay(right);
    return a.getTime() === b.getTime();
};

const sumOpeningFloatsInRange = async ({ employeeId, lo, hi, allTime }) => {
    const settings = await GlobalSettings.findOne().lean();
    if (!settings || !Array.isArray(settings.openingFloats)) {
        return 0;
    }

    const employeeIdStr = employeeId && String(employeeId).trim() ? String(employeeId).trim() : null;
    const loDay = allTime ? null : startOfLocalDay(lo);
    const hiDay = allTime ? null : startOfLocalDay(hi);

    return settings.openingFloats.reduce((sum, entry) => {
        if (!entry) return sum;

        const entryEmployeeId = String(entry?.employeeId?._id || entry?.employeeId || '').trim();
        if (employeeIdStr && entryEmployeeId !== employeeIdStr) {
            return sum;
        }

        const effectiveDate = new Date(entry.businessDate || entry.createdAt || 0);
        if (Number.isNaN(effectiveDate.getTime())) {
            return sum;
        }

        if (!allTime) {
            const entryDay = startOfLocalDay(effectiveDate);
            if (entryDay < loDay || entryDay > hiDay) {
                return sum;
            }
        }

        const amount = Number(entry.amount);
        if (!Number.isFinite(amount)) {
            return sum;
        }

        return sum + amount;
    }, 0);
};

const getOpeningFloatForEmployee = async (employeeId) => {
    const settings = await GlobalSettings.findOne().lean();
    if (!settings) {
        return 0;
    }

    const entries = Array.isArray(settings.openingFloats) ? settings.openingFloats : [];
    const employeeIdStr = String(employeeId || '').trim();

    const employeeFloatTotal = entries.reduce((sum, entry) => {
        if (String(entry?.employeeId || '').trim() !== employeeIdStr) {
            return sum;
        }
        const effectiveDate = entry?.businessDate || entry?.createdAt;
        if (!effectiveDate || !isSameLocalDay(effectiveDate, new Date())) {
            return sum;
        }
        return sum + (Number(entry?.amount) || 0);
    }, 0);

    if (employeeFloatTotal > 0) {
        return employeeFloatTotal;
    }

    return 0;
};

const buildTodayRemittanceQuery = (employeeId, startOfDay, endOfDay) => ({
    employeeId,
    $or: [
        { submittedAt: { $gte: startOfDay, $lt: endOfDay } },
        { shiftDate: { $gte: startOfDay, $lt: endOfDay } }
    ]
});

// GET /api/remittances/summary?employeeId=xxx
exports.getRemittanceSummary = async (req, res) => {
    try {
        const { employeeId } = req.query;

        if (!employeeId) {
            return res.status(400).json({ success: false, message: 'Employee ID is required' });
        }

        // Get start and end of today
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

        // Cash remittance basis:
        // 1) Gross Sales = sales made by this cashier BEFORE any return deductions
        // 2) Returns Processed = refunds this cashier processed (even for another cashier's sale)
        // 3) Net Remittance = Gross Sales - Returns Processed
        const completedTransactions = await SalesTransaction.find({
            performedById: employeeId,
            status: { $in: ['Completed', 'Partially Returned', 'Returned'] },
            checkedOutAt: { $gte: startOfDay, $lt: endOfDay },
            paymentMethod: { $ne: 'return' }
        })
            .select('_id totalAmount status')
            .lean();

        const returnTransactionsProcessed = await SalesTransaction.find({
            paymentMethod: 'return',
            $or: [
                { performedById: employeeId },
                { returnedById: employeeId }
            ],
            checkedOutAt: { $gte: startOfDay, $lt: endOfDay }
        })
            .select('totalAmount')
            .lean();

        const completedTransactionIds = completedTransactions
            .map((t) => t?._id)
            .filter(Boolean);

        const returnTransactionsAgainstOwnSales =
            completedTransactionIds.length > 0
                ? await SalesTransaction.find({
                      paymentMethod: 'return',
                      originalTransactionId: { $in: completedTransactionIds },
                      checkedOutAt: { $gte: startOfDay, $lt: endOfDay }
                  })
                      .select('totalAmount')
                      .lean()
                : [];

        const [existingTodayRemittance, openingFloatTotal] = await Promise.all([
            Remittance.findOne(
                buildTodayRemittanceQuery(employeeId, startOfDay, endOfDay)
            )
                .sort({ submittedAt: -1 })
                .lean(),
            getOpeningFloatForEmployee(employeeId)
        ]);

        const salesAfterReturnDeductions = completedTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
        const returnsAgainstOwnSales = returnTransactionsAgainstOwnSales.reduce((sum, t) => sum + Math.abs(t.totalAmount || 0), 0);
        const grossSales = salesAfterReturnDeductions + returnsAgainstOwnSales;
        const returnsProcessed = returnTransactionsProcessed.reduce((sum, t) => sum + Math.abs(t.totalAmount || 0), 0);
        const netRemittance = grossSales - returnsProcessed;
        const noOfSales = completedTransactions.filter((t) => t.status !== 'Returned').length;

        res.json({
            success: true,
            data: {
                shiftDate: startOfDay,
                grossSales,
                returns: returnsProcessed,
                returnsProcessed,
                netSales: netRemittance,
                netRemittance,
                noOfSales,
                openingFloatTotal,
                alreadyRemittedToday: !!existingTodayRemittance,
                remittedAmountToday: existingTodayRemittance?.cashToRemit || 0,
                remittedAtToday: existingTodayRemittance?.submittedAt || null
            }
        });
    } catch (error) {
        console.error('Error fetching remittance summary:', error);
        res.status(500).json({ success: false, message: 'Error fetching remittance summary', error: error.message });
    }
};

// POST /api/remittances
exports.createRemittance = async (req, res) => {
    try {
        const {
            employeeId,
            employeeName,
            shiftDate,
            grossSales,
            returns,
            netSales,
            noOfSales,
            denominations,
            totalCashOnHand,
            openingFloat,
            cashToRemit,
            expectedCash,
            variance,
            remarks,
            receivedBy
        } = req.body;

        if (!employeeId || !employeeName) {
            return res.status(400).json({ success: false, message: 'Employee ID and name are required' });
        }

        // Enforce one remittance per employee per day.
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

        const existingToday = await Remittance.findOne(
            buildTodayRemittanceQuery(employeeId, startOfDay, endOfDay)
        )
            .sort({ submittedAt: -1 })
            .lean();

        if (existingToday) {
            return res.status(409).json({
                success: false,
                code: 'ALREADY_REMITTED_TODAY',
                message: `You already remitted today. Amount remitted: ₱${(existingToday.cashToRemit || 0).toLocaleString('en-PH', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                })}`,
                data: {
                    amountRemitted: existingToday.cashToRemit || 0,
                    submittedAt: existingToday.submittedAt,
                    remittanceId: existingToday._id
                }
            });
        }

        const remittance = await Remittance.create({
            employeeId,
            employeeName,
            shiftDate: shiftDate || new Date(),
            grossSales: grossSales || 0,
            returns: returns || 0,
            netSales: netSales || 0,
            noOfSales: noOfSales || 0,
            denominations: denominations || {},
            totalCashOnHand: totalCashOnHand || 0,
            openingFloat: openingFloat != null ? openingFloat : 0,
            cashToRemit: cashToRemit || 0,
            expectedCash: expectedCash || 0,
            variance: variance || 0,
            remarks: remarks || '',
            receivedBy: receivedBy || '',
            status: 'Submitted',
            submittedAt: new Date()
        });

        res.status(201).json({
            success: true,
            message: 'Remittance submitted successfully',
            data: remittance
        });
    } catch (error) {
        console.error('Error creating remittance:', error);
        res.status(500).json({ success: false, message: 'Error creating remittance', error: error.message });
    }
};


exports.getRemittanceKpiStats = async (req, res) => {
    try {
        const { startMs, endMs, startDate, endDate, employeeId } = req.query;

        let lo;
        let hi;
        let allTime = false;

        if (startMs != null && endMs != null && String(startMs).trim() !== '' && String(endMs).trim() !== '') {
            const sm = Number(startMs);
            const em = Number(endMs);
            if (!Number.isFinite(sm) || !Number.isFinite(em)) {
                return res.status(400).json({ success: false, message: 'Invalid startMs or endMs' });
            }
            lo = new Date(sm);
            hi = new Date(em);
        } else if (startDate || endDate) {
            lo = startDate ? new Date(startDate) : new Date(0);
            hi = endDate ? new Date(endDate) : new Date(8640000000000000);
            if (Number.isNaN(lo.getTime())) {
                return res.status(400).json({ success: false, message: 'Invalid startDate' });
            }
            if (Number.isNaN(hi.getTime())) {
                return res.status(400).json({ success: false, message: 'Invalid endDate' });
            }
        } else {
            allTime = true;
        }

        const empIdStr =
            employeeId && String(employeeId).trim() ? String(employeeId).trim() : null;

        const transactionDateOr = allTime
            ? null
            : {
                  $or: [
                      { checkedOutAt: { $gte: lo, $lte: hi } },
                      {
                          $and: [
                              {
                                  $or: [
                                      { checkedOutAt: { $exists: false } },
                                      { checkedOutAt: null }
                                  ]
                              },
                              { createdAt: { $gte: lo, $lte: hi } }
                          ]
                      }
                  ]
              };

        const salesMatch = {
            status: { $in: ['Completed', 'Partially Returned', 'Returned'] },
            paymentMethod: { $ne: 'return' },
            ...(transactionDateOr || {})
        };
        if (empIdStr) {
            salesMatch.performedById = empIdStr;
        }

        const [completedTransactions, rawReturnTransactions, remitAgg, openingFloatTotal] = await Promise.all([
            SalesTransaction.find(salesMatch).select('_id totalAmount').lean(),
            SalesTransaction.find({
                paymentMethod: 'return',
                ...(empIdStr
                    ? {
                        $or: [
                            { performedById: empIdStr },
                            { returnedById: empIdStr }
                        ]
                    }
                    : {}),
                ...(transactionDateOr || {})
            }).select('totalAmount').lean(),
            (() => {
                const shiftMatch = {};
                if (!allTime) {
                    shiftMatch.shiftDate = { $gte: lo, $lte: hi };
                }
                if (empIdStr && mongoose.Types.ObjectId.isValid(empIdStr)) {
                    shiftMatch.employeeId = new mongoose.Types.ObjectId(empIdStr);
                }
                return Remittance.aggregate([
                    { $match: shiftMatch },
                    {
                        $group: {
                            _id: null,
                            totalRemitted: { $sum: { $ifNull: ['$cashToRemit', 0] } },
                            slipNetSales: { $sum: { $ifNull: ['$netSales', 0] } },
                            totalSlipVariance: { $sum: { $ifNull: ['$variance', 0] } },
                            remittanceCount: { $sum: 1 }
                        }
                    }
                ]);
            })(),
            sumOpeningFloatsInRange({
                employeeId: empIdStr,
                lo,
                hi,
                allTime
            })
        ]);

        const completedTransactionIds = completedTransactions
            .map((t) => t?._id)
            .filter(Boolean);

        const ownSalesReturnTransactions =
            completedTransactionIds.length > 0
                ? await SalesTransaction.find({
                      paymentMethod: 'return',
                      originalTransactionId: { $in: completedTransactionIds },
                      ...(transactionDateOr || {})
                  })
                      .select('totalAmount')
                      .lean()
                : [];

        const salesAfterReturnDeductions = completedTransactions.reduce(
            (s, t) => s + (Number(t.totalAmount) || 0),
            0
        );
        const returnsAgainstOwnSales = ownSalesReturnTransactions.reduce(
            (s, t) => s + Math.abs(Number(t.totalAmount) || 0),
            0
        );
        const grossSales = salesAfterReturnDeductions + returnsAgainstOwnSales;
        const returnsProcessed = rawReturnTransactions.reduce(
            (s, t) => s + Math.abs(Number(t.totalAmount) || 0),
            0
        );
        const netRemittance = grossSales - returnsProcessed;

        const row = remitAgg[0] || {
            totalRemitted: 0,
            slipNetSales: 0,
            totalSlipVariance: 0,
            remittanceCount: 0
        };
        const totalRemitted = row.totalRemitted || 0;
        // KPI "Expected Cash" should reflect cash generated from sales/remittance,
        // not include assigned opening float (which is tracked separately).
        const expectedCash = netRemittance;
        const unremittedCash = expectedCash - totalRemitted;
        const hasRemittance = (row.remittanceCount || 0) > 0;
        const totalVariance = hasRemittance ? (row.totalSlipVariance || 0) : 0;

        res.json({
            success: true,
            data: {
                posNetSales: salesAfterReturnDeductions,
                grossSales,
                returns: returnsProcessed,
                netRemittance,
                openingFloatTotal: openingFloatTotal || 0,
                expectedCash,
                totalRemitted,
                totalVariance,
                hasRemittance,
                slipNetSalesSum: row.slipNetSales || 0,
                unremittedCash
            }
        });
    } catch (error) {
        console.error('Error fetching remittance KPI stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching remittance KPI stats',
            error: error.message
        });
    }
};

// GET /api/remittances
exports.getRemittances = async (req, res) => {
    try {
        const remittances = await Remittance.find({})
            .sort({ submittedAt: -1 })
            .lean();

        res.json({
            success: true,
            count: remittances.length,
            data: remittances
        });
    } catch (error) {
        console.error('Error fetching remittances:', error);
        res.status(500).json({ success: false, message: 'Error fetching remittances', error: error.message });
    }
};

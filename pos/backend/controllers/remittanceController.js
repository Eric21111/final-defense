const Remittance = require('../models/Remittance');
const SalesTransaction = require('../models/SalesTransaction');

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

        // Get all completed transactions for this employee today
        const completedTransactions = await SalesTransaction.find({
            performedById: employeeId,
            status: { $in: ['Completed', 'Partially Returned'] },
            checkedOutAt: { $gte: startOfDay, $lt: endOfDay },
            paymentMethod: { $ne: 'return' }
        }).lean();

        // Get all return transactions for this employee today
        const returnTransactions = await SalesTransaction.find({
            performedById: employeeId,
            paymentMethod: 'return',
            checkedOutAt: { $gte: startOfDay, $lt: endOfDay }
        }).lean();

        const existingTodayRemittance = await Remittance.findOne(
            buildTodayRemittanceQuery(employeeId, startOfDay, endOfDay)
        )
            .sort({ submittedAt: -1 })
            .lean();

        const grossSales = completedTransactions.reduce((sum, t) => sum + (t.totalAmount || 0), 0);
        const returns = returnTransactions.reduce((sum, t) => sum + Math.abs(t.totalAmount || 0), 0);
        const netSales = grossSales - returns;
        const noOfSales = completedTransactions.length;

        res.json({
            success: true,
            data: {
                shiftDate: startOfDay,
                grossSales,
                returns,
                netSales,
                noOfSales,
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
            openingFloat: openingFloat != null ? openingFloat : 2000,
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

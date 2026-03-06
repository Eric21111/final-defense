const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function debug() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected!');

        const SalesTransaction = require('./models/SalesTransaction');

        // Current date
        const now = new Date();
        console.log('Current Date:', now);
        console.log('Current Year:', now.getFullYear());

        // Get date range for yearly timeframe
        const start = new Date(now.getFullYear() - 4, 0, 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(now);
        end.setHours(23, 59, 59, 999);

        console.log('\\n=== Date Range for yearly ===');
        console.log('Start:', start);
        console.log('End:', end);

        // Get all transactions
        const allTxns = await SalesTransaction.find({}).sort({ createdAt: -1 }).limit(5).lean();
        console.log('\\n=== Last 5 Transactions (any) ===');
        allTxns.forEach(t => {
            console.log('ID:', t._id);
            console.log('  createdAt:', t.createdAt);
            console.log('  checkedOutAt:', t.checkedOutAt || 'NOT SET');
            console.log('  status:', t.status);
            console.log('  paymentMethod:', t.paymentMethod);
            console.log('  totalAmount:', t.totalAmount);
        });

        // Test the query from reportController  
        const query = {
            paymentMethod: { $ne: 'return' },
            status: { $not: { $regex: /^void/i } },
        };

        console.log('\\n=== Simple Query ===');
        const matchingSimple = await SalesTransaction.find(query).lean();
        console.log('Matching (simple):', matchingSimple.length);

        // Now test with date range
        query.$or = [
            { checkedOutAt: { $gte: start, $lte: end } },
            {
                checkedOutAt: { $exists: false },
                createdAt: { $gte: start, $lte: end },
            },
        ];

        console.log('\\n=== With Date Range ===');
        const matchingTxns = await SalesTransaction.find(query).lean();
        console.log('Matching (with dates):', matchingTxns.length);
        matchingTxns.slice(0, 3).forEach(t => {
            console.log('ID:', t._id, 'Amount:', t.totalAmount, 'Created:', t.createdAt);
        });

    } catch (err) {
        console.error('Error:', err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

debug();

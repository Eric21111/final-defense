
const getTime = () => new Date();

function generateBuckets(timeframe, start, end) {
    const buckets = [];
    const now = new Date();

    switch (timeframe) {
        case "daily": {
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                d.setHours(0, 0, 0, 0);
                buckets.push({
                    key: `day_${d.getFullYear()}_${d.getMonth()}_${d.getDate()}`,
                    date: new Date(d),
                });
            }
            break;
        }
        case "yearly": {
            for (let i = 4; i >= 0; i--) {
                const year = now.getFullYear() - i;
                buckets.push({
                    key: `year_${year}`,
                    date: new Date(year, 0, 1),
                });
            }
            break;
        }
    }
    return buckets;
}

function getBucketKey(date, timeframe) {
    switch (timeframe) {
        case "daily": {
            return `day_${date.getFullYear()}_${date.getMonth()}_${date.getDate()}`;
        }
        case "yearly": {
            return `year_${date.getFullYear()}`;
        }
    }
    return null;
}

const now = new Date();
console.log('Current Date:', now);

// Test Daily
const dailyBuckets = generateBuckets('daily');
console.log('Daily Buckets:', dailyBuckets.map(b => b.key));
const dailyKey = getBucketKey(now, 'daily');
console.log('Daily Key for Now:', dailyKey);
console.log('Match Daily:', dailyBuckets.some(b => b.key === dailyKey));

// Test Yearly
const yearlyBuckets = generateBuckets('yearly');
console.log('Yearly Buckets:', yearlyBuckets.map(b => b.key));
const yearlyKey = getBucketKey(now, 'yearly');
console.log('Yearly Key for Now:', yearlyKey);
console.log('Match Yearly:', yearlyBuckets.some(b => b.key === yearlyKey));

// Test with a mock transaction date from 2026
const txnDate = new Date('2026-02-15T10:00:00Z');
console.log('Txn Date:', txnDate);
const txnKey = getBucketKey(txnDate, 'yearly');
console.log('Txn Key (Yearly):', txnKey);
console.log('Match Txn Yearly:', yearlyBuckets.some(b => b.key === txnKey));

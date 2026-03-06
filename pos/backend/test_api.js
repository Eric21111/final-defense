const http = require('http');
const fs = require('fs');

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/reports/inventory-analytics?timeframe=yearly',
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
};

const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('Response received:');
        console.log(data);
        fs.writeFileSync('analytics_response.json', data);
        console.log('\\nSaved to analytics_response.json');

        try {
            const jsonData = JSON.parse(data);
            console.log('\\n=== KPIs ===');
            console.log('Total Sales:', jsonData.data?.kpis?.totalSales);
            console.log('COGS:', jsonData.data?.kpis?.cogs);
            console.log('Total Profit:', jsonData.data?.kpis?.totalProfit);
            console.log('\\n=== Stats ===');
            console.log('Total Items:', jsonData.data?.stats?.totalItems);
            console.log('Stock-In Count:', jsonData.data?.stats?.stockInCount);
            console.log('\\n=== Charts ===');
            console.log('Inventory Chart Data Length:', jsonData.data?.inventoryChartData?.length);
            console.log('Profit Chart Data Length:', jsonData.data?.profitChartData?.length);
        } catch (e) {
            console.error('Error parsing JSON:', e.message);
        }
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.end();

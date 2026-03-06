/* eslint-disable no-console */
/**
 * Script to sync employees from MongoDB Atlas to local database
 * 
 * Usage: node backend/scripts/syncEmployees.js
 */

const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/sync-employees',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('Syncing employees from Atlas to local database...');
console.log('========================================');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      if (result.success) {
        console.log('\n✓ Sync completed successfully!');
        console.log(`  - New employees synced: ${result.synced}`);
        console.log(`  - Employees updated: ${result.updated}`);
        console.log(`  - Errors: ${result.errors}`);
        console.log(`  - Total employees in Atlas: ${result.total}`);
        console.log(`  - Timestamp: ${result.timestamp}`);
      } else {
        console.error('\n✗ Sync failed:', result.message);
        if (result.error) {
          console.error('  Error:', result.error);
        }
      }
    } catch (error) {
      console.error('\n✗ Failed to parse response:', error.message);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('\n✗ Request failed:', error.message);
  console.error('\nMake sure the backend server is running on port 5000');
  console.error('Start the server with: npm run dev (or npm start)');
});

req.end();


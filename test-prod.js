const fs = require('fs');

async function test() {
    const res = await fetch('http://localhost:5000/api/products');
    const data = await res.json();
    const prod = data.data.find(p => p.itemName === 'BKK DRESS' && p.variant === 'White, Red, Blue');
    if (!prod) {
        const backup = data.data.filter(p => p.itemName.includes('BKK DRESS'));
        fs.writeFileSync('bkk.json', JSON.stringify(backup, null, 2));
    } else {
        fs.writeFileSync('bkk.json', JSON.stringify(prod, null, 2));
    }
}

test();

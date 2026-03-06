# Database Data Deletion Script

This script allows you to delete data from your database collections. Use with caution as this action is **irreversible**.

## ⚠️ WARNING

**This script will permanently delete data from your database. Make sure you have backups before running this script!**

## Usage

### Delete All Data from Main Database

```bash
# Preview what will be deleted (requires confirmation)
npm run delete-data

# Delete all data without confirmation
npm run delete-all

# Or directly:
node scripts/deleteDatabaseData.js --yes
```

### Delete All Data from Both Main and Local Databases

```bash
npm run delete-all-local

# Or directly:
node scripts/deleteDatabaseData.js --yes --local
```

### Delete Specific Collection

```bash
# Delete a specific collection (preview mode)
node scripts/deleteDatabaseData.js products

# Delete a specific collection (execute)
node scripts/deleteDatabaseData.js products --yes

# Delete from both main and local databases
node scripts/deleteDatabaseData.js products --yes --local
```

## Available Collections

- `products` - Product inventory
- `employees` - Employee accounts
- `transactions` - Sales transactions
- `stock-movements` - Stock movement logs
- `archives` - Archived items
- `carts` - Shopping carts
- `discounts` - Discount codes
- `void-logs` - Void transaction logs

## Command Line Options

- `--yes` or `-y` - Skip confirmation and execute deletion
- `--local` or `-l` - Also delete from local database
- `<collection-name>` - Delete specific collection only

## Examples

```bash
# Preview deletion of all collections
node scripts/deleteDatabaseData.js

# Delete all products
node scripts/deleteDatabaseData.js products --yes

# Delete all transactions from both databases
node scripts/deleteDatabaseData.js transactions --yes --local

# Delete everything from main database only
node scripts/deleteDatabaseData.js --yes

# Delete everything from both databases
node scripts/deleteDatabaseData.js --yes --local
```

## Safety Features

1. **Confirmation Required**: By default, the script shows a preview and requires the `--yes` flag to execute
2. **Collection Validation**: Validates collection names before deletion
3. **Error Handling**: Continues with other collections if one fails
4. **Summary Report**: Shows detailed results after deletion

## Notes

- The script connects to the database using your existing configuration
- It respects your database manager setup (cloud/local)
- Deletion is performed using `deleteMany({})` which removes all documents but keeps the collection structure
- Indexes and schema definitions are preserved

/*
  CouchDB Restore Script
  ----------------------
  Restores documents from a JSON backup produced by backup-db.js into the target database.

  Notes:
  - Uses _bulk_docs with new_edits=false to preserve _rev history where possible.
  - Best used to restore into a fresh database or after dropping conflicting docs.

  Usage (Windows cmd.exe):
    set COUCHDB_URL=http://admin:password@localhost:5984 && node scripts/restore-db.js path/to/backup.json

  Optional env:
    COUCHDB_DB  (overrides the db name inside backup meta)
*/

const fs = require('fs');
const nanoLib = require('nano');

async function main() {
  const couchUrl = process.env.COUCHDB_URL;
  const backupPath = process.argv[2];
  if (!couchUrl) {
    console.error('COUCHDB_URL is not set. Example: set COUCHDB_URL=http://admin:password@localhost:5984');
    process.exit(1);
  }
  if (!backupPath || !fs.existsSync(backupPath)) {
    console.error('Provide path to backup JSON. Example: node scripts/restore-db.js backups/backup-smartattend-2025-01-01T00-00-00-000Z.json');
    process.exit(1);
  }

  const payload = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const sourceDbName = process.env.COUCHDB_DB || payload?.meta?.db || 'smartattend';

  const nano = nanoLib({ url: couchUrl });
  const dbList = await nano.db.list();
  if (!dbList.includes(sourceDbName)) {
    console.log(`Database '${sourceDbName}' not found. Creating...`);
    await nano.db.create(sourceDbName);
  }
  const db = nano.db.use(sourceDbName);

  const docs = payload.docs || [];
  console.log(`Restoring ${docs.length} documents into '${sourceDbName}'...`);

  const batchSize = 100;
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = docs.slice(i, i + batchSize);
    const resp = await db.bulk({ docs: batch, new_edits: false });
    const errors = resp.filter(r => r.error);
    if (errors.length) {
      console.error('Errors during bulk restore:', errors.slice(0, 5));
      throw new Error(`Bulk restore failed for batch starting at index ${i}`);
    }
    console.log(`Restored ${Math.min(i + batchSize, docs.length)}/${docs.length} docs...`);
  }

  console.log('Restore complete.');
}

main().catch(err => {
  console.error('Restore failed:', err);
  process.exit(1);
});

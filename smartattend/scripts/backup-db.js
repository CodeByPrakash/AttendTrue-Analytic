/*
  CouchDB Backup Script
  ---------------------
  Exports all documents from the target database into a timestamped JSON file under ./backups.

  Usage (Windows cmd.exe):
    set COUCHDB_URL=http://admin:password@localhost:5984 && node scripts/backup-db.js

  Optional env:
    COUCHDB_DB   (default: smartattend)
    BACKUP_DIR   (default: ./backups)
*/

const fs = require('fs');
const path = require('path');
const nanoLib = require('nano');

async function main() {
  const couchUrl = process.env.COUCHDB_URL;
  const dbName = process.env.COUCHDB_DB || 'smartattend';
  const backupDir = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');

  if (!couchUrl) {
    console.error('COUCHDB_URL is not set. Example: set COUCHDB_URL=http://admin:password@localhost:5984');
    process.exit(1);
  }

  const nano = nanoLib({ url: couchUrl });
  try {
    const dbList = await nano.db.list();
    if (!dbList.includes(dbName)) {
      console.error(`Database '${dbName}' does not exist on the server.`);
      process.exit(1);
    }
  } catch (err) {
    console.error('Failed to connect to CouchDB:', err.message);
    process.exit(1);
  }

  const db = nano.db.use(dbName);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `backup-${dbName}-${timestamp}.json`;
  const outPath = path.join(backupDir, fileName);

  fs.mkdirSync(backupDir, { recursive: true });

  console.log(`Fetching all documents from '${dbName}'...`);
  const result = await db.list({ include_docs: true });
  const docs = (result.rows || []).map(r => r.doc).filter(Boolean);
  const meta = {
    db: dbName,
    exportedAt: new Date().toISOString(),
    count: docs.length,
  };

  const payload = { meta, docs };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Backup written: ${outPath}`);
}

main().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});

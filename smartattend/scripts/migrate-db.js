/*
  CouchDB Migration Script
  ------------------------
  Upgrades existing user documents to the new nested schema with a version flag.

  What it does:
  - Ensures user docs have nested fields: profile {address, phone, imageUrl}, academic {rollNo, registrationNo, section, branch}, biometrics {}
  - Moves legacy flat fields (phone, profileImageUrl, rollNo, registrationNo, section, branch, faceDescriptor) into nested fields.
  - Sets schemaVersion = 2 on migrated docs; skips docs already at >= 2.
  - Preserves existing _id and _rev and any unrelated fields.

  Usage (Windows cmd.exe):
    set COUCHDB_URL=http://admin:password@localhost:5984 && node scripts/migrate-db.js

  Optional env:
    COUCHDB_DB   (default: smartattend)
    DRY_RUN      (set to 1 to preview without writing)
*/

const nanoLib = require('nano');

function toNumberArrayMaybe(val) {
  // Convert comma-separated or stringified arrays into number arrays, when possible
  if (Array.isArray(val)) return val.map(Number).filter(n => Number.isFinite(n));
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map(Number).filter(n => Number.isFinite(n));
    } catch (_) {}
    // fallback: split by commas
    const parts = val.split(',').map(s => Number(s.trim())).filter(n => Number.isFinite(n));
    if (parts.length) return parts;
  }
  return undefined;
}

async function main() {
  const couchUrl = process.env.COUCHDB_URL;
  const dbName = process.env.COUCHDB_DB || 'smartattend';
  const dryRun = process.env.DRY_RUN === '1';

  if (!couchUrl) {
    console.error('COUCHDB_URL is not set. Example: set COUCHDB_URL=http://admin:password@localhost:5984');
    process.exit(1);
  }

  const nano = nanoLib({ url: couchUrl });
  const db = nano.db.use(dbName);

  console.log(`Scanning database '${dbName}' for user docs...`);
  const result = await db.find({
    selector: { type: 'user' },
    fields: ['_id', '_rev', 'type', 'schemaVersion', 'email', 'name', 'role', 'password', 'isApproved', 'approvalStatus', 'approvedBy', 'approvedAt', 'registeredAt', 'faceDescriptor', 'courses', 'department', 'studentId', 'phone', 'profileImageUrl', 'rollNo', 'registrationNo', 'section', 'branch', 'profile', 'academic', 'biometrics', 'faceScanStatus', 'faceScanTimestamp']
  }).catch(async err => {
    if (err?.statusCode === 404) {
      // _find might not be available; fallback to list and filter
      const all = await db.list({ include_docs: true });
      return { docs: all.rows.map(r => r.doc).filter(d => d && d.type === 'user') };
    }
    throw err;
  });

  const users = result.docs || [];
  console.log(`Found ${users.length} user docs.`);

  let changed = 0;
  const updates = [];

  for (const doc of users) {
  const currentVersion = Number(doc.schemaVersion || 1);
  // We may apply incremental changes up to version 3

  const profile = { ...(doc.profile || {}) };
  const academic = { ...(doc.academic || {}) };
  const biometrics = { ...(doc.biometrics || {}) };

    // Move flat -> nested if missing in nested
    if (doc.phone && !profile.phone) profile.phone = doc.phone;
    if (doc.profileImageUrl && !profile.imageUrl) profile.imageUrl = doc.profileImageUrl;

    if (doc.rollNo && !academic.rollNo) academic.rollNo = doc.rollNo;
    if (doc.registrationNo && !academic.registrationNo) academic.registrationNo = doc.registrationNo;
    if (doc.section && !academic.section) academic.section = doc.section;
    if (doc.branch && !academic.branch) academic.branch = doc.branch;

    // Normalize face descriptor: move faceDescriptor -> biometrics.faceDescriptor
    if (doc.faceDescriptor && !biometrics.faceDescriptor) {
      const arr = toNumberArrayMaybe(doc.faceDescriptor) || doc.faceDescriptor;
      if (Array.isArray(arr) && arr.length > 0) biometrics.faceDescriptor = arr;
    }

    let targetVersion = Math.max(2, currentVersion);
    // Add instituteId for multi-tenancy if missing
    let instituteId = doc.instituteId;
    if (!instituteId) {
      instituteId = '';
    }

    const migrated = { ...doc, profile, academic, biometrics, instituteId, schemaVersion: Math.max(2, targetVersion) };

    // Optionally remove legacy flat fields to prevent future confusion
    delete migrated.phone;
    delete migrated.profileImageUrl;
    delete migrated.rollNo;
    delete migrated.registrationNo;
    delete migrated.section;
    delete migrated.branch;
    // Keep doc.faceDescriptor only if API still expects it elsewhere; otherwise remove to single source of truth
    if (migrated.biometrics?.faceDescriptor) delete migrated.faceDescriptor;

    // If we added instituteId and previous version < 3, bump to 3
    if (!doc.instituteId) {
      migrated.schemaVersion = 3;
    }

    // Only update if something changed compared to input
    const changedKeys = ['profile','academic','biometrics','schemaVersion'];
    const needsUpdate = changedKeys.some(k => JSON.stringify(migrated[k]) !== JSON.stringify(doc[k]))
  || (migrated.schemaVersion !== currentVersion)
      || ('phone' in doc) || ('profileImageUrl' in doc) || ('rollNo' in doc) || ('registrationNo' in doc) || ('section' in doc) || ('branch' in doc) || ('faceDescriptor' in doc);

    if (needsUpdate) {
      updates.push(migrated);
      changed += 1;
    }
  }

  if (!changed) {
    console.log('No documents need migration.');
    return;
  }

  console.log(`${changed} documents require migration.`);
  if (dryRun) {
    console.log('DRY_RUN=1 set. No changes will be written. Sample update preview:');
    console.log(JSON.stringify(updates.slice(0, 3), null, 2));
    return;
  }

  // Bulk update in batches to be safe
  const batchSize = 100;
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    const resp = await db.bulk({ docs: batch });
    const errors = resp.filter(r => r.error);
    if (errors.length) {
      console.error('Errors during bulk update:', errors.slice(0, 5));
      throw new Error(`Bulk update failed for batch starting at index ${i}`);
    }
    console.log(`Migrated ${Math.min(i + batchSize, updates.length)}/${updates.length} docs...`);
  }

  console.log('Migration complete.');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

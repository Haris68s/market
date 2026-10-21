'use strict';
// Skrip bantu inspeksi database (hanya untuk pengembangan).
require('dotenv').config();
const { MongoClient } = require('mongodb');

(async () => {
  const c = new MongoClient(process.env.MONGODB_URI);
  await c.connect();
  const nama = process.env.MONGODB_DB_NAME || 'kantinsiswa';
  const db = c.db(nama);
  const cols = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((x) => x.name)
    .sort();
  console.log(`DB "${nama}" — ${cols.length} koleksi:`);
  for (const n of cols) {
    const count = await db.collection(n).countDocuments();
    console.log(`  ${n.padEnd(18)} ${count} dokumen`);
  }
  const dbs = await c.db().admin().listDatabases();
  console.log('\nSemua database di cluster:');
  dbs.databases.forEach((d) => console.log(`  ${d.name.padEnd(18)} ${Math.round(d.sizeOnDisk / 1024)}KB`));
  await c.close();
})();

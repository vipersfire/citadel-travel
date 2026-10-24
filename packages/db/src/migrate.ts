import { db, transaction, closeDb, lite } from './index.js';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export async function migrate() {
  await db.query(
    'CREATE TABLE IF NOT EXISTS citadel_migrations (name text primary key, checksum text not null, applied_at timestamptz default now())',
  );
  const files = [];
  for (const folder of ['migrations', 'generated'])
    for (const file of (await readdir(new URL('../' + folder + '/', import.meta.url)))
      .filter((x) => x.endsWith('.sql'))
      .sort())
      files.push({
        name: folder + '/' + file,
        url: new URL('../' + folder + '/' + file, import.meta.url),
      });
  files.sort(
    (a, b) =>
      Number(a.name.split('/')[1].slice(0, 4)) - Number(b.name.split('/')[1].slice(0, 4)) ||
      (a.name.startsWith('migrations/') ? -1 : 1),
  );
  for (const { name, url } of files) {
    const sql = await readFile(url, 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const [old] = await db.query('SELECT * FROM citadel_migrations WHERE name=$1', [name]);
    if (old) {
      if (old.checksum !== checksum) throw new Error(`Applied migration changed: ${name}`);
      continue;
    }
    await transaction(async (tx) => {
      for (const statement of (sql.includes('--> statement-breakpoint')
        ? sql.split('--> statement-breakpoint')
        : sql.split(/;(?=(?:[^']*'[^']*')*[^']*$)/)
      ).filter((x) => x.trim()))
        await tx.query(statement);
      await tx.query('INSERT INTO citadel_migrations(name,checksum) VALUES($1,$2)', [
        name,
        checksum,
      ]);
    });
    console.log(`Applied ${name}`);
  }
  if (lite) await lite.refreshArrayTypes();
}
if (process.argv[1]?.endsWith('migrate.ts')) {
  await migrate();
  await closeDb();
}

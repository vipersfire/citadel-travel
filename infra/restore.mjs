import { spawn } from 'node:child_process';
if (!process.env.RESTORE_DATABASE_URL || !process.env.BACKUP_INPUT)
  throw new Error('Set RESTORE_DATABASE_URL to a scratch database and BACKUP_INPUT.');
if (process.env.RESTORE_DATABASE_URL === process.env.DATABASE_URL)
  throw new Error('Restore target must differ from the application database.');
const url = new URL(process.env.RESTORE_DATABASE_URL),
  env = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: url.pathname.slice(1),
    PGSSLMODE: url.searchParams.get('sslmode') || 'prefer',
  };
await new Promise((resolve, reject) => {
  const child = spawn(
    'pg_restore',
    [
      '--no-owner',
      '--no-acl',
      '--exit-on-error',
      '--dbname',
      env.PGDATABASE,
      process.env.BACKUP_INPUT,
    ],
    { env, stdio: ['ignore', 'ignore', 'pipe'] },
  );
  child.on('error', () => reject(new Error('Install PostgreSQL 17 client tools.')));
  child.on('close', (code) =>
    code === 0
      ? resolve()
      : reject(new Error('Restore failed; target must be an empty scratch database.')),
  );
});
console.log(
  'Scratch restore completed. Verify records and document downloads before any recovery cutover.',
);

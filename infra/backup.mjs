import { spawn } from 'node:child_process';
import { mkdir, open } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const connectionString = process.env.BACKUP_DATABASE_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error('Set BACKUP_DATABASE_URL or DATABASE_URL.');
const url = new URL(connectionString),
  target = resolve(
    process.env.BACKUP_OUTPUT ||
      `.backups/citadel-${new Date().toISOString().replaceAll(':', '-')}.dump`,
  );
await mkdir(dirname(target), { recursive: true, mode: 0o700 });
const file = await open(target, 'wx', 0o600);
const env = {
  ...process.env,
  PGHOST: url.hostname,
  PGPORT: url.port || '5432',
  PGUSER: decodeURIComponent(url.username),
  PGPASSWORD: decodeURIComponent(url.password),
  PGDATABASE: url.pathname.slice(1),
  PGSSLMODE: url.searchParams.get('sslmode') || 'prefer',
};
try {
  await new Promise((resolve, reject) => {
    const child = spawn('pg_dump', ['--format=custom', '--no-owner', '--no-acl'], {
      env,
      stdio: ['ignore', file.fd, 'pipe'],
    });
    child.on('error', () => reject(new Error('Install PostgreSQL 17 client tools.')));
    child.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error('Backup failed; check database connectivity and permissions.')),
    );
  });
  console.log('Backup written to ' + target);
} finally {
  await file.close();
}

import { it, expect } from 'vitest';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
it('upgrades a populated baseline without deleting historic trips, invoices or payment evidence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'citadel-v2-upgrade-'));
  Object.assign(process.env, { APP_ENV: 'development', DATABASE_URL: '', PGLITE_DIR: directory });
  const { db, closeDb, transaction } = await import('../packages/db/src/index');
  try {
    await db.query(
      'CREATE TABLE citadel_migrations(name text primary key,checksum text not null,applied_at timestamptz default now())',
    );
    for (const name of [
      'migrations/0000_extensions.sql',
      'generated/0000_deep_the_enforcers.sql',
      'generated/0001_yellow_the_watchers.sql',
      'generated/0002_cute_kulan_gath.sql',
      'generated/0003_safe_wither.sql',
    ]) {
      const source = await readFile(new URL('../packages/db/' + name, import.meta.url), 'utf8');
      await transaction(async (tx) => {
        for (const statement of (source.includes('--> statement-breakpoint')
          ? source.split('--> statement-breakpoint')
          : source.split(/;(?=(?:[^']*'[^']*')*[^']*$)/)
        ).filter((s) => s.trim()))
          await tx.query(statement);
        await tx.query('INSERT INTO citadel_migrations(name,checksum) VALUES($1,$2)', [
          name,
          createHash('sha256').update(source).digest('hex'),
        ]);
      });
    }
    const [u] = await db.query(
      `INSERT INTO users(email,full_name) VALUES('legacy@fixture.invalid','Legacy fixture') RETURNING id`,
    );
    const [sport] = await db.query(
      `INSERT INTO packages(code,slug,kind,sport,status,title) VALUES('OT','old-trafford','sport','football','published','{"id":"Legacy sport"}') RETURNING id`,
    );
    const [retired] = await db.query(
      `INSERT INTO packages(code,slug,kind,status,title) VALUES('LC','lake-como','luxury','published','{"id":"Retired concept"}') RETURNING id`,
    );
    const [batch] = await db.query(
      "INSERT INTO batches(package_id,code,start_date,end_date,capacity) VALUES($1,'LEGACY','2027-03-11','2027-03-15',20) RETURNING id",
      [retired.id],
    );
    const [booking] = await db.query(
      "INSERT INTO bookings(code,user_id,package_id,batch_id,status) VALUES('CTD-26-99999',$1,$2,$3,'confirmed') RETURNING id",
      [u.id, retired.id, batch.id],
    );
    const [invoice] = await db.query(
      "INSERT INTO invoices(booking_id,user_id,kind,status,subtotal,total,due_at) VALUES($1,$2,'package','paid',1000,1000,now()) RETURNING id",
      [booking.id, u.id],
    );
    const [attempt] = await db.query(
      "INSERT INTO payment_attempts(invoice_id,attempt_no,reference_id,status,amount,expires_at) VALUES($1,1,'legacy-attempt','completed',1000,now()) RETURNING id",
      [invoice.id],
    );
    await db.query(
      "INSERT INTO payments(invoice_id,attempt_id,method,amount,paid_at) VALUES($1,$2,'xendit',1000,now())",
      [invoice.id, attempt.id],
    );
    await db.query(
      "INSERT INTO home_sections(kind,data,status) VALUES('collection','{}','published'),('how_it_works','{}','published')",
    );
    const { migrate } = await import('../packages/db/src/migrate');
    await migrate();
    await migrate();
    expect(
      (await db.query('SELECT status,sport FROM packages WHERE id=$1', [retired.id]))[0],
    ).toEqual({ status: 'archived', sport: 'other' });
    expect(
      (await db.query('SELECT status,readiness FROM packages WHERE id=$1', [sport.id]))[0],
    ).toEqual({ status: 'draft', readiness: 'draft' });
    expect(
      (await db.query('SELECT status FROM bookings WHERE id=$1', [booking.id]))[0].status,
    ).toBe('confirmed');
    expect(
      (await db.query('SELECT status,total FROM invoices WHERE id=$1', [invoice.id]))[0].status,
    ).toBe('paid');
    expect(
      (await db.query('SELECT amount FROM payments WHERE invoice_id=$1', [invoice.id]))[0].amount,
    ).toBe(1000);
    expect(
      (await db.query('SELECT approval_id FROM payment_attempts WHERE id=$1', [attempt.id]))[0]
        .approval_id,
    ).toBeNull();
    expect(await db.query('SELECT * FROM offer_approvals')).toHaveLength(0);
    expect(
      (await db.query('SELECT kind FROM home_sections ORDER BY kind')).map((r) => r.kind),
    ).toEqual(['beyond', 'how_to_book']);
    expect(
      await db.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name='packages' AND column_name='kind'",
      ),
    ).toHaveLength(0);
  } finally {
    await closeDb();
    await rm(directory, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}, 60000);

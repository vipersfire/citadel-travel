import { transaction, closeDb } from '../packages/db/src/index.js';
const email = process.argv[2];
if (!email)
  throw new Error(
    'Usage: pnpm admin:reset-totp admin@example.com (stop the API first when using PGlite).',
  );
await transaction(async (tx) => {
  const [admin] = await tx.query(
    "SELECT id FROM users WHERE email=$1 AND role='admin' FOR UPDATE",
    [email],
  );
  if (!admin) throw new Error('Administrator not found');
  await tx.query('UPDATE users SET totp_secret_enc=null,totp_enabled_at=null WHERE id=$1', [
    admin.id,
  ]);
  await tx.query('DELETE FROM admin_recovery_codes WHERE user_id=$1', [admin.id]);
  await tx.query('DELETE FROM sessions WHERE user_id=$1', [admin.id]);
  await tx.query(
    "INSERT INTO audit_logs(action,entity_type,entity_id,after) VALUES('admin.totp_reset','user',$1,'{\"enrollment_required\":true}')",
    [admin.id],
  );
});
console.log('TOTP reset. All admin sessions revoked; enrollment required at next sign-in.');
await closeDb();

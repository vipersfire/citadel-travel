import { config } from '../apps/api/src/config.js';
import { transaction, closeDb } from '../packages/db/src/index.js';
import { encrypt, decrypt, audit } from '../apps/api/src/core.js';
if (!process.env.ENCRYPTION_KEY || !process.env.ENCRYPTION_PREVIOUS_KEYS)
  throw new Error(
    'Configure a new ENCRYPTION_KEY, version and previous key ring. Stop API/worker before rotation.',
  );
const dry = process.argv.includes('--dry-run');
try {
  const counts = await transaction(async (tx) => {
    let travelers = 0,
      admins = 0;
    for (const row of await tx.query(
      'SELECT id,passport_number_enc,passport_key_version FROM travelers WHERE passport_number_enc IS NOT NULL FOR UPDATE',
    )) {
      const plaintext = decrypt(row.passport_number_enc);
      if (!dry)
        await tx.query(
          'UPDATE travelers SET passport_number_enc=$1,passport_key_version=$2,updated_at=now() WHERE id=$3',
          [encrypt(plaintext), config.encryptionVersion, row.id],
        );
      travelers++;
    }
    for (const user of await tx.query(
      'SELECT id,totp_secret_enc FROM users WHERE totp_secret_enc IS NOT NULL FOR UPDATE',
    )) {
      const secret = decrypt(user.totp_secret_enc);
      if (!dry)
        await tx.query('UPDATE users SET totp_secret_enc=$1,updated_at=now() WHERE id=$2', [
          encrypt(secret),
          user.id,
        ]);
      admins++;
    }
    if (!dry)
      await audit(tx, null, 'encryption.rotate', 'key', String(config.encryptionVersion), null, {
        travelers,
        admins,
        version: config.encryptionVersion,
      });
    return { travelers, admins, dry_run: dry, version: config.encryptionVersion };
  });
  console.log(JSON.stringify(counts));
} finally {
  await closeDb();
}

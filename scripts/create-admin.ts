import { seed } from '../packages/db/src/seed.js';
import { closeDb } from '../packages/db/src/index.js';
if (
  !process.env.SEED_ADMIN_EMAIL ||
  !process.env.SEED_ADMIN_PASSWORD ||
  process.env.SEED_ADMIN_PASSWORD.length < 10
)
  throw new Error('Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD (10+ characters) in .env.');
await seed();
await closeDb();

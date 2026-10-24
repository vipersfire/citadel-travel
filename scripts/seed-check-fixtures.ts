// Isolated browser/performance checks only. Never called by normal dev or deploy.
if (
  process.env.CITADEL_CHECK_FIXTURES !== 'true' ||
  process.env.APP_ENV !== 'development' ||
  !process.env.PGLITE_DIR ||
  process.env.DATABASE_URL
)
  throw new Error('Check fixtures require an explicit isolated PGlite development database.');
const { seed } = await import('../packages/db/src/seed.js');
const { db, closeDb } = await import('../packages/db/src/index.js');
const { preparePilotFixture } = await import('../tests/fixtures.js');
await seed();
await preparePilotFixture(db);
await closeDb();

export {};

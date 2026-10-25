import { db } from '@citadel/db';
import { readObject, storeObject } from './storage.js';
export async function generateVariants(id: string) {
  const [m] = await db.query("SELECT * FROM media_assets WHERE id=$1 AND kind='image'", [id]);
  if (
    !m ||
    m.variants?.length ||
    m.bucket === 'bundled' ||
    m.bucket === 'external' ||
    /^https:\/\//i.test(m.storage_key)
  )
    return;
  const sharp = (await import('sharp')).default;
  const bytes = await readObject(m.bucket, m.storage_key);
  const meta = await sharp(bytes, { limitInputPixels: 60000000 }).metadata();
  const variants = [];
  for (const width of [480, 960, 1600, 2560])
    for (const format of ['webp', 'avif'] as const) {
      const key = `media/${m.id}/${width}.${format}`;
      await storeObject(
        m.bucket,
        key,
        await sharp(bytes).resize({ width, withoutEnlargement: true }).toFormat(format).toBuffer(),
        `image/${format}`,
      );
      variants.push({ width, format, key });
    }
  const blur =
    'data:image/webp;base64,' +
    (await sharp(bytes).resize(20).webp().toBuffer()).toString('base64');
  await db.query(
    'UPDATE media_assets SET variants=$1,blur_data_url=$2,width=$3,height=$4 WHERE id=$5',
    [JSON.stringify(variants), blur, meta.width, meta.height, id],
  );
}
export async function recoverMedia() {
  for (const m of await db.query(
    "SELECT id FROM media_assets WHERE kind='image' AND bucket NOT IN ('bundled','external') AND storage_key NOT LIKE 'https://%' AND variants='[]'::jsonb LIMIT 5",
  ))
    await generateVariants(m.id);
}

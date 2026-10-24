import { config } from './config.js';
import { reportError } from './instrumentation.js';
export async function purgePublicCache(paths?: string[]) {
  if (!process.env.CLOUDFLARE_ZONE_ID || !process.env.CLOUDFLARE_API_TOKEN) return;
  try {
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${process.env.CLOUDFLARE_ZONE_ID}/purge_cache`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          paths ? { files: paths.map((p) => config.APP_ORIGIN + p) } : { purge_everything: true },
        ),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!r.ok) throw new Error('Public cache purge failed');
  } catch (e) {
    reportError(e);
  }
}

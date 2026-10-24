import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const sharp = createRequire(new URL('../apps/api/package.json', import.meta.url))('sharp');
const root = resolve(import.meta.dirname, '../apps/web/public/placeholders');
async function run(args: string[]) {
  await new Promise<void>((done, reject) => {
    const p = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
      stdio: 'inherit',
    });
    p.once('error', reject);
    p.once('exit', (c) =>
      c === 0 ? done() : reject(new Error('Placeholder video conversion failed')),
    );
  });
}
for (const name of ['hero', 'monza', 'como']) {
  await sharp(resolve(root, name + '.webp'))
    .resize(720, 1280, { fit: 'cover', position: 'centre' })
    .avif({ quality: 45 })
    .toFile(resolve(root, name + '-mobile.avif'));
  await sharp(resolve(root, name + '.webp'))
    .resize(1080, 1920, { fit: 'cover', position: 'centre' })
    .webp({ quality: 68 })
    .toFile(resolve(root, name + '-mobile.webp'));
  for (const mobile of [false, true]) {
    const stem = name + (mobile ? '-mobile' : ''),
      duration = name === 'monza' || (name === 'hero' && mobile) ? 8 : 10,
      frames = duration * 25,
      size = mobile ? '1080x1920' : '1920x1080';
    const filter = `scale=2400:-1,zoompan=z='1+0.012*(1-cos(2*PI*on/${frames}))':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=${frames}:s=${size}:fps=25,format=yuv420p`;
    await run([
      '-i',
      resolve(root, name + '.webp'),
      '-filter_threads',
      '1',
      '-vf',
      filter,
      '-t',
      String(duration),
      '-an',
      '-c:v',
      'libx264',
      '-threads',
      '2',
      '-preset',
      'fast',
      '-crf',
      '30',
      '-movflags',
      '+faststart',
      resolve(root, stem + '.mp4'),
    ]);
    await run([
      '-i',
      resolve(root, stem + '.mp4'),
      '-an',
      '-c:v',
      'libvpx-vp9',
      '-threads',
      '2',
      '-b:v',
      '0',
      '-crf',
      '38',
      '-deadline',
      'realtime',
      '-cpu-used',
      '6',
      resolve(root, stem + '.webm'),
    ]);
    const poster = resolve(root, stem + '-frame.png');
    await run(['-i', resolve(root, stem + '.mp4'), '-frames:v', '1', poster]);
    const posterStem = name + (mobile ? '-mobile' : '-desktop');
    await sharp(poster)
      .webp({ quality: 68 })
      .toFile(resolve(root, posterStem + '.webp'));
    await sharp(poster)
      .resize(mobile ? 720 : 1600)
      .avif({ quality: 45 })
      .toFile(resolve(root, posterStem + '.avif'));
    await (await import('node:fs/promises')).unlink(poster);
  }
}
console.log(
  'Created silent 8–10 second seamless loops and first-frame posters in desktop/mobile formats.',
);

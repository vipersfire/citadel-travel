import { mkdir, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const requireApi = createRequire(new URL('../apps/api/package.json', import.meta.url));
const sharp = requireApi('sharp');
const output = resolve(import.meta.dirname, '../apps/web/public/placeholders');
await mkdir(output, { recursive: true });
const palettes = { ink: '#12291F', light: '#D7E0D5', brass: '#A6814A', sky: '#64796D' };
function scene(name: string) {
  let subject = '';
  if (['hero', 'manchester', 'madrid', 'london'].includes(name)) {
    subject = `<path d="M0 230L800 80l800 150v320L800 390 0 550Z" fill="#203A2B"/><path d="M0 230L800 80l800 150M0 320L800 170l800 150M0 400L800 260l800 140" fill="none" stroke="#899A87" stroke-width="12"/><path d="M190 630L800 380l610 250-610 240Z" fill="#45654D"/><path d="M285 632L800 424l515 208-515 192Z" fill="none" stroke="#D7E0D5" stroke-width="3"/><path d="M800 424v400" stroke="#D7E0D5" stroke-width="3"/><ellipse cx="800" cy="625" rx="85" ry="36" fill="none" stroke="#D7E0D5" stroke-width="3"/><g stroke="#D7E0D5" stroke-width="7"><path d="M160 120v-80m1150 100v-100"/><path d="M90 40h140m1010 0h140"/></g>`;
  } else if (name === 'monza') {
    subject = `<path d="M0 700L330 360l500-130 440 150 330 320v300H0Z" fill="#365341"/><path d="M260 680C120 520 510 370 730 380S1380 510 1230 760 520 840 340 700Z" fill="none" stroke="#66766A" stroke-width="80"/><path d="M260 680C120 520 510 370 730 380S1380 510 1230 760 520 840 340 700Z" fill="none" stroke="#E3E4D8" stroke-width="3" stroke-dasharray="16 20"/><path d="M350 725l350 75 450-25" stroke="#A6814A" stroke-width="10" fill="none"/><g fill="#233F2D">${[140, 380, 820, 1300, 1450].map((x) => `<path d="M${x} 440l-60 120h120Z"/>`).join('')}</g>`;
  } else if (name === 'paris-life' || name === 'london-life') {
    subject = `<path d="M200 150h1200v650H200Z" fill="#8A957F"/><g fill="#263D2E">${[300, 550, 800, 1050].map((x) => `<path d="M${x} 650V330q80-160 160 0v320Z"/>`).join('')}</g><path d="M0 850h1600M160 700h1280" stroke="#A6814A" stroke-width="12"/><path d="M0 800l800-700 800 700M500 650L800 140l300 510" fill="none" stroke="#CDD4C2" stroke-width="5"/><path d="M400 890h800l-60-120H460Z" fill="#A69B7B"/><ellipse cx="610" cy="800" rx="45" ry="20" fill="#E2E2D4"/>`;
  } else if (name === 'family') {
    subject = `<path d="M0 250h1600v300H0Z" fill="#2D4735"/><path d="M0 530h1600M0 650h1600" stroke="#A6814A" stroke-width="8"/><g fill="#728573">${[350, 650, 920, 1200].map((x, i) => `<circle cx="${x}" cy="${i === 2 ? 570 : 500}" r="${i === 2 ? 55 : 75}"/><path d="M${x - 100} 900V${i === 2 ? 680 : 640}q100-150 200 0v260Z"/>`).join('')}</g><path d="M575 590q70-190 150 0l40 85H540Z" fill="#C1C9B8"/>`;
  } else if (name === 'paris') {
    subject = `<path d="M180 180H1420V840H180Z" fill="#936C50"/><path d="M350 220H1250V800H350Zm0 290h900m-450-290v580" fill="none" stroke="#EEEAE0" stroke-width="5"/><path d="M180 515h1240" stroke="#12291F" stroke-width="14"/><circle cx="1110" cy="670" r="18" fill="#D1CA91"/>`;
  } else if (name === 'grass') {
    subject = `<rect x="160" y="170" width="1280" height="670" fill="#466A4E"/><path d="M350 220H1250V790H350Zm0 280h900m-450-280v570" fill="none" stroke="#E3E8D8" stroke-width="5"/><path d="M160 502h1280" stroke="#12291F" stroke-width="10"/>`;
  } else if (name === 'berlin') {
    subject = `<path d="M200 540h1200v70H200zM280 520V320h1040v200" fill="#9AA08D"/><g fill="#677E6B">${[330, 520, 710, 900, 1090, 1280].map((x) => `<rect x="${x}" y="350" width="52" height="210"/>`).join('')}</g><path d="M280 320l520-80 520 80" fill="#ACAD93"/><path d="M0 1000l600-390h400l600 390" fill="#374E3D"/><path d="M800 650v350" stroke="#A6814A" stroke-width="5" stroke-dasharray="18 24"/>`;
  } else if (name === 'alps') {
    subject = `<path d="M0 650L400 130l350 420L1050 90l550 580" fill="#839589"/><path d="M210 380l190-250 160 250-155-80Z M840 350l210-260 200 300-195-85Z" fill="#D9E0D3"/><path d="M380 800V580l240-180 240 180v220Z" fill="#304A35"/><path d="M390 575l230-195 250 195" fill="none" stroke="#D5DDCE" stroke-width="20"/><g fill="#B99A62"><rect x="430" y="630" width="130" height="100"/><rect x="680" y="630" width="130" height="100"/></g>`;
  } else {
    subject = `<path d="M0 630L280 150l310 280L900 120l400 340 300-160v700H0Z" fill="#7E9383"/><path d="M0 650q800-170 1600 0v350H0Z" fill="#36584C"/><path d="M0 750q800-130 1600 0M0 840q800-110 1600 0" stroke="#9EA990" stroke-width="2" fill="none"/><path d="M1120 540V365l125-80 125 80v190Z" fill="#A69B7B"/><path d="M1100 365l145-95 145 95" fill="#566C55"/><g fill="#B79F6B"><path d="M720 810h300l-40 35H760Z"/><path d="M845 810V730h10v80"/></g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${palettes.ink}"/><stop offset="1" stop-color="${palettes.sky}"/></linearGradient><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".035"/></feComponentTransfer><feBlend in="SourceGraphic" mode="soft-light"/></filter></defs><rect width="1600" height="1000" fill="url(#sky)"/><g filter="url(#grain)">${subject}</g><rect width="1600" height="1000" fill="#12291F" opacity=".12"/></svg>`;
}
const metadata: Record<string, any> = {};
for (const name of [
  'hero',
  'manchester',
  'madrid',
  'paris',
  'grass',
  'london',
  'berlin',
  'monza',
  'como',
  'alps',
  'paris-life',
  'london-life',
  'family',
]) {
  const svg = scene(name),
    portrait = ['paris', 'grass', 'alps', 'paris-life', 'london-life'].includes(name),
    height = portrait ? 2000 : name === 'family' ? 1067 : 900;
  await writeFile(resolve(output, name + '.svg'), svg);
  const raster = await sharp(Buffer.from(svg))
    .resize(1600, height, { fit: 'cover' })
    .png()
    .toBuffer();
  for (const width of [480, 960, 1600, 2560])
    for (const format of ['webp', 'avif'])
      await sharp(raster)
        .resize(width, Math.round((width * height) / 1600), { fit: 'cover' })
        .toFormat(format, { quality: 72, effort: 2 })
        .toFile(resolve(output, `${name}-${width}.${format}`));
  await sharp(raster)
    .webp({ quality: 78 })
    .toFile(resolve(output, name + '.webp'));
  console.log('Placeholder: ' + name);
  metadata[name] = {
    bytes: (await stat(resolve(output, name + '.webp'))).size,
    width: 1600,
    height,
    blur:
      'data:image/webp;base64,' +
      (await sharp(raster).resize(20).webp().toBuffer()).toString('base64'),
  };
}
console.log('Created original illustrated media placeholders and responsive variants.');

await writeFile(resolve(output, 'metadata.json'), JSON.stringify(metadata, null, 2));

await writeFile(
  resolve(output, 'paper.svg'),
  '<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048"><filter id="p"><feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" fill="#FBFBF8"/><rect width="100%" height="100%" filter="url(#p)" opacity=".025"/></svg>',
);

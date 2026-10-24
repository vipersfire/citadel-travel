import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { config, projectRoot } from './config.js';
export const s3Client = config.r2Enabled
  ? new S3Client({
      region: 'auto',
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    })
  : null;
export const mediaRoot = process.env.LOCAL_MEDIA_DIR || resolve(projectRoot, '.data/media');
export const documentsRoot = process.env.LOCAL_FILES_DIR || resolve(projectRoot, '.data/files');
export function publicMediaUrl(key: string, bucket = 'local') {
  if (/^https:\/\//i.test(key)) return key;
  if (bucket === 'bundled') return `/${key}`;
  if (bucket === 'local') return `/api/public/media/${key}`;
  return `/api/public/media/r2/${key}`;
}
export async function storeObject(bucket: string, key: string, bytes: Buffer, mime: string) {
  if (bucket !== 'local' && s3Client)
    await s3Client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: mime }),
    );
  else {
    const path = resolve(key.startsWith('media/') ? mediaRoot : documentsRoot, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes, { mode: 0o600 });
  }
}
export async function readObject(bucket: string, key: string) {
  if (bucket !== 'local' && s3Client) {
    const object = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return Buffer.from(await object.Body!.transformToByteArray());
  }
  return readFile(resolve(key.startsWith('media/') ? mediaRoot : documentsRoot, key));
}
export async function deleteObject(bucket: string, key: string) {
  if (bucket !== 'local' && s3Client)
    await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  else
    try {
      await unlink(resolve(key.startsWith('media/') ? mediaRoot : documentsRoot, key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
}
export function detectedMime(b: Buffer) {
  if (b.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return 'image/jpeg';
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP')
    return 'image/webp';
  if (b.subarray(4, 8).toString() === 'ftyp') return 'video/mp4';
  if (b.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))) return 'video/webm';
  return null;
}

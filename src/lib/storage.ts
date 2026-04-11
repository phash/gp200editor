import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import type { Readable } from 'stream';

let _client: S3Client | null = null;
function getClient() {
  if (!_client) {
    _client = new S3Client({
      endpoint: process.env.GARAGE_ENDPOINT!,
      region: 'garage',
      credentials: {
        accessKeyId: process.env.GARAGE_ACCESS_KEY_ID!,
        secretAccessKey: process.env.GARAGE_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true, // required for Garage and other S3-compatible stores
    });
  }
  return _client;
}

function bucket() {
  return process.env.GARAGE_BUCKET!;
}

export async function uploadAvatar(key: string, body: Buffer): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: 'image/webp',
    }),
  );
}

export async function deleteAvatar(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: bucket(), Key: key }),
  );
}

export async function getAvatarStream(key: string): Promise<Readable> {
  const response = await getClient().send(
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
  );
  return response.Body as Readable;
}

function presetBucket() {
  return process.env.GARAGE_PRESET_BUCKET!;
}

export async function uploadPreset(key: string, buffer: Buffer): Promise<void> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: presetBucket(),
      Key: key,
      Body: buffer,
      ContentType: 'application/octet-stream',
    }),
  );
}

export async function deletePreset(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: presetBucket(), Key: key }),
  );
}

export async function getPresetStream(key: string): Promise<Readable> {
  const response = await getClient().send(
    new GetObjectCommand({ Bucket: presetBucket(), Key: key }),
  );
  return response.Body as Readable;
}

/**
 * Convenience wrapper over getPresetStream that reads the entire object
 * into a Buffer. Only safe for small files (preset files are 1224 bytes);
 * do not use for avatars or anything user-sized.
 *
 * Wraps the stream iteration in a try/catch so a mid-stream S3 error is
 * surfaced to the caller as a proper Error with context (key + cause) and
 * can be logged. Without the wrap, a Garage hiccup would reject the
 * for-await with an opaque stream error and callers saw a generic 500.
 */
export async function downloadPresetBuffer(key: string): Promise<Buffer> {
  const stream = await getPresetStream(key);
  const chunks: Buffer[] = [];
  try {
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
  } catch (err) {
    throw new Error(
      `Failed to read preset stream for key "${key}": ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    );
  }
  return Buffer.concat(chunks);
}

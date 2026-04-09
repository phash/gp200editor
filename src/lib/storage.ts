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

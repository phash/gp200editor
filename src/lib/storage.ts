import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import type { Readable } from 'stream';

function getClient() {
  return new S3Client({
    endpoint: process.env.GARAGE_ENDPOINT!,
    region: 'garage',
    credentials: {
      accessKeyId: process.env.GARAGE_ACCESS_KEY_ID!,
      secretAccessKey: process.env.GARAGE_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true, // required for Garage and other S3-compatible stores
  });
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

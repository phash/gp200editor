/**
 * Storage unit tests.
 *
 * Strategy: mock `@aws-sdk/client-s3` before importing the storage module,
 * so every call to `getClient().send(...)` is routed through a Vitest mock
 * we can inspect.
 *
 * We deliberately do NOT instantiate a real S3Client — the tests must run
 * under CI with no network and no credentials. The mock captures the
 * command payload so we can assert the right Bucket/Key/Body/ContentType.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Readable } from 'node:stream';

// ---------------------------------------------------------------------------
// Mock the AWS SDK client. The storage module does:
//   new S3Client({...})
//   getClient().send(new PutObjectCommand({...}))
//   getClient().send(new GetObjectCommand({...}))
//   getClient().send(new DeleteObjectCommand({...}))
//
// Vitest hoists vi.mock() to the top of the file, so class defs have to
// live INSIDE the factory function or be wrapped in vi.hoisted(). We use
// the factory approach: everything the mock needs is constructed lazily
// inside the callback. sendMock is returned from the factory and re-
// imported via `vi.mocked(...)` in beforeEach.
// ---------------------------------------------------------------------------

const { sendMock, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } =
  vi.hoisted(() => {
    const mock = vi.fn();
    class FakeCommand {
      constructor(public readonly input: Record<string, unknown>) {}
    }
    class PutCmd extends FakeCommand {}
    class GetCmd extends FakeCommand {}
    class DelCmd extends FakeCommand {}
    return {
      sendMock: mock,
      PutObjectCommand: PutCmd,
      GetObjectCommand: GetCmd,
      DeleteObjectCommand: DelCmd,
    };
  });

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    constructor(public readonly config: unknown) {}
    send = sendMock;
  },
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
}));

// Storage functions read env at call time, so set env BEFORE the imports
// below. Test values are obvious placeholders — no real credentials.
process.env.GARAGE_ENDPOINT = 'http://fake-garage:3900';
process.env.GARAGE_ACCESS_KEY_ID = 'test-access-key';
process.env.GARAGE_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.GARAGE_BUCKET = 'test-avatars';
process.env.GARAGE_PRESET_BUCKET = 'test-presets';

// Imported AFTER the mock + env setup so the storage module picks them up.
// eslint-disable-next-line import/first
import * as storage from '@/lib/storage';

beforeEach(() => {
  sendMock.mockReset();
});

describe('uploadAvatar', () => {
  it('sends a PutObjectCommand to the avatars bucket with webp content type', async () => {
    sendMock.mockResolvedValueOnce({});
    const body = Buffer.from('png-bytes');

    await storage.uploadAvatar('u/123.webp', body);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const cmd = sendMock.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(PutObjectCommand);
    expect(cmd.input).toEqual({
      Bucket: 'test-avatars',
      Key: 'u/123.webp',
      Body: body,
      ContentType: 'image/webp',
    });
  });

  it('propagates S3 errors to the caller', async () => {
    sendMock.mockRejectedValueOnce(new Error('AccessDenied'));
    await expect(
      storage.uploadAvatar('u/denied.webp', Buffer.from('x')),
    ).rejects.toThrow('AccessDenied');
  });
});

describe('deleteAvatar', () => {
  it('sends a DeleteObjectCommand to the avatars bucket', async () => {
    sendMock.mockResolvedValueOnce({});
    await storage.deleteAvatar('u/old.webp');

    const cmd = sendMock.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(DeleteObjectCommand);
    expect(cmd.input).toEqual({ Bucket: 'test-avatars', Key: 'u/old.webp' });
  });
});

describe('getAvatarStream', () => {
  it('returns the response Body as a Readable', async () => {
    const fakeBody = Readable.from([Buffer.from('hello')]);
    sendMock.mockResolvedValueOnce({ Body: fakeBody });

    const stream = await storage.getAvatarStream('u/pic.webp');
    expect(stream).toBe(fakeBody);

    const cmd = sendMock.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(GetObjectCommand);
    expect(cmd.input).toEqual({ Bucket: 'test-avatars', Key: 'u/pic.webp' });
  });
});

describe('uploadPreset', () => {
  it('sends a PutObjectCommand to the presets bucket with octet-stream content type', async () => {
    sendMock.mockResolvedValueOnce({});
    const buffer = Buffer.alloc(1224, 0x42);

    await storage.uploadPreset('preset-abc.prst', buffer);

    const cmd = sendMock.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(PutObjectCommand);
    expect(cmd.input).toEqual({
      Bucket: 'test-presets',
      Key: 'preset-abc.prst',
      Body: buffer,
      ContentType: 'application/octet-stream',
    });
  });

  it('uses the preset bucket, not the avatar bucket', async () => {
    sendMock.mockResolvedValueOnce({});
    await storage.uploadPreset('k', Buffer.from('.'));
    const cmd = sendMock.mock.calls[0][0];
    expect(cmd.input.Bucket).toBe('test-presets');
    expect(cmd.input.Bucket).not.toBe('test-avatars');
  });
});

describe('deletePreset', () => {
  it('sends a DeleteObjectCommand to the presets bucket', async () => {
    sendMock.mockResolvedValueOnce({});
    await storage.deletePreset('preset-xyz.prst');

    const cmd = sendMock.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(DeleteObjectCommand);
    expect(cmd.input).toEqual({ Bucket: 'test-presets', Key: 'preset-xyz.prst' });
  });
});

describe('getPresetStream', () => {
  it('returns the response Body as a Readable from the presets bucket', async () => {
    const fakeBody = Readable.from([Buffer.alloc(1224)]);
    sendMock.mockResolvedValueOnce({ Body: fakeBody });

    const stream = await storage.getPresetStream('preset-key.prst');
    expect(stream).toBe(fakeBody);

    const cmd = sendMock.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(GetObjectCommand);
    expect(cmd.input).toEqual({ Bucket: 'test-presets', Key: 'preset-key.prst' });
  });
});

describe('downloadPresetBuffer', () => {
  it('assembles a single-chunk stream into a Buffer', async () => {
    const payload = Buffer.from('small-preset-payload');
    const fakeBody = Readable.from([payload]);
    sendMock.mockResolvedValueOnce({ Body: fakeBody });

    const result = await storage.downloadPresetBuffer('preset-key.prst');
    expect(result.toString()).toBe('small-preset-payload');
  });

  it('concatenates a multi-chunk stream in order', async () => {
    const fakeBody = Readable.from([
      Buffer.from('chunk-1;'),
      Buffer.from('chunk-2;'),
      Buffer.from('chunk-3'),
    ]);
    sendMock.mockResolvedValueOnce({ Body: fakeBody });

    const result = await storage.downloadPresetBuffer('preset-multi.prst');
    expect(result.toString()).toBe('chunk-1;chunk-2;chunk-3');
  });

  it('converts non-Buffer chunks (Uint8Array) via Buffer.from', async () => {
    // SDK streams can sometimes yield raw Uint8Arrays; downloadPresetBuffer
    // normalizes them with Buffer.from. Lock that in.
    const fakeBody = Readable.from([new Uint8Array([65, 66, 67])]);
    sendMock.mockResolvedValueOnce({ Body: fakeBody });

    const result = await storage.downloadPresetBuffer('preset-uint8.prst');
    expect(result.toString()).toBe('ABC');
  });

  it('wraps mid-stream errors with key context and preserves cause', async () => {
    // A Readable that errors after yielding one chunk. The for-await loop
    // in downloadPresetBuffer should catch this and re-throw with context.
    async function* brokenGenerator() {
      yield Buffer.from('first-chunk');
      throw new Error('network-reset');
    }
    const fakeBody = Readable.from(brokenGenerator());
    sendMock.mockResolvedValueOnce({ Body: fakeBody });

    await expect(
      storage.downloadPresetBuffer('doomed-key'),
    ).rejects.toThrow(/Failed to read preset stream for key "doomed-key": network-reset/);
  });

  it('surfaces getPresetStream failures without the try/catch swallowing them', async () => {
    // The error happens BEFORE the for-await loop starts, in the initial
    // GetObjectCommand call. Nothing should re-wrap it.
    sendMock.mockRejectedValueOnce(new Error('NoSuchKey'));
    await expect(
      storage.downloadPresetBuffer('missing-key'),
    ).rejects.toThrow('NoSuchKey');
  });

  it('returns an empty Buffer for an empty stream', async () => {
    const fakeBody = Readable.from([]);
    sendMock.mockResolvedValueOnce({ Body: fakeBody });

    const result = await storage.downloadPresetBuffer('empty.prst');
    expect(result.length).toBe(0);
  });
});

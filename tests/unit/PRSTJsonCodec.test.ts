import { describe, it, expect } from 'vitest';
import { PresetJsonSchema, PRESET_JSON_SCHEMA_VERSION } from '@/core/PRSTJsonCodec';

describe('PresetJsonSchema', () => {
  it('exposes schema version 1', () => {
    expect(PRESET_JSON_SCHEMA_VERSION).toBe(1);
  });

  it('accepts a minimal valid document', () => {
    const doc = {
      schemaVersion: 1,
      name: 'Test',
      author: null,
      description: null,
      sourceUrl: null,
      sourceLabel: null,
      summary: 'Valeton GP-200 preset Test.',
      signalChain: [],
      highlights: { amp: null, cab: null, drive: null },
      raw: {
        patchName: 'Test',
        author: null,
        effects: [],
        fileSize: 1224,
        checksum: '0x0000',
      },
      urls: {
        download: '/api/share/abc/download',
        openInEditor: '/en/editor?share=abc',
        html: '/en/share/abc',
      },
    };
    const result = PresetJsonSchema.safeParse(doc);
    expect(result.success).toBe(true);
  });

  it('rejects schemaVersion 2', () => {
    const doc = { schemaVersion: 2 };
    const result = PresetJsonSchema.safeParse(doc);
    expect(result.success).toBe(false);
  });
});

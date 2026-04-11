import { describe, it, expect } from 'vitest';
import type { GP200Preset } from '@/core/types';
import {
  PresetJsonSchema,
  PRESET_JSON_SCHEMA_VERSION,
  buildSignalChain,
  pickHighlights,
  generateSummary,
} from '@/core/PRSTJsonCodec';

function makeEmptyPreset(): GP200Preset {
  return {
    version: '1',
    patchName: 'Test',
    author: undefined,
    effects: Array.from({ length: 11 }, (_, slotIndex) => ({
      slotIndex,
      enabled: false,
      effectId: 0,
      params: Array(15).fill(0),
    })),
    checksum: 0,
  };
}

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

describe('buildSignalChain', () => {
  it('returns all 11 slots in ascending order', () => {
    const chain = buildSignalChain(makeEmptyPreset());
    expect(chain).toHaveLength(11);
    expect(chain.map((e) => e.slot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('maps effectId 0 to COMP with module PRE', () => {
    const chain = buildSignalChain(makeEmptyPreset());
    expect(chain[0].valetonName).toBe('COMP');
    expect(chain[0].module).toBe('PRE');
  });

  it('resolves real name via EFFECT_DESCRIPTIONS', () => {
    const chain = buildSignalChain(makeEmptyPreset());
    // COMP maps to Ross Compressor (with trademark symbol)
    expect(chain[0].realName).toContain('Ross');
  });

  it('uses placeholder name for unknown effectId', () => {
    const preset = makeEmptyPreset();
    preset.effects[0] = { slotIndex: 0, enabled: true, effectId: 999999, params: Array(15).fill(0) };
    const chain = buildSignalChain(preset);
    expect(chain[0].valetonName).toBe('Unknown #999999');
    expect(chain[0].realName).toBeNull();
    expect(chain[0].module).toBe('UNKNOWN');
  });

  it('reflects enabled state as active', () => {
    const preset = makeEmptyPreset();
    preset.effects[0].enabled = true;
    const chain = buildSignalChain(preset);
    expect(chain[0].active).toBe(true);
    expect(chain[1].active).toBe(false);
  });
});

describe('pickHighlights', () => {
  it('returns null for every role when no slot is active', () => {
    const highlights = pickHighlights(buildSignalChain(makeEmptyPreset()));
    expect(highlights).toEqual({ amp: null, cab: null, drive: null });
  });
});

describe('generateSummary', () => {
  it('is deterministic — same input, same output', () => {
    const chain = buildSignalChain(makeEmptyPreset());
    const a = generateSummary(chain, 'Test');
    const b = generateSummary(chain, 'Test');
    expect(a).toBe(b);
  });

  it('falls back when no relevant modules are active', () => {
    const chain = buildSignalChain(makeEmptyPreset());
    expect(generateSummary(chain, 'Test')).toContain('Valeton GP-200 preset');
    expect(generateSummary(chain, 'Test')).toContain('Test');
  });
});
